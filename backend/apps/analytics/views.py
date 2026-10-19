from datetime import timedelta

from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.analytics.models import Report
from apps.analytics.serializers import ReportSerializer
from apps.common.permissions import HasOrganization
from apps.common.views import TenantModelViewSet
from apps.crops.models import CropPlan, SeasonalBudget
from apps.equipment.models import Breakdown, Equipment
from apps.farms.models import Farm, Field
from apps.inventory.models import InventoryItem
from apps.irrigation.models import IrrigationZone, WaterUsage
from apps.scouting.models import ScoutReport
from apps.sensors.models import Sensor, SensorReading
from apps.weather.models import WeatherAlert


def _org(request):
    return request.organization


class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated, HasOrganization]

    def get(self, request):
        org = _org(request)
        farms = Farm.objects.filter(organization=org)
        fields = Field.objects.filter(farm__organization=org)
        acres = fields.aggregate(total=Sum("acres"))["total"] or 0
        active_fields = fields.filter(status="planted").count() or fields.count()
        yield_estimate = (
            CropPlan.objects.filter(field__farm__organization=org)
            .exclude(status="cancelled")
            .aggregate(total=Sum("target_yield"))["total"]
            or 0
        )
        since = timezone.now() - timedelta(days=30)
        water = (
            WaterUsage.objects.filter(zone__farm__organization=org, usage_date__gte=since.date()).aggregate(
                gallons=Sum("gallons")
            )["gallons"]
            or 0
        )
        equipment = Equipment.objects.filter(farm__organization=org).exclude(status=Equipment.Status.RETIRED)
        operational = equipment.filter(status=Equipment.Status.OPERATIONAL).count()
        total_eq = equipment.count()
        uptime = round((operational / total_eq) * 100, 1) if total_eq else 0
        open_alerts = (
            Sensor.objects.filter(organization=org, status=Sensor.Status.OFFLINE).count()
            + WeatherAlert.objects.filter(farm__organization=org, is_active=True).count()
            + sum(1 for item in InventoryItem.objects.filter(organization=org) if item.quantity <= item.reorder_level)
            + Breakdown.objects.filter(equipment__farm__organization=org)
            .exclude(status=Breakdown.Status.RESOLVED)
            .count()
        )
        return Response(
            {
                "farms": farms.count(),
                "fields": fields.count(),
                "acres": acres,
                "total_acres": acres,
                "active_fields": active_fields,
                "yield_estimate": yield_estimate,
                "open_alerts": open_alerts,
                "water_used": water,
                "water_used_30d": water,
                "equipment_uptime": uptime,
                "equipment_uptime_pct": uptime,
            }
        )


class DashboardCropProgressView(APIView):
    permission_classes = [IsAuthenticated, HasOrganization]

    def get(self, request):
        org = _org(request)
        today = timezone.now().date()
        grouped = {}
        plans = CropPlan.objects.filter(field__farm__organization=org).select_related("crop", "field", "variety")
        for plan in plans:
            typical = plan.crop.typical_days or 1
            start = plan.planting_date or today
            elapsed = max(0, (today - start).days)
            progress = min(100, round((elapsed / typical) * 100, 1))
            key = plan.crop.name
            bucket = grouped.setdefault(
                key,
                {"crop_name": key, "planted_acres": 0, "progress_pct": 0, "count": 0},
            )
            bucket["planted_acres"] += float(plan.field.acres or 0)
            bucket["progress_pct"] += progress
            bucket["count"] += 1
        rows = []
        for bucket in grouped.values():
            count = bucket.pop("count") or 1
            bucket["progress_pct"] = round(bucket["progress_pct"] / count, 1)
            rows.append(bucket)
        return Response(rows)


class DashboardYieldsView(APIView):
    permission_classes = [IsAuthenticated, HasOrganization]

    def get(self, request):
        org = _org(request)
        rows = []
        plans = CropPlan.objects.filter(field__farm__organization=org).select_related("crop", "field", "variety")
        for plan in plans:
            expected = plan.variety.expected_yield_per_acre if plan.variety_id else None
            rows.append(
                {
                    "field": str(plan.field_id),
                    "field_name": plan.field.name,
                    "crop": plan.crop.name,
                    "label": f"{plan.field.name} · {plan.crop.name}",
                    "target_yield": plan.target_yield,
                    "expected_yield": expected,
                    "target": plan.target_yield,
                    "actual": expected,
                    "yield_unit": plan.yield_unit,
                }
            )
        return Response(rows)


