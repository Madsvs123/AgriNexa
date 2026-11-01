from datetime import date

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import HasOrganization
from apps.common.views import TenantModelViewSet
from apps.crops import services
from apps.crops.models import (
    Crop,
    CropPlan,
    CropPlanComponent,
    CropVariety,
    FarmingStrategy,
    FertilizerPlan,
    GrowingSeason,
    PesticideApplication,
    PlantingSchedule,
    PlantingWindow,
    ResourceConstraint,
    RotationFieldPhase,
    RotationPlan,
    RotationStep,
    SeasonalBudget,
    StrategyAllocation,
)
from apps.crops.serializers import (
    CropPlanComponentSerializer,
    CropPlanSerializer,
    CropSerializer,
    CropVarietySerializer,
    FarmingStrategyDetailSerializer,
    FarmingStrategySerializer,
    FertilizerPlanSerializer,
    GrowingSeasonSerializer,
    PesticideApplicationSerializer,
    PlantingScheduleSerializer,
    PlantingWindowSerializer,
    ResourceConstraintSerializer,
    RotationFieldPhaseSerializer,
    RotationPlanSerializer,
    RotationStepSerializer,
    SeasonalBudgetSerializer,
    StrategyAllocationSerializer,
)
from apps.farms.models import Farm, Field


def _org_field(request, field_id):
    return get_object_or_404(Field.objects.select_related("farm"), pk=field_id, farm__organization=request.organization)


def _org_season(request, season_id):
    return get_object_or_404(GrowingSeason, pk=season_id, organization=request.organization)


def _parse_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError({"planting_date": "Use YYYY-MM-DD."})


class CropViewSet(TenantModelViewSet):
    serializer_class = CropSerializer
    queryset = Crop.objects.all()
    search_fields = ("name", "scientific_name", "family")
    filterset_fields = ("category", "water_need", "nitrogen_fixing", "family")
    ordering_fields = ("name", "typical_days", "created_at", "expected_yield_per_acre")

    def get_queryset(self):
        return super().get_queryset().prefetch_related("varieties", "compatible_intercrops")


class CropVarietyViewSet(TenantModelViewSet):
    serializer_class = CropVarietySerializer
    queryset = CropVariety.objects.all()
    search_fields = ("name", "crop__name", "maturity_group")
    filterset_fields = ("crop", "is_active")
    ordering_fields = ("name", "days_to_maturity", "expected_yield_per_acre")

    def get_queryset(self):
        return super().get_queryset().select_related("crop")

    @action(detail=False, methods=["get"], url_path="recommend")
    def recommend(self, request):
        """Rank varieties of a crop for a field, planting date, and season."""
        field = _org_field(request, request.query_params.get("field"))
        crop = get_object_or_404(Crop, pk=request.query_params.get("crop"), organization=request.organization)
        season = _org_season(request, request.query_params.get("season"))
        planting = _parse_date(request.query_params.get("planting_date"))
        return Response(
            {
                "field": field.name,
                "crop": crop.name,
                "results": services.recommend_varieties(field, crop, planting, season),
            }
        )


class GrowingSeasonViewSet(TenantModelViewSet):
    serializer_class = GrowingSeasonSerializer
    queryset = GrowingSeason.objects.all()
    search_fields = ("name",)
    filterset_fields = ("farm", "is_active")
    ordering_fields = ("start_date", "name")

    def get_queryset(self):
        return super().get_queryset().select_related("farm", "organization")


class PlantingWindowViewSet(TenantModelViewSet):
    serializer_class = PlantingWindowSerializer
    queryset = PlantingWindow.objects.all()
    filterset_fields = ("crop", "variety", "farm")
    search_fields = ("crop__name", "variety__name", "source")

    def get_queryset(self):
        return super().get_queryset().select_related("crop", "variety", "farm")


