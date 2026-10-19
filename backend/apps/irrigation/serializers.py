from rest_framework import serializers

from apps.irrigation.models import (
    IrrigationEvent,
    IrrigationRecommendation,
    IrrigationSchedule,
    IrrigationZone,
    WaterUsage,
)


class IrrigationZoneSerializer(serializers.ModelSerializer):
    farm_name = serializers.CharField(source="farm.name", read_only=True)
    field_name = serializers.CharField(source="field.name", read_only=True, default=None)
    threshold = serializers.DecimalField(
        source="moisture_low_threshold", max_digits=6, decimal_places=2, required=False
    )
    moisture = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = IrrigationZone
        fields = (
            "id",
            "farm",
            "farm_name",
            "field",
            "field_name",
            "name",
            "acres",
            "method",
            "moisture_low_threshold",
            "moisture_high_threshold",
            "threshold",
            "flow_rate_gpm",
            "is_active",
            "boundary",
            "moisture",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_moisture(self, obj):
        from apps.sensors.models import Sensor, SensorReading

        sensors = Sensor.objects.filter(sensor_type__category="soil_moisture")
        if obj.field_id:
            sensors = sensors.filter(field_id=obj.field_id)
        else:
            sensors = sensors.filter(farm_id=obj.farm_id)
        reading = (
            SensorReading.objects.filter(sensor__in=sensors).order_by("-recorded_at").first()
        )
        return float(reading.value) if reading else None

    def get_status(self, obj):
        if not obj.is_active:
            return "idle"
        moisture = self.get_moisture(obj)
        if moisture is None:
            return "idle"
        if moisture < float(obj.moisture_low_threshold or 0):
            return "critical"
        if obj.moisture_high_threshold and moisture > float(obj.moisture_high_threshold):
            return "warning"
        return "healthy"


class IrrigationScheduleSerializer(serializers.ModelSerializer):
    zone_name = serializers.CharField(source="zone.name", read_only=True)

    class Meta:
        model = IrrigationSchedule
        fields = (
            "id",
            "zone",
            "zone_name",
            "name",
            "start_time",
            "duration_minutes",
            "recurrence",
            "days_of_week",
            "is_active",
            "next_run",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class WaterUsageSerializer(serializers.ModelSerializer):
    zone_name = serializers.CharField(source="zone.name", read_only=True)

    class Meta:
        model = WaterUsage
        fields = (
            "id",
            "zone",
            "zone_name",
            "usage_date",
            "gallons",
            "source",
            "cost",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class IrrigationRecommendationSerializer(serializers.ModelSerializer):
    zone_name = serializers.CharField(source="zone.name", read_only=True)
    farm = serializers.UUIDField(source="zone.farm_id", read_only=True)

    class Meta:
        model = IrrigationRecommendation
        fields = (
            "id",
            "zone",
            "zone_name",
            "farm",
            "reason",
            "suggested_duration_minutes",
            "moisture_avg",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class IrrigationEventSerializer(serializers.ModelSerializer):
    zone_name = serializers.CharField(source="zone.name", read_only=True)

    class Meta:
        model = IrrigationEvent
        fields = (
            "id",
            "zone",
            "zone_name",
            "started_at",
            "ended_at",
            "water_used_gallons",
            "mode",
            "triggered_by",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class OverrideSerializer(serializers.Serializer):
    duration_minutes = serializers.IntegerField(min_value=1, required=False, default=30)
    water_used_gallons = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")
