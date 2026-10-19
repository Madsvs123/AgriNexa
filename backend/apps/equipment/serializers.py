from rest_framework import serializers

from apps.equipment.models import Breakdown, Equipment, FuelLog, MaintenanceSchedule, ServiceHistory


class EquipmentSerializer(serializers.ModelSerializer):
    farm_name = serializers.CharField(source="farm.name", read_only=True)
    assigned_field_name = serializers.CharField(source="assigned_field.name", read_only=True, default=None)
    make = serializers.CharField(source="manufacturer", required=False, allow_blank=True)
    type = serializers.CharField(source="equipment_type", required=False)

    class Meta:
        model = Equipment
        fields = (
            "id",
            "farm",
            "farm_name",
            "name",
            "equipment_type",
            "type",
            "manufacturer",
            "make",
            "model",
            "year",
            "serial",
            "hours",
            "status",
            "lat",
            "lng",
            "fuel_capacity",
            "notes",
            "assigned_field",
            "assigned_field_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class MaintenanceScheduleSerializer(serializers.ModelSerializer):
    equipment_name = serializers.CharField(source="equipment.name", read_only=True)

    class Meta:
        model = MaintenanceSchedule
        fields = (
            "id",
            "equipment",
            "equipment_name",
            "title",
            "interval_hours",
            "last_service_at",
            "last_service_hours",
            "next_due_hours",
            "next_due_date",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class FuelLogSerializer(serializers.ModelSerializer):
    equipment_name = serializers.CharField(source="equipment.name", read_only=True)

    class Meta:
        model = FuelLog
        fields = (
            "id",
            "equipment",
            "equipment_name",
            "gallons",
            "cost",
            "hours",
            "logged_at",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class BreakdownSerializer(serializers.ModelSerializer):
    equipment_name = serializers.CharField(source="equipment.name", read_only=True)
    reported_by_email = serializers.CharField(source="reported_by.email", read_only=True, default=None)

    class Meta:
        model = Breakdown
        fields = (
            "id",
            "equipment",
            "equipment_name",
            "title",
            "description",
            "severity",
            "reported_at",
            "resolved_at",
            "status",
            "reported_by",
            "reported_by_email",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "reported_by", "created_at", "updated_at")


class ServiceHistorySerializer(serializers.ModelSerializer):
    equipment_name = serializers.CharField(source="equipment.name", read_only=True)

    class Meta:
        model = ServiceHistory
        fields = (
            "id",
            "equipment",
            "equipment_name",
            "service_date",
            "description",
            "cost",
            "hours_at_service",
            "vendor",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
