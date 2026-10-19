from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.irrigation.views import (
    IrrigationAnalyticsView,
    IrrigationRecommendationViewSet,
    IrrigationScheduleViewSet,
    IrrigationZoneViewSet,
    WaterUsageViewSet,
)

router = DefaultRouter()
router.register("irrigation-zones", IrrigationZoneViewSet, basename="irrigation-zone")
router.register("irrigation-schedules", IrrigationScheduleViewSet, basename="irrigation-schedule")
router.register("water-usage", WaterUsageViewSet, basename="water-usage")
router.register("irrigation/recommendations", IrrigationRecommendationViewSet, basename="irrigation-recommendation")

urlpatterns = [
    path("irrigation/analytics/", IrrigationAnalyticsView.as_view(), name="irrigation-analytics"),
    path("", include(router.urls)),
]
