from datetime import timedelta

from django.db.models import Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import HasOrganization
from apps.common.views import TenantModelViewSet
from apps.irrigation.models import (
    IrrigationEvent,
    IrrigationRecommendation,
    IrrigationSchedule,
    IrrigationZone,
    WaterUsage,
)
from apps.irrigation.serializers import (
    IrrigationEventSerializer,
    IrrigationRecommendationSerializer,
    IrrigationScheduleSerializer,
    IrrigationZoneSerializer,
    OverrideSerializer,
    WaterUsageSerializer,
)


class IrrigationZoneViewSet(TenantModelViewSet):
    serializer_class = IrrigationZoneSerializer
    queryset = IrrigationZone.objects.all()
    search_fields = ("name",)
    filterset_fields = ("farm", "field", "method", "is_active")
    ordering_fields = ("name", "acres")

    def get_queryset(self):
        return super().get_queryset().select_related("farm", "field")

    @action(detail=True, methods=["post"], url_path="override")
    def override(self, request, pk=None):
        zone = self.get_object()
        serializer = OverrideSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        started = timezone.now()
        duration = data.get("duration_minutes") or 30
        gallons = data.get("water_used_gallons")
        if gallons is None and zone.flow_rate_gpm:
            gallons = zone.flow_rate_gpm * duration
        event = IrrigationEvent.objects.create(
            zone=zone,
            started_at=started,
            ended_at=started + timedelta(minutes=duration),
            water_used_gallons=gallons or 0,
            mode=IrrigationEvent.Mode.OVERRIDE,
            triggered_by=request.user,
            notes=data.get("notes") or "",
        )
        WaterUsage.objects.create(
            zone=zone,
            usage_date=started.date(),
            gallons=event.water_used_gallons,
            source=WaterUsage.Source.WELL,
            cost=0,
        )
        return Response(IrrigationEventSerializer(event).data, status=status.HTTP_201_CREATED)


class IrrigationScheduleViewSet(TenantModelViewSet):
    serializer_class = IrrigationScheduleSerializer
    queryset = IrrigationSchedule.objects.all()
    search_fields = ("name",)
    filterset_fields = ("zone", "is_active", "recurrence")

    def get_queryset(self):
        return super().get_queryset().select_related("zone", "zone__farm")


class WaterUsageViewSet(TenantModelViewSet):
    serializer_class = WaterUsageSerializer
    queryset = WaterUsage.objects.all()
    filterset_fields = ("zone", "source", "usage_date")
    ordering_fields = ("usage_date", "gallons")

    def get_queryset(self):
        return super().get_queryset().select_related("zone", "zone__farm")


class IrrigationRecommendationViewSet(TenantModelViewSet):
    serializer_class = IrrigationRecommendationSerializer
    queryset = IrrigationRecommendation.objects.all()
    filterset_fields = ("zone", "status")
    http_method_names = ["get", "patch", "put", "head", "options"]

    def get_queryset(self):
        return super().get_queryset().select_related("zone", "zone__farm")


class IrrigationAnalyticsView(APIView):
    permission_classes = [IsAuthenticated, HasOrganization]

    def get(self, request):
        org = request.organization
        zones = IrrigationZone.objects.filter(farm__organization=org)
        usage = WaterUsage.objects.filter(zone__farm__organization=org)
        since = timezone.now().date() - timedelta(days=30)
        totals = usage.filter(usage_date__gte=since).aggregate(
            gallons=Sum("gallons"), cost=Sum("cost")
        )
        by_zone = []
        for zone in zones.select_related("farm"):
            z_usage = usage.filter(zone=zone, usage_date__gte=since).aggregate(
                gallons=Sum("gallons"), cost=Sum("cost")
            )
            events = IrrigationEvent.objects.filter(zone=zone, started_at__date__gte=since)
            applied = events.count()
            recs = IrrigationRecommendation.objects.filter(zone=zone, created_at__date__gte=since)
            efficiency = None
            if recs.exists() and applied:
                efficiency = round(min(100, (applied / max(recs.count(), 1)) * 100), 1)
            by_zone.append(
                {
                    "zone": str(zone.id),
                    "name": zone.name,
                    "farm": str(zone.farm_id),
                    "gallons": z_usage["gallons"] or 0,
                    "cost": z_usage["cost"] or 0,
                    "events": applied,
                    "efficiency_pct": efficiency,
                }
            )
        return Response(
            {
                "totals": {
                    "gallons": totals["gallons"] or 0,
                    "cost": totals["cost"] or 0,
                    "zones": zones.count(),
                },
                "by_zone": by_zone,
            }
        )
