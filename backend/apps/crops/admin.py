from django.contrib import admin

from .models import (
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


@admin.register(Crop)
class CropAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "organization", "typical_days", "water_need")
    list_filter = ("category", "water_need")
    search_fields = ("name", "scientific_name")


@admin.register(CropVariety)
class CropVarietyAdmin(admin.ModelAdmin):
    list_display = ("name", "crop", "days_to_maturity", "expected_yield_per_acre")
    search_fields = ("name", "crop__name")


@admin.register(GrowingSeason)
class GrowingSeasonAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "farm", "start_date", "end_date", "is_active")
    list_filter = ("is_active",)


@admin.register(CropPlan)
class CropPlanAdmin(admin.ModelAdmin):
    list_display = ("crop", "field", "season", "status", "planting_date")
    list_filter = ("status",)
    search_fields = ("crop__name", "field__name")


@admin.register(RotationPlan)
class RotationPlanAdmin(admin.ModelAdmin):
    list_display = ("name", "farm", "is_active")


@admin.register(PlantingSchedule)
class PlantingScheduleAdmin(admin.ModelAdmin):
    list_display = ("crop_plan", "stage", "scheduled_date", "completed_date")


@admin.register(FertilizerPlan)
class FertilizerPlanAdmin(admin.ModelAdmin):
    list_display = ("product_name", "crop_plan", "application_date", "rate_per_acre")


@admin.register(PesticideApplication)
class PesticideApplicationAdmin(admin.ModelAdmin):
    list_display = ("product_name", "crop_plan", "target_pest", "application_date")


@admin.register(SeasonalBudget)
class SeasonalBudgetAdmin(admin.ModelAdmin):
    list_display = ("farm", "season", "category", "planned_amount", "actual_amount", "currency")
    list_filter = ("category",)


from .models import (  # noqa: E402
    CropPlanComponent,
    FarmingStrategy,
    PlantingWindow,
    ResourceConstraint,
    RotationStep,
    StrategyAllocation,
)


@admin.register(PlantingWindow)
class PlantingWindowAdmin(admin.ModelAdmin):
    list_display = ("crop", "variety", "farm", "start_month", "start_day", "end_month", "end_day")
    list_filter = ("crop",)


@admin.register(RotationStep)
class RotationStepAdmin(admin.ModelAdmin):
    list_display = ("rotation", "year_offset", "order", "crop", "role")


@admin.register(CropPlanComponent)
class CropPlanComponentAdmin(admin.ModelAdmin):
    list_display = ("crop_plan", "crop", "role", "share_pct")


@admin.register(ResourceConstraint)
class ResourceConstraintAdmin(admin.ModelAdmin):
    list_display = ("resource", "organization", "farm", "season", "limit_value", "is_hard")
    list_filter = ("resource", "is_hard")


@admin.register(FarmingStrategy)
class FarmingStrategyAdmin(admin.ModelAdmin):
    list_display = ("name", "farm", "season", "status", "is_baseline", "evaluated_at")
    list_filter = ("status", "is_baseline")


@admin.register(StrategyAllocation)
class StrategyAllocationAdmin(admin.ModelAdmin):
    list_display = ("strategy", "field", "crop", "planting_system", "acres")