class DashboardFieldHealthView(APIView):
    permission_classes = [IsAuthenticated, HasOrganization]

    def get(self, request):
        org = _org(request)
        rows = []
        for field in Field.objects.filter(farm__organization=org).select_related(
            "farm", "current_crop_plan", "current_crop_plan__crop"
        ):
            latest_scout = (
                ScoutReport.objects.filter(field=field).order_by("-report_date", "-created_at").first()
            )
            sensors = Sensor.objects.filter(field=field, sensor_type__category="soil_moisture")
            moisture = None
            values = []
            for sensor in sensors:
                reading = SensorReading.objects.filter(sensor=sensor).order_by("-recorded_at").first()
                if reading:
                    values.append(reading.value)
            if values:
                moisture = sum(values) / len(values)
            health_map = {
                "excellent": "healthy",
                "good": "healthy",
                "fair": "warning",
                "poor": "critical",
                "critical": "critical",
            }
            rows.append(
                {
                    "id": str(field.id),
                    "field": str(field.id),
                    "name": field.name,
                    "field_name": field.name,
                    "farm": str(field.farm_id),
                    "farm_name": field.farm.name,
                    "overall_health": latest_scout.overall_health if latest_scout else None,
                    "health_status": health_map.get(latest_scout.overall_health, "idle") if latest_scout else "idle",
                    "growth_stage": latest_scout.growth_stage if latest_scout else None,
                    "moisture": float(moisture) if moisture is not None else None,
                    "moisture_avg": moisture,
                    "crop_name": getattr(getattr(field.current_crop_plan, "crop", None), "name", None),
                    "status": field.status,
                }
            )
        return Response(rows)


class DashboardIrrigationView(APIView):
    permission_classes = [IsAuthenticated, HasOrganization]

    def get(self, request):
        org = _org(request)
        zones = list(IrrigationZone.objects.filter(farm__organization=org).select_related("farm", "field"))
        rows = []
        running = 0
        for zone in zones:
            moisture = None
            sensors = Sensor.objects.filter(sensor_type__category="soil_moisture")
            if zone.field_id:
                sensors = sensors.filter(Q(field_id=zone.field_id) | Q(irrigation_zone=zone.id))
            else:
                sensors = sensors.filter(Q(farm_id=zone.farm_id) | Q(irrigation_zone=zone.id))
            values = []
            for sensor in sensors:
                reading = SensorReading.objects.filter(sensor=sensor).order_by("-recorded_at").first()
                if reading:
                    values.append(reading.value)
            if values:
                moisture = sum(values) / len(values)
            status = "ok"
            if moisture is not None:
                if moisture < zone.moisture_low_threshold:
                    status = "low"
                elif moisture > zone.moisture_high_threshold:
                    status = "high"
            if status == "low":
                running += 1
            rows.append(
                {
                    "zone": str(zone.id),
                    "name": zone.name,
                    "farm": str(zone.farm_id),
                    "is_active": zone.is_active,
                    "moisture_avg": moisture,
                    "moisture_low_threshold": zone.moisture_low_threshold,
                    "moisture_high_threshold": zone.moisture_high_threshold,
                    "status": status,
                }
            )
        today = timezone.now().date()
        gallons_today = (
            WaterUsage.objects.filter(zone__farm__organization=org, usage_date=today).aggregate(
                gallons=Sum("gallons")
            )["gallons"]
            or 0
        )
        month = timezone.now().date() - timedelta(days=30)
        gallons_month = (
            WaterUsage.objects.filter(zone__farm__organization=org, usage_date__gte=month).aggregate(
                gallons=Sum("gallons")
            )["gallons"]
            or 0
        )
        efficiency = 82
        if gallons_month:
            efficiency = min(100, round(100 - (float(gallons_today) / max(float(gallons_month) / 30, 1)) * 8, 1))
        return Response(
            {
                "zones_running": running,
                "zones_total": len(zones),
                "gallons_today": gallons_today,
                "efficiency_pct": efficiency,
                "zones": rows,
            }
        )