class CropPlanViewSet(TenantModelViewSet):
    serializer_class = CropPlanSerializer
    queryset = CropPlan.objects.all()
    search_fields = ("crop__name", "field__name", "notes")
    filterset_fields = ("field", "season", "crop", "status", "variety", "planting_system", "strategy")
    ordering_fields = ("planting_date", "created_at")

    def get_queryset(self):
        qs = super().get_queryset().select_related("field", "field__farm", "season", "crop", "variety", "strategy")
        farm = self.request.query_params.get("farm")
        if farm:
            qs = qs.filter(field__farm_id=farm)
        return qs.prefetch_related("components__crop", "components__variety")

    @action(detail=True, methods=["get"], url_path="assessment")
    def assessment(self, request, pk=None):
        plan = self.get_object()
        return Response(
            services.assess_planting(
                plan.field, plan.crop, plan.variety, plan.planting_date, plan.season, exclude_plan_id=plan.id
            )
        )


class CropPlanComponentViewSet(TenantModelViewSet):
    serializer_class = CropPlanComponentSerializer
    queryset = CropPlanComponent.objects.all()
    filterset_fields = ("crop_plan", "crop", "role")

    def get_queryset(self):
        return super().get_queryset().select_related("crop_plan", "crop", "variety")


class RotationPlanViewSet(TenantModelViewSet):
    serializer_class = RotationPlanSerializer
    queryset = RotationPlan.objects.all()
    search_fields = ("name", "notes")
    filterset_fields = ("farm", "is_active")

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .select_related("farm")
            .prefetch_related("steps__crop", "steps__variety", "steps__companion_crops", "fields", "phases__field")
        )

    @action(detail=True, methods=["get"], url_path="validate")
    def validate_rotation(self, request, pk=None):
        return Response(services.rotation_validate(self.get_object()))

    @action(detail=True, methods=["get"], url_path="preview")
    def preview(self, request, pk=None):
        rotation = self.get_object()
        season = _org_season(request, request.query_params.get("season"))
        return Response({"season": season.name, "year": season.year, "fields": services.rotation_preview(rotation, season)})

    @action(detail=True, methods=["post"], url_path="create-strategy")
    def create_strategy(self, request, pk=None):
        rotation = self.get_object()
        season = _org_season(request, request.data.get("season"))
        strategy = services.strategy_from_rotation(rotation, season, name=request.data.get("name"), user=request.user)
        return Response(FarmingStrategyDetailSerializer(strategy, context={"request": request}).data, status=201)

    @action(detail=True, methods=["put"], url_path="phases")
    def set_phases(self, request, pk=None):
        """Replace per-field phase offsets: [{"field": id, "phase_offset": n}]."""
        rotation = self.get_object()
        rows = request.data if isinstance(request.data, list) else request.data.get("phases", [])
        valid_fields = set(str(x) for x in rotation.fields.values_list("id", flat=True))
        RotationFieldPhase.objects.filter(rotation=rotation).delete()
        created = []
        for row in rows:
            fid = str(row.get("field"))
            if fid not in valid_fields:
                raise ValidationError({"field": f"{fid} is not assigned to this rotation."})
            created.append(
                RotationFieldPhase.objects.create(rotation=rotation, field_id=fid, phase_offset=int(row.get("phase_offset") or 0))
            )
        return Response(RotationFieldPhaseSerializer(created, many=True).data)


class RotationStepViewSet(TenantModelViewSet):
    serializer_class = RotationStepSerializer
    queryset = RotationStep.objects.all()
    filterset_fields = ("rotation", "role", "year_offset")

    def get_queryset(self):
        return super().get_queryset().select_related("rotation", "crop", "variety").prefetch_related("companion_crops")


class ResourceConstraintViewSet(TenantModelViewSet):
    serializer_class = ResourceConstraintSerializer
    queryset = ResourceConstraint.objects.all()
    filterset_fields = ("farm", "season", "resource", "is_hard")

    def get_queryset(self):
        return super().get_queryset().select_related("farm", "season")


