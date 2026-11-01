import secrets

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.common.models import OrganizationScopedModel, TimeStampedModel, UUIDModel


class SensorType(UUIDModel, TimeStampedModel):
    class Category(models.TextChoices):
        SOIL_MOISTURE = "soil_moisture", _("Soil Moisture")
        TEMPERATURE = "temperature", _("Temperature")
        HUMIDITY = "humidity", _("Humidity")
        RAINFALL = "rainfall", _("Rainfall")
        PH = "ph", _("pH")
        NUTRIENT = "nutrient", _("Nutrient")
        WEATHER_STATION = "weather_station", _("Weather Station")
        CUSTOM = "custom", _("Custom")

    organization = models.ForeignKey(
        "tenancy.Organization",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="sensor_types",
    )
    name = models.CharField(max_length=128)
    category = models.CharField(max_length=32, choices=Category.choices, default=Category.CUSTOM)
    unit = models.CharField(max_length=32, blank=True)
    min_value = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    max_value = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    icon = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Sensor(UUIDModel, TimeStampedModel, OrganizationScopedModel):
    class Status(models.TextChoices):
        ONLINE = "online", _("Online")
        OFFLINE = "offline", _("Offline")
        MAINTENANCE = "maintenance", _("Maintenance")
        ERROR = "error", _("Error")

    farm = models.ForeignKey("farms.Farm", on_delete=models.CASCADE, related_name="sensors")
    field = models.ForeignKey(
        "farms.Field", on_delete=models.SET_NULL, null=True, blank=True, related_name="sensors"
    )
    irrigation_zone = models.UUIDField(null=True, blank=True)
    name = models.CharField(max_length=128)
    serial = models.CharField(max_length=128, unique=True)
    sensor_type = models.ForeignKey(SensorType, on_delete=models.PROTECT, related_name="sensors")
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ONLINE)
    installed_at = models.DateTimeField(null=True, blank=True)
    last_seen = models.DateTimeField(null=True, blank=True)
    api_key = models.CharField(max_length=64, unique=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.api_key:
            self.api_key = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)


class SensorReading(UUIDModel):
    class Quality(models.TextChoices):
        GOOD = "good", _("Good")
        SUSPECT = "suspect", _("Suspect")
        BAD = "bad", _("Bad")

    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE, related_name="readings")
    value = models.DecimalField(max_digits=14, decimal_places=4)
    recorded_at = models.DateTimeField()
    quality = models.CharField(max_length=16, choices=Quality.choices, default=Quality.GOOD)
    ingested_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-recorded_at"]
        indexes = [
            models.Index(fields=["sensor", "recorded_at"]),
        ]

    def __str__(self):
        return f"{self.sensor} {self.value} @ {self.recorded_at}"


class DeviceHealth(UUIDModel, TimeStampedModel):
    sensor = models.OneToOneField(Sensor, on_delete=models.CASCADE, related_name="health")
    battery_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    signal_dbm = models.IntegerField(null=True, blank=True)
    firmware = models.CharField(max_length=64, blank=True)
    temperature_c = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    uptime_hours = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    last_error = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"Health {self.sensor}"
