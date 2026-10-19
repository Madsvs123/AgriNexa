from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel, UUIDModel


class IrrigationZone(UUIDModel, TimeStampedModel):
    class Method(models.TextChoices):
        DRIP = "drip", "Drip"
        SPRINKLER = "sprinkler", "Sprinkler"
        FLOOD = "flood", "Flood"
        PIVOT = "pivot", "Pivot"

    farm = models.ForeignKey("farms.Farm", on_delete=models.CASCADE, related_name="irrigation_zones")
    field = models.ForeignKey(
        "farms.Field", on_delete=models.SET_NULL, null=True, blank=True, related_name="irrigation_zones"
    )
    name = models.CharField(max_length=128)
    acres = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    method = models.CharField(max_length=16, choices=Method.choices, default=Method.DRIP)
    moisture_low_threshold = models.DecimalField(max_digits=6, decimal_places=2, default=20)
    moisture_high_threshold = models.DecimalField(max_digits=6, decimal_places=2, default=40)
    flow_rate_gpm = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    boundary = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class IrrigationSchedule(UUIDModel, TimeStampedModel):
    class Recurrence(models.TextChoices):
        NONE = "none", "None"
        DAILY = "daily", "Daily"
        WEEKLY = "weekly", "Weekly"

    zone = models.ForeignKey(IrrigationZone, on_delete=models.CASCADE, related_name="schedules")
    name = models.CharField(max_length=128)
    start_time = models.TimeField()
    duration_minutes = models.PositiveIntegerField(default=30)
    recurrence = models.CharField(max_length=16, choices=Recurrence.choices, default=Recurrence.DAILY)
    days_of_week = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    next_run = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["start_time"]

    def __str__(self):
        return self.name


class WaterUsage(UUIDModel, TimeStampedModel):
    class Source(models.TextChoices):
        WELL = "well", "Well"
        CANAL = "canal", "Canal"
        MUNICIPAL = "municipal", "Municipal"
        RECYCLED = "recycled", "Recycled"

    zone = models.ForeignKey(IrrigationZone, on_delete=models.CASCADE, related_name="water_usage")
    usage_date = models.DateField()
    gallons = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.WELL)
    cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        ordering = ["-usage_date"]
        verbose_name_plural = "water usage"

    def __str__(self):
        return f"{self.zone} {self.usage_date}"


class IrrigationRecommendation(UUIDModel, TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPLIED = "applied", "Applied"
        DISMISSED = "dismissed", "Dismissed"

    zone = models.ForeignKey(IrrigationZone, on_delete=models.CASCADE, related_name="recommendations")
    reason = models.TextField()
    suggested_duration_minutes = models.PositiveIntegerField(default=30)
    moisture_avg = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Rec {self.zone} {self.status}"


class IrrigationEvent(UUIDModel, TimeStampedModel):
    class Mode(models.TextChoices):
        AUTO = "auto", "Auto"
        MANUAL = "manual", "Manual"
        OVERRIDE = "override", "Override"

    zone = models.ForeignKey(IrrigationZone, on_delete=models.CASCADE, related_name="events")
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    water_used_gallons = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    mode = models.CharField(max_length=16, choices=Mode.choices, default=Mode.MANUAL)
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="irrigation_events",
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.zone} {self.mode} {self.started_at}"