class FarmingStrategyViewSet(TenantModelViewSet):
    serializer_class = FarmingStrategySerializer
    queryset = FarmingStrategy.objects.all()
    search_fields = ("name", "description")
    filterset_fields = ("farm", "season", "status", "is_baseline", "rotation")
    ordering_fields = ("name", "created_at", "evaluated_at")

    def get_serializer_class(self):
        if self.action in ("retrieve", "evaluate", "adopt", "clone", "create_from_rotation"):
            return FarmingStrategyDetailSerializer
        return super().get_serializer_class()

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .select_related("farm", "season", "rotation")
            .prefetch_related("allocations__field", "allocations__crop", "allocations__variety")
        )

    def perform_create(self, serializer):
        extra = self.get_create_defaults(serializer)
        strategy = serializer.save(**extra)
        if strategy.is_baseline:
            FarmingStrategy.objects.filter(farm=strategy.farm, season=strategy.season, is_baseline=True).exclude(
                pk=strategy.pk
            ).update(is_baseline=False)

    def perform_update(self, serializer):
        strategy = serializer.save()
        if strategy.is_baseline:
            FarmingStrategy.objects.filter(farm=strategy.farm, season=strategy.season, is_baseline=True).exclude(
                pk=strategy.pk
            ).update(is_baseline=False)
        # Assumption changes invalidate the cached evaluation.
        services.evaluate_strategy(strategy)

    @action(detail=True, methods=["post"], url_path="evaluate")
    def evaluate(self, request, pk=None):
        strategy = self.get_object()
        return Response(services.evaluate_strategy(strategy))

    @action(detail=False, methods=["get"], url_path="compare")
    def compare(self, request):
        ids = [x for x in (request.query_params.get("ids") or "").split(",") if x]
        if len(ids) < 1:
            raise ValidationError({"ids": "Pass at least one strategy id, comma-separated."})
        strategies = list(self.get_queryset().filter(pk__in=ids))
        if not strategies:
            raise ValidationError({"ids": "No matching strategies."})
        # Preserve the caller's order
        order = {sid: i for i, sid in enumerate(ids)}
        strategies.sort(key=lambda s: order.get(str(s.id), 999))
        refresh = request.query_params.get("refresh", "1") != "0"
        return Response(services.compare_strategies(strategies, refresh=refresh))

    @action(detail=True, methods=["post"], url_path="adopt")
    def adopt(self, request, pk=None):
        strategy = self.get_object()
        evaluation = services.evaluate_strategy(strategy)
        if not evaluation["feasible"] and not request.data.get("force"):
            return Response(
                {
                    "detail": "Strategy violates hard constraints. Pass force=true to adopt anyway.",
                    "hard_violations": [c for c in evaluation["constraints"] if c["status"] == "violated"],
                },
                status=status.HTTP_409_CONFLICT,
            )
        result = services.adopt_strategy(strategy, user=request.user)
        strategy.refresh_from_db()
        return Response({"strategy": self.get_serializer(strategy).data, **result})

    @action(detail=True, methods=["post"], url_path="clone")
    def clone(self, request, pk=None):
        strategy = self.get_object()
        clone = services.clone_strategy(strategy, name=request.data.get("name"), user=request.user)
        services.evaluate_strategy(clone)
        return Response(self.get_serializer(clone).data, status=201)

    @action(detail=True, methods=["put"], url_path="allocations")
    def set_allocations(self, request, pk=None):
        """Bulk-replace allocations: a list of StrategyAllocation payloads (without `strategy`)."""
        strategy = self.get_object()
        rows = request.data if isinstance(request.data, list) else request.data.get("allocations", [])
        serializers_ = []
        for row in rows:
            data = {**row, "strategy": str(strategy.id)}
            ser = StrategyAllocationSerializer(data=data, context={"request": request})
            ser.is_valid(raise_exception=True)
            serializers_.append(ser)
        strategy.allocations.all().delete()
        for ser in serializers_:
            ser.save()
        evaluation = services.evaluate_strategy(strategy)
        strategy.refresh_from_db()
        return Response({**FarmingStrategyDetailSerializer(strategy, context={"request": request}).data, "evaluation": evaluation})


