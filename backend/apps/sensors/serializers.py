from rest_framework import serializers

from apps.sensors.models import DeviceHealth, Sensor, SensorReading, SensorType


class SensorTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = SensorType
        fields = (
            "id",
            "organization",
            "name",
            "category",
            "unit",
            "min_value",
            "max_value",
            "icon",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_at", "updated_at")


class DeviceHealthSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceHealth
        fields = (
            "id",
            "sensor",
            "battery_pct",
            "signal_dbm",
            "firmware",
            "temperature_c",
            "uptime_hours",
            "last_error",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "sensor", "created_at", "updated_at")


class SensorReadingSerializer(serializers.ModelSerializer):
    sensor_name = serializers.CharField(source="sensor.name", read_only=True)

    class Meta:
        model = SensorReading
        fields = (
            "id",
            "sensor",
            "sensor_name",
            "value",
            "recorded_at",
            "quality",
            "ingested_at",
        )
        read_only_fields = ("id", "sensor", "ingested_at")


class SensorSerializer(serializers.ModelSerializer):
    sensor_type_name = serializers.CharField(source="sensor_type.name", read_only=True)
    sensor_type_category = serializers.CharField(source="sensor_type.category", read_only=True)
    unit = serializers.CharField(source="sensor_type.unit", read_only=True)
    farm_name = serializers.CharField(source="farm.name", read_only=True)
    field_name = serializers.CharField(source="field.name", read_only=True, default=None)
    latest_value = serializers.DecimalField(
        max_digits=14, decimal_places=4, read_only=True, required=False, allow_null=True
    )
    last_reading = serializers.DecimalField(
        source="latest_value", max_digits=14, decimal_places=4, read_only=True, required=False, allow_null=True
    )
    last_reading_at = serializers.DateTimeField(source="last_seen", read_only=True)
    battery_pct = serializers.DecimalField(
        source="health.battery_pct", max_digits=5, decimal_places=2, read_only=True, required=False, allow_null=True
    )
    health = DeviceHealthSerializer(read_only=True)
    api_key = serializers.CharField(read_only=True)

    class Meta:
        model = Sensor
        fields = (
            "id",
            "organization",
            "farm",
            "farm_name",
            "field",
            "field_name",
            "irrigation_zone",
            "name",
            "serial",
            "sensor_type",
            "sensor_type_name",
            "sensor_type_category",
            "unit",
            "lat",
            "lng",
            "status",
            "installed_at",
            "last_seen",
            "api_key",
            "metadata",
            "latest_value",
            "last_reading",
            "last_reading_at",
            "battery_pct",
            "health",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "api_key",
            "last_seen",
            "created_at",
            "updated_at",
        )


class IngestReadingSerializer(serializers.Serializer):
    value = serializers.DecimalField(max_digits=14, decimal_places=4)
    recorded_at = serializers.DateTimeField(required=False)
    quality = serializers.ChoiceField(choices=SensorReading.Quality.choices, required=False)
    battery_pct = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    signal_dbm = serializers.IntegerField(required=False)
    firmware = serializers.CharField(required=False, allow_blank=True)
    temperature_c = serializers.DecimalField(max_digits=6, decimal_places=2, required=False)
    uptime_hours = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    last_error = serializers.CharField(required=False, allow_blank=True)
    api_key = serializers.CharField(required=False, allow_blank=True)
