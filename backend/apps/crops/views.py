from apps.common.views import TenantModelViewSet
from apps.crops.models import (
    Crop,
    CropPlan,
    CropVariety,
    FertilizerPlan,
    GrowingSeason,
    PesticideApplication,
    PlantingSchedule,
    RotationPlan,
    SeasonalBudget,
)
from apps.crops.serializers import (
    CropPlanSerializer,
    CropSerializer,
    CropVarietySerializer,
    FertilizerPlanSerializer,
    GrowingSeasonSerializer,
    PesticideApplicationSerializer,
    PlantingScheduleSerializer,
    RotationPlanSerializer,
    SeasonalBudgetSerializer,
)


class CropViewSet(TenantModelViewSet):
    serializer_class = CropSerializer
    queryset = Crop.objects.all()
    search_fields = ("name", "scientific_name")
    filterset_fields = ("category", "water_need")
    ordering_fields = ("name", "typical_days", "created_at")


class CropVarietyViewSet(TenantModelViewSet):
    serializer_class = CropVarietySerializer
    queryset = CropVariety.objects.all()
    search_fields = ("name", "crop__name")
    filterset_fields = ("crop",)
    ordering_fields = ("name", "days_to_maturity")

    def get_queryset(self):
        return super().get_queryset().select_related("crop")


class GrowingSeasonViewSet(TenantModelViewSet):
    serializer_class = GrowingSeasonSerializer
    queryset = GrowingSeason.objects.all()
    search_fields = ("name",)
    filterset_fields = ("farm", "is_active")
    ordering_fields = ("start_date", "name")

    def get_queryset(self):
        return super().get_queryset().select_related("farm", "organization")


class CropPlanViewSet(TenantModelViewSet):
    serializer_class = CropPlanSerializer
    queryset = CropPlan.objects.all()
    search_fields = ("crop__name", "field__name", "notes")
    filterset_fields = ("field", "season", "crop", "status", "variety")
    ordering_fields = ("planting_date", "created_at")

    def get_queryset(self):
        return super().get_queryset().select_related("field", "field__farm", "season", "crop", "variety")


class RotationPlanViewSet(TenantModelViewSet):
    serializer_class = RotationPlanSerializer
    queryset = RotationPlan.objects.all()
    search_fields = ("name",)
    filterset_fields = ("farm", "is_active")

    def get_queryset(self):
        return super().get_queryset().select_related("farm")


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