class StrategyAllocationViewSet(TenantModelViewSet):
    serializer_class = StrategyAllocationSerializer
    queryset = StrategyAllocation.objects.all()
    filterset_fields = ("strategy", "field", "crop", "planting_system")

    def get_queryset(self):
        return super().get_queryset().select_related("strategy", "field", "crop", "variety")

    def perform_create(self, serializer):
        super().perform_create(serializer)
        services.evaluate_strategy(serializer.instance.strategy)

    def perform_update(self, serializer):
        super().perform_update(serializer)
        services.evaluate_strategy(serializer.instance.strategy)

    def perform_destroy(self, instance):
        strategy = instance.strategy
        super().perform_destroy(instance)
        services.evaluate_strategy(strategy)


class PlanningAssessView(APIView):
    """Grade a hypothetical planting without saving anything."""

    permission_classes = [IsAuthenticated, HasOrganization]

    def get(self, request):
        field = _org_field(request, request.query_params.get("field"))
        crop = get_object_or_404(Crop, pk=request.query_params.get("crop"), organization=request.organization)
        season = _org_season(request, request.query_params.get("season"))
        variety = None
        if request.query_params.get("variety"):
            variety = get_object_or_404(CropVariety, pk=request.query_params.get("variety"), crop=crop)
        planting = _parse_date(request.query_params.get("planting_date"))
        return Response(services.assess_planting(field, crop, variety, planting, season))


class PlanningConstraintsView(APIView):
    """Resource utilisation of committed plans for a season (optionally one farm)."""

    permission_classes = [IsAuthenticated, HasOrganization]

    def get(self, request):
        season = _org_season(request, request.query_params.get("season"))
        farm = None
        if request.query_params.get("farm"):
            farm = get_object_or_404(Farm, pk=request.query_params.get("farm"), organization=request.organization)
        return Response({"season": season.name, "farm": farm.name if farm else None, **services.season_usage(season, farm)})


class PlanningWindowView(APIView):
    """Resolved planting window for a crop/variety on a farm in a year."""

    permission_classes = [IsAuthenticated, HasOrganization]

    def get(self, request):
        crop = get_object_or_404(Crop, pk=request.query_params.get("crop"), organization=request.organization)
        variety = None
        if request.query_params.get("variety"):
            variety = get_object_or_404(CropVariety, pk=request.query_params.get("variety"), crop=crop)
        farm = None
        if request.query_params.get("farm"):
            farm = get_object_or_404(Farm, pk=request.query_params.get("farm"), organization=request.organization)
        try:
            year = int(request.query_params.get("year") or date.today().year)
        except ValueError:
            raise ValidationError({"year": "Must be an integer."})
        out = services.resolve_window(crop, variety, farm, year)
        return Response({k: (v.isoformat() if hasattr(v, "isoformat") else (float(v) if v is not None and k == "min_soil_temp_c" else v)) for k, v in out.items()})


class PlantingScheduleViewSet(TenantModelViewSet):
    serializer_class = PlantingScheduleSerializer
    queryset = PlantingSchedule.objects.all()
    search_fields = ("stage", "notes")
    filterset_fields = ("crop_plan",)

    def get_queryset(self):
        return super().get_queryset().select_related("crop_plan", "crop_plan__field")


class FertilizerPlanViewSet(TenantModelViewSet):
    serializer_class = FertilizerPlanSerializer
    queryset = FertilizerPlan.objects.all()
    search_fields = ("product_name",)
    filterset_fields = ("crop_plan",)

    def get_queryset(self):
        return super().get_queryset().select_related("crop_plan")


class PesticideApplicationViewSet(TenantModelViewSet):
    serializer_class = PesticideApplicationSerializer
    queryset = PesticideApplication.objects.all()
    search_fields = ("product_name", "target_pest")
    filterset_fields = ("crop_plan",)

    def get_queryset(self):
        return super().get_queryset().select_related("crop_plan")


class SeasonalBudgetViewSet(TenantModelViewSet):
    serializer_class = SeasonalBudgetSerializer
    queryset = SeasonalBudget.objects.all()
    filterset_fields = ("season", "farm", "category")
    ordering_fields = ("category", "planned_amount")

    def get_queryset(self):
        return super().get_queryset().select_related("season", "farm")
