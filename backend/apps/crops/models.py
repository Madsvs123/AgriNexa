from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import OrganizationScopedModel, TimeStampedModel, UUIDModel


# Default seasonal water requirement (acre-inches) by coarse water-need class.
WATER_INCHES_BY_NEED = {"low": Decimal("12"), "medium": Decimal("20"), "high": Decimal("28")}


class Crop(UUIDModel, TimeStampedModel, OrganizationScopedModel):
    class Category(models.TextChoices):
        GRAIN = "grain", "Grain"
        OILSEED = "oilseed", "Oilseed"
        LEGUME = "legume", "Legume"
        VEGETABLE = "vegetable", "Vegetable"
        FRUIT = "fruit", "Fruit"
        FORAGE = "forage", "Forage"
        FIBER = "fiber", "Fiber"
        COVER = "cover", "Cover crop"
        OTHER = "other", "Other"

    class WaterNeed(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    class RootDepth(models.TextChoices):
        SHALLOW = "shallow", "Shallow"
        MEDIUM = "medium", "Medium"
        DEEP = "deep", "Deep"

    name = models.CharField(max_length=128)
    category = models.CharField(max_length=16, choices=Category.choices, default=Category.GRAIN)
    scientific_name = models.CharField(max_length=255, blank=True)
    # Botanical family drives rotation rules: back-to-back crops from the same
    # family share pests and diseases.
    family = models.CharField(max_length=64, blank=True)
    typical_days = models.PositiveIntegerField(default=120)
    water_need = models.CharField(max_length=16, choices=WaterNeed.choices, default=WaterNeed.MEDIUM)
    color_hex = models.CharField(max_length=7, default="#4CAF50")

    # ── Agronomic profile (per acre, per season) ─────────────────────────
    nitrogen_fixing = models.BooleanField(default=False)
    root_depth = models.CharField(max_length=16, choices=RootDepth.choices, default=RootDepth.MEDIUM)
    water_acre_inches = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    labor_hours_per_acre = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("2.5"))
    nitrogen_lb_per_acre = models.DecimalField(max_digits=7, decimal_places=1, default=0)

    # ── Economics (defaults; varieties and strategies may override) ──────
    expected_yield_per_acre = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    yield_unit = models.CharField(max_length=32, default="bu")
    expected_price_per_unit = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    seed_cost_per_acre = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    input_cost_per_acre = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, help_text="Fertilizer, chemical, fuel, and other non-seed inputs."
    )

    # Crops that grow well together in an intercrop or relay system.
    compatible_intercrops = models.ManyToManyField("self", blank=True, symmetrical=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("organization", "name")

    def __str__(self):
        return self.name

    @property
    def effective_water_inches(self) -> Decimal:
        if self.water_acre_inches is not None:
            return self.water_acre_inches
        return WATER_INCHES_BY_NEED.get(self.water_need, WATER_INCHES_BY_NEED["medium"])


class CropVariety(UUIDModel, TimeStampedModel):
    crop = models.ForeignKey(Crop, on_delete=models.CASCADE, related_name="varieties")
    name = models.CharField(max_length=128)
    days_to_maturity = models.PositiveIntegerField(default=120)
    maturity_group = models.CharField(max_length=16, blank=True, help_text="e.g. RM 110, MG 3.6")
    seed_rate_per_acre = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    expected_yield_per_acre = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    yield_unit = models.CharField(max_length=32, default="bu")
    traits = models.JSONField(default=list, blank=True)

    # ── Selection criteria ───────────────────────────────────────────────
    drought_tolerance = models.PositiveSmallIntegerField(default=3, help_text="1 (poor) – 5 (excellent)")
    disease_resistance = models.JSONField(default=list, blank=True, help_text="List of resisted diseases.")
    suitable_soils = models.JSONField(default=list, blank=True, help_text="Soil type keys this variety suits.")
    min_soil_temp_c = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    gdd_to_maturity = models.PositiveIntegerField(null=True, blank=True)
    seed_cost_per_acre = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("crop", "name")
        verbose_name_plural = "crop varieties"

    def __str__(self):
        return f"{self.crop.name} / {self.name}"

    @property
    def effective_seed_cost(self) -> Decimal:
        return self.seed_cost_per_acre if self.seed_cost_per_acre is not None else self.crop.seed_cost_per_acre

    @property
    def effective_yield(self) -> Decimal:
        return self.expected_yield_per_acre or self.crop.expected_yield_per_acre


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

    @property
    def year(self) -> int:
        return self.start_date.year


def _month_day(year: int, month: int | None, day: int | None):
    if not month or not day:
        return None
    try:
        return date(year, month, day)
    except ValueError:
        return None


class PlantingWindow(UUIDModel, TimeStampedModel, OrganizationScopedModel):
    """When a crop can go in the ground, and by when it must come out.

    Resolution is most-specific-wins: a window tied to a variety beats one tied
    only to the crop; a farm-specific window beats an organization-wide one.
    """

    crop = models.ForeignKey(Crop, on_delete=models.CASCADE, related_name="planting_windows")
    variety = models.ForeignKey(
        CropVariety, on_delete=models.CASCADE, null=True, blank=True, related_name="planting_windows"
    )
    farm = models.ForeignKey(
        "farms.Farm", on_delete=models.CASCADE, null=True, blank=True, related_name="planting_windows"
    )
    # Optimal window
    start_month = models.PositiveSmallIntegerField()
    start_day = models.PositiveSmallIntegerField()
    end_month = models.PositiveSmallIntegerField()
    end_day = models.PositiveSmallIntegerField()
    # Acceptable-but-late planting cut-off (yield penalty beyond `end`).
    late_end_month = models.PositiveSmallIntegerField(null=True, blank=True)
    late_end_day = models.PositiveSmallIntegerField(null=True, blank=True)
    # Harvest deadline (first killing frost, contract date, etc.).
    harvest_by_month = models.PositiveSmallIntegerField(null=True, blank=True)
    harvest_by_day = models.PositiveSmallIntegerField(null=True, blank=True)
    min_soil_temp_c = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    source = models.CharField(max_length=128, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["crop__name", "start_month", "start_day"]

    def __str__(self):
        return f"{self.crop.name} window {self.start_month}/{self.start_day}–{self.end_month}/{self.end_day}"

    def clean(self):
        for label, m, d in (
            ("start", self.start_month, self.start_day),
            ("end", self.end_month, self.end_day),
            ("late_end", self.late_end_month, self.late_end_day),
            ("harvest_by", self.harvest_by_month, self.harvest_by_day),
        ):
            if (m is None) != (d is None):
                raise ValidationError({f"{label}_month": "Month and day must be set together."})
            if m is not None and _month_day(2024, m, d) is None:  # leap year so Feb 29 validates
                raise ValidationError({f"{label}_month": "Not a valid calendar date."})
        if self.variety_id and self.variety.crop_id != self.crop_id:
            raise ValidationError({"variety": "Variety does not belong to this crop."})

    def resolve(self, year: int) -> dict:
        start = _month_day(year, self.start_month, self.start_day)
        end = _month_day(year, self.end_month, self.end_day)
        # Windows that wrap the new year (e.g. winter wheat Sep→Feb) land `end` next year.
        if start and end and end < start:
            end = _month_day(year + 1, self.end_month, self.end_day)
        late_end = _month_day(year, self.late_end_month, self.late_end_day)
        if start and late_end and late_end < start:
            late_end = _month_day(year + 1, self.late_end_month, self.late_end_day)
        harvest_by = _month_day(year, self.harvest_by_month, self.harvest_by_day)
        if start and harvest_by and harvest_by < start:
            harvest_by = _month_day(year + 1, self.harvest_by_month, self.harvest_by_day)
        return {
            "start": start,
            "end": end,
            "late_end": late_end or end,
            "harvest_by": harvest_by,
            "min_soil_temp_c": self.min_soil_temp_c,
            "source": self.source,
            "window_id": str(self.id),
        }


class PlantingSystem(models.TextChoices):
    MONOCULTURE = "monoculture", "Monoculture"
    INTERCROP = "intercrop", "Intercrop"
    RELAY = "relay", "Relay"
    STRIP = "strip", "Strip"
    COVER = "cover", "Cover crop"


class RotationPlan(UUIDModel, TimeStampedModel):
    farm = models.ForeignKey("farms.Farm", on_delete=models.CASCADE, related_name="rotation_plans")
    name = models.CharField(max_length=128)
    # Legacy free-form sequence, kept readable; structured steps supersede it.
    sequence = models.JSONField(default=list, blank=True)
    fields = models.ManyToManyField("farms.Field", blank=True, related_name="rotation_plans")
    start_year = models.PositiveIntegerField(null=True, blank=True, help_text="Calendar year of step 0.")
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def cycle_years(self) -> int:
        offsets = list(self.steps.values_list("year_offset", flat=True))
        return (max(offsets) + 1) if offsets else 0

    def step_for_year(self, year: int, field=None):
        """Step scheduled for `year`, cycling once the plan runs out.

        A field may carry its own phase offset so that fields in the same
        rotation can be staggered (classic strip/phase rotation).
        """
        steps = list(self.steps.order_by("year_offset", "order"))
        if not steps:
            return None
        cycle = self.cycle_years or 1
        base = self.start_year or year
        phase = 0
        if field is not None:
            phase = (
                RotationFieldPhase.objects.filter(rotation=self, field=field)
                .values_list("phase_offset", flat=True)
                .first()
                or 0
            )
        offset = (year - base + phase) % cycle
        for step in steps:
            if step.year_offset == offset and step.role == RotationStep.Role.MAIN:
                return step
        return next((s for s in steps if s.year_offset == offset), None)


class RotationFieldPhase(UUIDModel):
    rotation = models.ForeignKey(RotationPlan, on_delete=models.CASCADE, related_name="phases")
    field = models.ForeignKey("farms.Field", on_delete=models.CASCADE, related_name="rotation_phases")
    phase_offset = models.PositiveSmallIntegerField(default=0)

    class Meta:
        unique_together = ("rotation", "field")


class RotationStep(UUIDModel, TimeStampedModel):
    class Role(models.TextChoices):
        MAIN = "main", "Main crop"
        COVER = "cover", "Cover crop"
        INTERCROP = "intercrop", "Intercrop"
        FALLOW = "fallow", "Fallow"

    rotation = models.ForeignKey(RotationPlan, on_delete=models.CASCADE, related_name="steps")
    year_offset = models.PositiveSmallIntegerField(default=0)
    order = models.PositiveSmallIntegerField(default=0, help_text="Within-year order for double crops/covers.")
    crop = models.ForeignKey(Crop, on_delete=models.PROTECT, null=True, blank=True, related_name="rotation_steps")
    variety = models.ForeignKey(
        CropVariety, on_delete=models.SET_NULL, null=True, blank=True, related_name="rotation_steps"
    )
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.MAIN)
    companion_crops = models.ManyToManyField(Crop, blank=True, related_name="companion_in_steps")
    season_label = models.CharField(max_length=64, blank=True, help_text="e.g. Spring, Winter, Year 2")
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["year_offset", "order"]
        unique_together = ("rotation", "year_offset", "order")

    def __str__(self):
        label = self.crop.name if self.crop else self.get_role_display()
        return f"{self.rotation.name} · Y{self.year_offset + 1} {label}"

    def clean(self):
        if self.role != self.Role.FALLOW and not self.crop_id:
            raise ValidationError({"crop": "A crop is required unless the step is fallow."})
        if self.variety_id and self.crop_id and self.variety.crop_id != self.crop_id:
            raise ValidationError({"variety": "Variety does not belong to this crop."})


class FarmingStrategy(UUIDModel, TimeStampedModel, OrganizationScopedModel):
    """A candidate plan for a farm-season, evaluated and compared before adoption."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        CANDIDATE = "candidate", "Candidate"
        ADOPTED = "adopted", "Adopted"
        ARCHIVED = "archived", "Archived"

    class Rainfall(models.TextChoices):
        DRY = "dry", "Dry"
        NORMAL = "normal", "Normal"
        WET = "wet", "Wet"

    farm = models.ForeignKey("farms.Farm", on_delete=models.CASCADE, related_name="strategies")
    season = models.ForeignKey(GrowingSeason, on_delete=models.CASCADE, related_name="strategies")
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    is_baseline = models.BooleanField(default=False, help_text="Comparisons show deltas against the baseline.")
    rotation = models.ForeignKey(
        RotationPlan, on_delete=models.SET_NULL, null=True, blank=True, related_name="strategies"
    )
    # Scenario assumptions applied on top of crop/variety defaults.
    price_multiplier = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("1.00"))
    yield_multiplier = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("1.00"))
    cost_multiplier = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("1.00"))
    rainfall_scenario = models.CharField(max_length=8, choices=Rainfall.choices, default=Rainfall.NORMAL)
    evaluation = models.JSONField(default=dict, blank=True)
    evaluated_at = models.DateTimeField(null=True, blank=True)
    adopted_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="strategies_created"
    )

    class Meta:
        ordering = ["-is_baseline", "name"]
        verbose_name_plural = "farming strategies"

    def __str__(self):
        return f"{self.name} ({self.farm} · {self.season})"


class StrategyAllocation(UUIDModel, TimeStampedModel):
    """What one field grows under a strategy, possibly as a mix."""

    strategy = models.ForeignKey(FarmingStrategy, on_delete=models.CASCADE, related_name="allocations")
    field = models.ForeignKey("farms.Field", on_delete=models.CASCADE, related_name="strategy_allocations")
    crop = models.ForeignKey(Crop, on_delete=models.PROTECT, null=True, blank=True, related_name="allocations")
    variety = models.ForeignKey(
        CropVariety, on_delete=models.SET_NULL, null=True, blank=True, related_name="allocations"
    )
    planting_system = models.CharField(
        max_length=16, choices=PlantingSystem.choices, default=PlantingSystem.MONOCULTURE
    )
    acres = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    planting_date = models.DateField(null=True, blank=True)
    # Mixed-cropping components: [{"crop": id, "variety": id|null, "share_pct": 60, "role": "intercrop"}]
    components = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["field__name"]
        unique_together = ("strategy", "field")

    def __str__(self):
        return f"{self.field} → {self.crop or 'fallow'}"

    @property
    def effective_acres(self) -> Decimal:
        if self.acres is not None:
            return self.acres
        return Decimal(self.field.acres or 0)


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
    planting_system = models.CharField(
        max_length=16, choices=PlantingSystem.choices, default=PlantingSystem.MONOCULTURE
    )
    acres = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    planting_date = models.DateField(null=True, blank=True)
    expected_harvest_date = models.DateField(null=True, blank=True)
    target_yield = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    yield_unit = models.CharField(max_length=32, default="bu")
    seed_required = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PLANNED)
    notes = models.TextField(blank=True)
    # Provenance
    strategy = models.ForeignKey(
        FarmingStrategy, on_delete=models.SET_NULL, null=True, blank=True, related_name="crop_plans"
    )
    rotation = models.ForeignKey(
        RotationPlan, on_delete=models.SET_NULL, null=True, blank=True, related_name="crop_plans"
    )

    class Meta:
        ordering = ["-planting_date", "-created_at"]

    def __str__(self):
        return f"{self.crop.name} on {self.field}"

    @property
    def effective_acres(self) -> Decimal:
        if self.acres is not None:
            return self.acres
        return Decimal(self.field.acres or 0)


class CropPlanComponent(UUIDModel, TimeStampedModel):
    """One crop in a mixed-cropping plan (intercrop, relay, strip, or cover)."""

    class Role(models.TextChoices):
        PRIMARY = "primary", "Primary"
        INTERCROP = "intercrop", "Intercrop"
        RELAY = "relay", "Relay"
        COVER = "cover", "Cover"

    crop_plan = models.ForeignKey(CropPlan, on_delete=models.CASCADE, related_name="components")
    crop = models.ForeignKey(Crop, on_delete=models.PROTECT, related_name="plan_components")
    variety = models.ForeignKey(
        CropVariety, on_delete=models.SET_NULL, null=True, blank=True, related_name="plan_components"
    )
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.INTERCROP)
    share_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("50"))
    row_arrangement = models.CharField(max_length=64, blank=True, help_text="e.g. 2:1 rows, alternate strips")
    planting_date = models.DateField(null=True, blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "created_at"]

    def __str__(self):
        return f"{self.crop.name} {self.share_pct}% in {self.crop_plan}"

    def clean(self):
        if self.variety_id and self.variety.crop_id != self.crop_id:
            raise ValidationError({"variety": "Variety does not belong to this crop."})
        if self.share_pct <= 0 or self.share_pct > 100:
            raise ValidationError({"share_pct": "Share must be between 0 and 100."})


class ResourceConstraint(UUIDModel, TimeStampedModel, OrganizationScopedModel):
    """A capacity limit a season's plans must fit inside."""

    class Resource(models.TextChoices):
        WATER = "water_acre_inches", "Irrigation water (acre-inches)"
        LABOR = "labor_hours", "Labor (hours)"
        NITROGEN = "nitrogen_lb", "Nitrogen (lb)"
        SEED_BUDGET = "seed_budget", "Seed budget"
        INPUT_BUDGET = "input_budget", "Input budget"
        TOTAL_BUDGET = "total_budget", "Total budget"
        ACRES = "acres", "Planted acres"
        EQUIPMENT = "equipment_hours", "Equipment (hours)"

    farm = models.ForeignKey(
        "farms.Farm", on_delete=models.CASCADE, null=True, blank=True, related_name="resource_constraints"
    )
    season = models.ForeignKey(
        GrowingSeason, on_delete=models.CASCADE, null=True, blank=True, related_name="resource_constraints"
    )
    resource = models.CharField(max_length=24, choices=Resource.choices)
    limit_value = models.DecimalField(max_digits=14, decimal_places=2)
    unit = models.CharField(max_length=24, blank=True)
    is_hard = models.BooleanField(default=True, help_text="Hard limits fail evaluation; soft ones warn.")
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["resource"]

    def __str__(self):
        return f"{self.get_resource_display()} ≤ {self.limit_value}"


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
