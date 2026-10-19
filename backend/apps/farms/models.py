from django.conf import settings
from django.db import models

from apps.common.models import OrganizationScopedModel, TimeStampedModel, UUIDModel


class Region(UUIDModel, TimeStampedModel, OrganizationScopedModel):
    name = models.CharField(max_length=128)
    parent = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="children"
    )
    code = models.CharField(max_length=32, blank=True)
    geojson = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("organization", "name")

    def __str__(self):
        return self.name


class Farm(UUIDModel, TimeStampedModel, OrganizationScopedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        IDLE = "idle", "Idle"
        ARCHIVED = "archived", "Archived"

    region = models.ForeignKey(
        Region, on_delete=models.SET_NULL, null=True, blank=True, related_name="farms"
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=32, blank=True)
    address = models.CharField(max_length=512, blank=True)
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    total_acres = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    timezone = models.CharField(max_length=64, default="UTC")
    soil_summary = models.TextField(blank=True)
    contact_name = models.CharField(max_length=128, blank=True)
    contact_phone = models.CharField(max_length=32, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    notes = models.TextField(blank=True)
    settings = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Field(UUIDModel, TimeStampedModel):
    class IrrigationType(models.TextChoices):
        NONE = "none", "None"
        DRIP = "drip", "Drip"
        SPRINKLER = "sprinkler", "Sprinkler"
        FLOOD = "flood", "Flood"
        PIVOT = "pivot", "Pivot"

    class Status(models.TextChoices):
        FALLOW = "fallow", "Fallow"
        PLANTED = "planted", "Planted"
        HARVESTED = "harvested", "Harvested"
        PREP = "prep", "Prep"

    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="fields")
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=32, blank=True)
    acres = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    boundary = models.JSONField(default=dict, blank=True)
    soil_type = models.CharField(max_length=64, blank=True)
    soil_ph = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    organic_matter = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    irrigation_type = models.CharField(
        max_length=16, choices=IrrigationType.choices, default=IrrigationType.NONE
    )
    drainage = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.FALLOW)
    centroid_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    centroid_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    planting_date = models.DateField(null=True, blank=True)
    expected_harvest_date = models.DateField(null=True, blank=True)
    current_crop_plan = models.ForeignKey(
        "crops.CropPlan",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="current_fields",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.farm.name} / {self.name}"


class Plot(UUIDModel, TimeStampedModel):
    field = models.ForeignKey(Field, on_delete=models.CASCADE, related_name="plots")
    name = models.CharField(max_length=128)
    acres = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    boundary = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class FieldNote(UUIDModel, TimeStampedModel):
    class NoteType(models.TextChoices):
        OBSERVATION = "observation", "Observation"
        ISSUE = "issue", "Issue"
        INSTRUCTION = "instruction", "Instruction"
        GENERAL = "general", "General"

    field = models.ForeignKey(Field, on_delete=models.CASCADE, related_name="notes")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="field_notes"
    )
    note_type = models.CharField(max_length=16, choices=NoteType.choices, default=NoteType.GENERAL)
    content = models.TextField()
    gps_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    gps_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.note_type} on {self.field}"


class CropHistory(UUIDModel, TimeStampedModel):
    field = models.ForeignKey(Field, on_delete=models.CASCADE, related_name="history")
    crop_name = models.CharField(max_length=128)
    variety_name = models.CharField(max_length=128, blank=True)
    season_name = models.CharField(max_length=128, blank=True)
    planted_at = models.DateField(null=True, blank=True)
    harvested_at = models.DateField(null=True, blank=True)
    yield_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    yield_unit = models.CharField(max_length=32, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-planted_at", "-created_at"]
        verbose_name_plural = "crop histories"

    def __str__(self):
        return f"{self.crop_name} @ {self.field}"