class DashboardExpensesView(APIView):
    permission_classes = [IsAuthenticated, HasOrganization]

    def get(self, request):
        org = _org(request)
        qs = SeasonalBudget.objects.filter(farm__organization=org)
        by_category = (
            qs.values("category", "currency")
            .annotate(planned=Sum("planned_amount"), actual=Sum("actual_amount"))
            .order_by("category")
        )
        rows = []
        for row in by_category:
            rows.append(
                {
                    "date": row["category"],
                    "amount": row["actual"] or 0,
                    "category": row["category"],
                    "planned": row["planned"] or 0,
                    "actual": row["actual"] or 0,
                    "currency": row["currency"],
                }
            )
        return Response(rows)


class DashboardKpisView(APIView):
    permission_classes = [IsAuthenticated, HasOrganization]

    def get(self, request):
        org = _org(request)
        fields = Field.objects.filter(farm__organization=org)
        acres = fields.aggregate(total=Sum("acres"))["total"] or 0
        farms = Farm.objects.filter(organization=org).count()
        growing = CropPlan.objects.filter(
            field__farm__organization=org, status__in=["planted", "growing"]
        ).count()
        since = timezone.now() - timedelta(days=30)
        prev = timezone.now() - timedelta(days=60)
        water_now = (
            WaterUsage.objects.filter(zone__farm__organization=org, usage_date__gte=since.date()).aggregate(
                gallons=Sum("gallons")
            )["gallons"]
            or 0
        )
        water_prev = (
            WaterUsage.objects.filter(
                zone__farm__organization=org,
                usage_date__gte=prev.date(),
                usage_date__lt=since.date(),
            ).aggregate(gallons=Sum("gallons"))["gallons"]
            or 0
        )
        water_delta = None
        if water_prev:
            water_delta = round(((float(water_now) - float(water_prev)) / float(water_prev)) * 100, 1)
        kpis = [
            {"key": "acres", "label": "Acres under management", "value": acres, "delta": None, "unit": "ac"},
            {"key": "farms", "label": "Active farms", "value": farms, "delta": None, "unit": ""},
            {"key": "growing_plans", "label": "Active crop plans", "value": growing, "delta": None, "unit": ""},
            {
                "key": "water_30d",
                "label": "Water used (30d)",
                "value": water_now,
                "delta": water_delta,
                "unit": "gal",
            },
        ]
        return Response(kpis)


class AnalyticsOverviewView(APIView):
    permission_classes = [IsAuthenticated, HasOrganization]

    def get(self, request):
        summary = DashboardSummaryView().get(request).data
        kpis = DashboardKpisView().get(request).data
        return Response({"summary": summary, "kpis": kpis})


class AnalyticsYieldsView(DashboardYieldsView):
    pass


class AnalyticsWaterView(APIView):
    permission_classes = [IsAuthenticated, HasOrganization]

    def get(self, request):
        org = _org(request)
        since = timezone.now().date() - timedelta(days=90)
        daily = (
            WaterUsage.objects.filter(zone__farm__organization=org, usage_date__gte=since)
            .values("usage_date")
            .annotate(gallons=Sum("gallons"), cost=Sum("cost"))
            .order_by("usage_date")
        )
        by_zone = (
            WaterUsage.objects.filter(zone__farm__organization=org, usage_date__gte=since)
            .values("zone_id", "zone__name")
            .annotate(gallons=Sum("gallons"), cost=Sum("cost"))
        )
        return Response({"daily": list(daily), "by_zone": list(by_zone)})


class AnalyticsCostsView(DashboardExpensesView):
    pass


class ReportViewSet(TenantModelViewSet):
    serializer_class = ReportSerializer
    queryset = Report.objects.all()
    filterset_fields = ("report_type", "status")
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return super().get_queryset().select_related("created_by", "organization")

    @action(detail=False, methods=["post"], url_path="generate")
    def generate(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = serializer.save(organization=request.organization, created_by=request.user)
        from apps.analytics.tasks import generate_report

        try:
            generate_report.delay(str(report.id))
        except Exception:
            generate_report(str(report.id))
            report.refresh_from_db()
        return Response(self.get_serializer(report).data, status=201)
