from django.db import models

from apps.common.models import OrganizationScopedModel, TimeStampedModel, UUIDModel


class Crop(UUIDModel, TimeStampedModel, OrganizationScopedModel):
    class Category(models.TextChoices):
        GRAIN = "grain", "Grain"
        OILSEED = "oilseed", "Oilseed"
        VEGETABLE = "vegetable", "Vegetable"
        FRUIT = "fruit", "Fruit"
        FORAGE = "forage", "Forage"
        FIBER = "fiber", "Fiber"
        OTHER = "other", "Other"

    class WaterNeed(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    name = models.CharField(max_length=128)
    category = models.CharField(max_length=16, choices=Category.choices, default=Category.GRAIN)
    scientific_name = models.CharField(max_length=255, blank=True)
    typical_days = models.PositiveIntegerField(default=120)
    water_need = models.CharField(max_length=16, choices=WaterNeed.choices, default=WaterNeed.MEDIUM)
    color_hex = models.CharField(max_length=7, default="#4CAF50")

    class Meta:
        ordering = ["name"]
        unique_together = ("organization", "name")

    def __str__(self):
        return self.name


class CropVariety(UUIDModel, TimeStampedModel):
    crop = models.ForeignKey(Crop, on_delete=models.CASCADE, related_name="varieties")
    name = models.CharField(max_length=128)
    days_to_maturity = models.PositiveIntegerField(default=120)
    seed_rate_per_acre = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    expected_yield_per_acre = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    yield_unit = models.CharField(max_length=32, default="bu")
    traits = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("crop", "name")
        verbose_name_plural = "crop varieties"

    def __str__(self):
        return f"{self.crop.name} / {self.name}"


class GrowingSeason(UUIDModel, TimeStampedModel, OrganizationScopedModel):
    farm = models.ForeignKey(
        "farms.Farm", on_delete=models.CASCADE, null=True, blank=True, related_name="seasons"
    )
    name = models.CharField(max_length=128)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return self.name


class CropPlan(UUIDModel, TimeStampedModel):
    class Status(models.TextChoices):
        PLANNED = "planned", "Planned"
        PLANTED = "planted", "Planted"
        GROWING = "growing", "Growing"
        HARVESTED = "harvested", "Harvested"
        CANCELLED = "cancelled", "Cancelled"

    field = models.ForeignKey("farms.Field", on_delete=models.CASCADE, related_name="crop_plans")
    season = models.ForeignKey(GrowingSeason, on_delete=models.CASCADE, related_name="crop_plans")
    crop = models.ForeignKey(Crop, on_delete=models.PROTECT, related_name="crop_plans")
    variety = models.ForeignKey(
        CropVariety, on_delete=models.SET_NULL, null=True, blank=True, related_name="crop_plans"
    )
    planting_date = models.DateField(null=True, blank=True)
    expected_harvest_date = models.DateField(null=True, blank=True)
    target_yield = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    yield_unit = models.CharField(max_length=32, default="bu")
    seed_required = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PLANNED)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-planting_date", "-created_at"]

    def __str__(self):
        return f"{self.crop.name} on {self.field}"


class RotationPlan(UUIDModel, TimeStampedModel):
    farm = models.ForeignKey("farms.Farm", on_delete=models.CASCADE, related_name="rotation_plans")
    name = models.CharField(max_length=128)
    sequence = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class PlantingSchedule(UUIDModel, TimeStampedModel):
    crop_plan = models.ForeignKey(CropPlan, on_delete=models.CASCADE, related_name="planting_schedules")
    stage = models.CharField(max_length=64)
    scheduled_date = models.DateField()
    completed_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["scheduled_date"]

    def __str__(self):
        return f"{self.stage} @ {self.crop_plan}"


class FertilizerPlan(UUIDModel, TimeStampedModel):
    crop_plan = models.ForeignKey(CropPlan, on_delete=models.CASCADE, related_name="fertilizer_plans")
    product_name = models.CharField(max_length=128)
    nutrient_analysis = models.CharField(max_length=64, blank=True)
    rate_per_acre = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    unit = models.CharField(max_length=32, default="lb")
    application_date = models.DateField(null=True, blank=True)
    method = models.CharField(max_length=64, blank=True)
    cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        ordering = ["application_date", "product_name"]

    def __str__(self):
        return self.product_name


class PesticideApplication(UUIDModel, TimeStampedModel):
    crop_plan = models.ForeignKey(CropPlan, on_delete=models.CASCADE, related_name="pesticide_applications")
    product_name = models.CharField(max_length=128)
    target_pest = models.CharField(max_length=128, blank=True)
    rate_per_acre = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    unit = models.CharField(max_length=32, default="oz")
    application_date = models.DateField(null=True, blank=True)
    reentry_hours = models.PositiveIntegerField(default=12)
    phi_days = models.PositiveIntegerField(default=0)
    applicator = models.CharField(max_length=128, blank=True)

    class Meta:
        ordering = ["-application_date"]

    def __str__(self):
        return self.product_name


class SeasonalBudget(UUIDModel, TimeStampedModel):
    class Category(models.TextChoices):
        SEED = "seed", "Seed"
        FERTILIZER = "fertilizer", "Fertilizer"
        CHEMICAL = "chemical", "Chemical"
        LABOR = "labor", "Labor"
        FUEL = "fuel", "Fuel"
        WATER = "water", "Water"
        OTHER = "other", "Other"

    season = models.ForeignKey(GrowingSeason, on_delete=models.CASCADE, related_name="budgets")
    farm = models.ForeignKey("farms.Farm", on_delete=models.CASCADE, related_name="budgets")
    category = models.CharField(max_length=16, choices=Category.choices)
    planned_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    actual_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    currency = models.CharField(max_length=8, default="USD")

    class Meta:
        ordering = ["category"]

    def __str__(self):
        return f"{self.farm} {self.category}"
