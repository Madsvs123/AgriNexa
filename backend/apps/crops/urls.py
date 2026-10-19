from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.crops.views import (
    CropPlanViewSet,
    CropVarietyViewSet,
    CropViewSet,
    FertilizerPlanViewSet,
    GrowingSeasonViewSet,
    PesticideApplicationViewSet,
    PlantingScheduleViewSet,
    RotationPlanViewSet,
    SeasonalBudgetViewSet,
)

router = DefaultRouter()
router.register("crops", CropViewSet, basename="crop")
router.register("varieties", CropVarietyViewSet, basename="variety")
router.register("seasons", GrowingSeasonViewSet, basename="season")
router.register("crop-plans", CropPlanViewSet, basename="crop-plan")
router.register("rotations", RotationPlanViewSet, basename="rotation")
router.register("planting-schedules", PlantingScheduleViewSet, basename="planting-schedule")
router.register("fertilizer-plans", FertilizerPlanViewSet, basename="fertilizer-plan")
router.register("pesticide-applications", PesticideApplicationViewSet, basename="pesticide-application")
router.register("budgets", SeasonalBudgetViewSet, basename="budget")

urlpatterns = [
    path("", include(router.urls)),
]
