from rest_framework import serializers

from apps.weather.models import WeatherAlert, WeatherForecast, WeatherReading, WeatherStation


class WeatherStationSerializer(serializers.ModelSerializer):
    farm_name = serializers.CharField(source="farm.name", read_only=True)

    class Meta:
        model = WeatherStation
        fields = (
            "id",
            "farm",
            "farm_name",
            "name",
            "lat",
            "lng",
            "source",
            "sensor",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class WeatherReadingSerializer(serializers.ModelSerializer):
    station_name = serializers.CharField(source="station.name", read_only=True)

    class Meta:
        model = WeatherReading
        fields = (
            "id",
            "station",
            "station_name",
            "temperature_c",
            "humidity_pct",
            "rainfall_mm",
            "wind_kph",
            "pressure_hpa",
            "recorded_at",
            "created_at",
        )
        read_only_fields = ("id", "created_at")


class WeatherForecastSerializer(serializers.ModelSerializer):
    farm_name = serializers.CharField(source="farm.name", read_only=True)

    class Meta:
        model = WeatherForecast
        fields = (
            "id",
            "farm",
            "farm_name",
            "forecast_date",
            "high_c",
            "low_c",
            "precip_chance",
            "precip_mm",
            "conditions",
            "wind_kph",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class WeatherAlertSerializer(serializers.ModelSerializer):
    farm_name = serializers.CharField(source="farm.name", read_only=True)

    class Meta:
        model = WeatherAlert
        fields = (
            "id",
            "farm",
            "farm_name",
            "alert_type",
            "severity",
            "title",
            "message",
            "starts_at",
            "ends_at",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
