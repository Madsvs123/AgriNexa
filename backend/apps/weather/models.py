from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.common.models import TimeStampedModel, UUIDModel


class WeatherStation(UUIDModel, TimeStampedModel):
    class Source(models.TextChoices):
        DEVICE = "device", _("Device")
        OPENWEATHER = "openweather", _("OpenWeather")
        MANUAL = "manual", _("Manual")

    farm = models.ForeignKey("farms.Farm", on_delete=models.CASCADE, related_name="weather_stations")
    name = models.CharField(max_length=128)
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.MANUAL)
    sensor = models.ForeignKey(
        "sensors.Sensor", on_delete=models.SET_NULL, null=True, blank=True, related_name="weather_stations"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class WeatherReading(UUIDModel, TimeStampedModel):
    station = models.ForeignKey(WeatherStation, on_delete=models.CASCADE, related_name="readings")
    temperature_c = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    humidity_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    rainfall_mm = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    wind_kph = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    pressure_hpa = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    recorded_at = models.DateTimeField()

    class Meta:
        ordering = ["-recorded_at"]
        indexes = [models.Index(fields=["station", "recorded_at"])]

    def __str__(self):
        return f"{self.station} @ {self.recorded_at}"


class WeatherForecast(UUIDModel, TimeStampedModel):
    farm = models.ForeignKey("farms.Farm", on_delete=models.CASCADE, related_name="forecasts")
    forecast_date = models.DateField()
    high_c = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    low_c = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    precip_chance = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    precip_mm = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    conditions = models.CharField(max_length=64, blank=True)
    wind_kph = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ["forecast_date"]
        unique_together = ("farm", "forecast_date")

    def __str__(self):
        return f"{self.farm} {self.forecast_date}"


class WeatherAlert(UUIDModel, TimeStampedModel):
    class AlertType(models.TextChoices):
        FROST = "frost", _("Frost")
        HEAT = "heat", _("Heat")
        STORM = "storm", _("Storm")
        WIND = "wind", _("Wind")
        DROUGHT = "drought", _("Drought")

    class Severity(models.TextChoices):
        LOW = "low", _("Low")
        MEDIUM = "medium", _("Medium")
        HIGH = "high", _("High")
        CRITICAL = "critical", _("Critical")

    farm = models.ForeignKey("farms.Farm", on_delete=models.CASCADE, related_name="weather_alerts")
    alert_type = models.CharField(max_length=16, choices=AlertType.choices)
    severity = models.CharField(max_length=16, choices=Severity.choices, default=Severity.MEDIUM)
    title = models.CharField(max_length=255)
    message = models.TextField()
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-starts_at"]

    def __str__(self):
        return self.title
