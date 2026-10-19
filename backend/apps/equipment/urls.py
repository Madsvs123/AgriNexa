from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.equipment.views import (
    BreakdownViewSet,
    EquipmentViewSet,
    FuelLogViewSet,
    MaintenanceScheduleViewSet,
    ServiceHistoryViewSet,
)

router = DefaultRouter()
router.register("equipment", EquipmentViewSet, basename="equipment")
router.register("maintenance", MaintenanceScheduleViewSet, basename="maintenance")
router.register("fuel-logs", FuelLogViewSet, basename="fuel-log")
router.register("breakdowns", BreakdownViewSet, basename="breakdown")
router.register("service-history", ServiceHistoryViewSet, basename="service-history")

urlpatterns = [
    path("", include(router.urls)),
]
