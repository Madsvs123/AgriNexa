from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.crops.views import (
    CropPlanComponentViewSet,
    CropPlanViewSet,
    CropVarietyViewSet,
    CropViewSet,
    FarmingStrategyViewSet,
    FertilizerPlanViewSet,
    GrowingSeasonViewSet,
    PesticideApplicationViewSet,
    PlanningAssessView,
    PlanningConstraintsView,
    PlanningWindowView,
    PlantingScheduleViewSet,
    PlantingWindowViewSet,
    ResourceConstraintViewSet,
    RotationPlanViewSet,
    RotationStepViewSet,
    SeasonalBudgetViewSet,
    StrategyAllocationViewSet,
)

router = DefaultRouter()
router.register("crops", CropViewSet, basename="crop")
router.register("varieties", CropVarietyViewSet, basename="variety")
router.register("seasons", GrowingSeasonViewSet, basename="season")
router.register("planting-windows", PlantingWindowViewSet, basename="planting-window")
router.register("crop-plans", CropPlanViewSet, basename="crop-plan")
router.register("crop-plan-components", CropPlanComponentViewSet, basename="crop-plan-component")
router.register("rotations", RotationPlanViewSet, basename="rotation")
router.register("rotation-steps", RotationStepViewSet, basename="rotation-step")
router.register("resource-constraints", ResourceConstraintViewSet, basename="resource-constraint")
router.register("strategies", FarmingStrategyViewSet, basename="strategy")
router.register("strategy-allocations", StrategyAllocationViewSet, basename="strategy-allocation")
router.register("planting-schedules", PlantingScheduleViewSet, basename="planting-schedule")
router.register("fertilizer-plans", FertilizerPlanViewSet, basename="fertilizer-plan")
router.register("pesticide-applications", PesticideApplicationViewSet, basename="pesticide-application")
router.register("budgets", SeasonalBudgetViewSet, basename="budget")

urlpatterns = [
    path("planning/assess/", PlanningAssessView.as_view(), name="planning-assess"),
    path("planning/constraints/", PlanningConstraintsView.as_view(), name="planning-constraints"),
    path("planning/window/", PlanningWindowView.as_view(), name="planning-window"),
    path("", include(router.urls)),
]
