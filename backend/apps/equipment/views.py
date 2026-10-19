from apps.common.views import TenantModelViewSet
from apps.equipment.models import Breakdown, Equipment, FuelLog, MaintenanceSchedule, ServiceHistory
from apps.equipment.serializers import (
    BreakdownSerializer,
    EquipmentSerializer,
    FuelLogSerializer,
    MaintenanceScheduleSerializer,
    ServiceHistorySerializer,
)


class EquipmentViewSet(TenantModelViewSet):
    serializer_class = EquipmentSerializer
    queryset = Equipment.objects.all()
    search_fields = ("name", "serial", "manufacturer", "model")
    filterset_fields = ("farm", "equipment_type", "status", "assigned_field")
    ordering_fields = ("name", "hours", "year")

    def get_queryset(self):
        return super().get_queryset().select_related("farm", "assigned_field")


class MaintenanceScheduleViewSet(TenantModelViewSet):
    serializer_class = MaintenanceScheduleSerializer
    queryset = MaintenanceSchedule.objects.all()
    search_fields = ("title",)
    filterset_fields = ("equipment", "is_active")

    def get_queryset(self):
        return super().get_queryset().select_related("equipment", "equipment__farm")


class FuelLogViewSet(TenantModelViewSet):
    serializer_class = FuelLogSerializer
    queryset = FuelLog.objects.all()
    filterset_fields = ("equipment",)
    ordering_fields = ("logged_at",)

    def get_queryset(self):
        return super().get_queryset().select_related("equipment", "equipment__farm")


class BreakdownViewSet(TenantModelViewSet):
    serializer_class = BreakdownSerializer
    queryset = Breakdown.objects.all()
    search_fields = ("title", "description")
    filterset_fields = ("equipment", "status", "severity")
    ordering_fields = ("reported_at", "severity")

    def get_queryset(self):
        return super().get_queryset().select_related("equipment", "equipment__farm", "reported_by")


class ServiceHistoryViewSet(TenantModelViewSet):
    serializer_class = ServiceHistorySerializer
    queryset = ServiceHistory.objects.all()
    search_fields = ("description", "vendor")
    filterset_fields = ("equipment",)
    ordering_fields = ("service_date",)

    def get_queryset(self):
        return super().get_queryset().select_related("equipment", "equipment__farm")
