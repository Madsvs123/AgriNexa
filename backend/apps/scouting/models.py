from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.common.models import TimeStampedModel, UUIDModel


class ScoutReport(UUIDModel, TimeStampedModel):
    class Health(models.TextChoices):
        EXCELLENT = "excellent", _("Excellent")
        GOOD = "good", _("Good")
        FAIR = "fair", _("Fair")
        POOR = "poor", _("Poor")
        CRITICAL = "critical", _("Critical")

    field = models.ForeignKey("farms.Field", on_delete=models.CASCADE, related_name="scout_reports")
    scout = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="scout_reports"
    )
    report_date = models.DateField()
    overall_health = models.CharField(max_length=16, choices=Health.choices, default=Health.GOOD)
    growth_stage = models.CharField(max_length=64, blank=True)
    notes = models.TextField(blank=True)
    weather_snapshot = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-report_date", "-created_at"]

    def __str__(self):
        return f"{self.field} {self.report_date}"


class DiseaseObservation(UUIDModel, TimeStampedModel):
    report = models.ForeignKey(ScoutReport, on_delete=models.CASCADE, related_name="diseases")
    disease_name = models.CharField(max_length=128)
    severity = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    area_affected_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    notes = models.TextField(blank=True)

    def __str__(self):
        return self.disease_name


class PestIncident(UUIDModel, TimeStampedModel):
    report = models.ForeignKey(ScoutReport, on_delete=models.CASCADE, related_name="pests")
    pest_name = models.CharField(max_length=128)
    severity = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    population_estimate = models.CharField(max_length=64, blank=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return self.pest_name


class WeedPressure(UUIDModel, TimeStampedModel):
    report = models.ForeignKey(ScoutReport, on_delete=models.CASCADE, related_name="weeds")
    weed_name = models.CharField(max_length=128)
    severity = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    coverage_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    def __str__(self):
        return self.weed_name


class ScoutPhoto(UUIDModel, TimeStampedModel):
    report = models.ForeignKey(ScoutReport, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="scout_photos/")
    caption = models.CharField(max_length=255, blank=True)
    taken_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.caption or str(self.id)


class TreatmentPlan(UUIDModel, TimeStampedModel):
    class Status(models.TextChoices):
        PLANNED = "planned", _("Planned")
        APPLIED = "applied", _("Applied")
        CANCELLED = "cancelled", _("Cancelled")

    field = models.ForeignKey("farms.Field", on_delete=models.CASCADE, related_name="treatments")
    report = models.ForeignKey(
        ScoutReport, on_delete=models.SET_NULL, null=True, blank=True, related_name="treatments"
    )
    issue_summary = models.CharField(max_length=255)
    product_name = models.CharField(max_length=128)
    rate = models.CharField(max_length=64, blank=True)
    scheduled_date = models.DateField(null=True, blank=True)
    follow_up_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PLANNED)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_treatments",
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-scheduled_date", "-created_at"]

    def __str__(self):
        return self.issue_summary
