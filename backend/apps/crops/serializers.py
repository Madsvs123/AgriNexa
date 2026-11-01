from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.crops.models import (
    Crop,
    CropPlan,
    CropPlanComponent,
    CropVariety,
    FarmingStrategy,
    FertilizerPlan,
    GrowingSeason,
    PesticideApplication,
    PlantingSchedule,
    PlantingWindow,
    ResourceConstraint,
    RotationFieldPhase,
    RotationPlan,
    RotationStep,
    SeasonalBudget,
    StrategyAllocation,
)


def _run_clean(instance):
    try:
        instance.full_clean(exclude=["organization"])
    except DjangoValidationError as exc:
        raise serializers.ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)


class CropSerializer(serializers.ModelSerializer):
    effective_water_inches = serializers.SerializerMethodField()
    variety_count = serializers.IntegerField(source="varieties.count", read_only=True)

    class Meta:
        model = Crop
        fields = (
            "id",
            "organization",
            "name",
            "category",
            "scientific_name",
            "family",
            "typical_days",
            "water_need",
            "color_hex",
            "nitrogen_fixing",
            "root_depth",
            "water_acre_inches",
            "effective_water_inches",
            "labor_hours_per_acre",
            "nitrogen_lb_per_acre",
            "expected_yield_per_acre",
            "yield_unit",
            "expected_price_per_unit",
            "seed_cost_per_acre",
            "input_cost_per_acre",
            "compatible_intercrops",
            "variety_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_at", "updated_at")
        extra_kwargs = {"compatible_intercrops": {"required": False}}

    def get_effective_water_inches(self, obj):
        return float(obj.effective_water_inches)

    def validate(self, attrs):
        name = attrs.get("name", getattr(self.instance, "name", None))
        request = self.context.get("request")
        org = getattr(request, "organization", None) if request else None
        if name and org:
            qs = Crop.objects.filter(organization=org, name=name)
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"name": "A crop with this name already exists."})
        return attrs


class CropVarietySerializer(serializers.ModelSerializer):
    crop_name = serializers.CharField(source="crop.name", read_only=True)
    effective_seed_cost = serializers.SerializerMethodField()

    class Meta:
        model = CropVariety
        fields = (
            "id",
            "crop",
            "crop_name",
            "name",
            "days_to_maturity",
            "maturity_group",
            "seed_rate_per_acre",
            "expected_yield_per_acre",
            "yield_unit",
            "traits",
            "drought_tolerance",
            "disease_resistance",
            "suitable_soils",
            "min_soil_temp_c",
            "gdd_to_maturity",
            "seed_cost_per_acre",
            "effective_seed_cost",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_effective_seed_cost(self, obj):
        return float(obj.effective_seed_cost or 0)

    def validate_drought_tolerance(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Drought tolerance is rated 1–5.")
        return value


class GrowingSeasonSerializer(serializers.ModelSerializer):
    farm_name = serializers.CharField(source="farm.name", read_only=True, default=None)
    year = serializers.IntegerField(read_only=True)

    class Meta:
        model = GrowingSeason
        fields = (
            "id",
            "organization",
            "farm",
            "farm_name",
            "name",
            "start_date",
            "end_date",
            "year",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_at", "updated_at")

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "Season must end after it starts."})
        return attrs


class PlantingWindowSerializer(serializers.ModelSerializer):
    crop_name = serializers.CharField(source="crop.name", read_only=True)
    variety_name = serializers.CharField(source="variety.name", read_only=True, default=None)
    farm_name = serializers.CharField(source="farm.name", read_only=True, default=None)
    resolved = serializers.SerializerMethodField()

    class Meta:
        model = PlantingWindow
        fields = (
            "id",
            "organization",
            "crop",
            "crop_name",
            "variety",
            "variety_name",
            "farm",
            "farm_name",
            "start_month",
            "start_day",
            "end_month",
            "end_day",
            "late_end_month",
            "late_end_day",
            "harvest_by_month",
            "harvest_by_day",
            "min_soil_temp_c",
            "source",
            "notes",
            "resolved",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_at", "updated_at")

    def get_resolved(self, obj):
        request = self.context.get("request")
        year = None
        if request:
            try:
                year = int(request.query_params.get("year") or 0) or None
            except ValueError:
                year = None
        from django.utils import timezone

        out = obj.resolve(year or timezone.now().year)
        return {k: (v.isoformat() if hasattr(v, "isoformat") else (float(v) if isinstance(v, Decimal) else v)) for k, v in out.items()}

    def validate(self, attrs):
        instance = PlantingWindow(**{**(self.instance.__dict__ if self.instance else {}), **attrs})
        # full_clean needs FK objects, not ids
        instance.crop = attrs.get("crop", getattr(self.instance, "crop", None))
        instance.variety = attrs.get("variety", getattr(self.instance, "variety", None))
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict)
        return attrs


class CropPlanComponentSerializer(serializers.ModelSerializer):
    crop_name = serializers.CharField(source="crop.name", read_only=True)
    variety_name = serializers.CharField(source="variety.name", read_only=True, default=None)
    color_hex = serializers.CharField(source="crop.color_hex", read_only=True)

    class Meta:
        model = CropPlanComponent
        fields = (
            "id",
            "crop_plan",
            "crop",
            "crop_name",
            "color_hex",
            "variety",
            "variety_name",
            "role",
            "share_pct",
            "row_arrangement",
            "planting_date",
            "order",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        variety = attrs.get("variety", getattr(self.instance, "variety", None))
        crop = attrs.get("crop", getattr(self.instance, "crop", None))
        if variety and crop and variety.crop_id != crop.id:
            raise serializers.ValidationError({"variety": "Variety does not belong to this crop."})
        share = attrs.get("share_pct", getattr(self.instance, "share_pct", Decimal("50")))
        if share <= 0 or share > 100:
            raise serializers.ValidationError({"share_pct": "Share must be between 0 and 100."})
        return attrs


class CropPlanSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source="field.name", read_only=True)
    field_acres = serializers.DecimalField(source="field.acres", max_digits=12, decimal_places=2, read_only=True)
    farm = serializers.UUIDField(source="field.farm_id", read_only=True)
    farm_name = serializers.CharField(source="field.farm.name", read_only=True)
    crop_name = serializers.CharField(source="crop.name", read_only=True)
    crop_color = serializers.CharField(source="crop.color_hex", read_only=True)
    variety_name = serializers.CharField(source="variety.name", read_only=True, default=None)
    season_name = serializers.CharField(source="season.name", read_only=True)
    strategy_name = serializers.CharField(source="strategy.name", read_only=True, default=None)
    typical_days = serializers.IntegerField(source="crop.typical_days", read_only=True)
    effective_acres = serializers.SerializerMethodField()
    components = CropPlanComponentSerializer(many=True, read_only=True)

    class Meta:
        model = CropPlan
        fields = (
            "id",
            "field",
            "field_name",
            "field_acres",
            "farm",
            "farm_name",
            "season",
            "season_name",
            "crop",
            "crop_name",
            "crop_color",
            "variety",
            "variety_name",
            "planting_system",
            "acres",
            "effective_acres",
            "planting_date",
            "expected_harvest_date",
            "target_yield",
            "yield_unit",
            "seed_required",
            "status",
            "notes",
            "strategy",
            "strategy_name",
            "rotation",
            "typical_days",
            "components",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "strategy", "rotation", "created_at", "updated_at")

    def get_effective_acres(self, obj):
        return float(obj.effective_acres)

    def validate(self, attrs):
        variety = attrs.get("variety", getattr(self.instance, "variety", None))
        crop = attrs.get("crop", getattr(self.instance, "crop", None))
        if variety and crop and variety.crop_id != crop.id:
            raise serializers.ValidationError({"variety": "Variety does not belong to this crop."})
        planting = attrs.get("planting_date", getattr(self.instance, "planting_date", None))
        harvest = attrs.get("expected_harvest_date", getattr(self.instance, "expected_harvest_date", None))
        if planting and harvest and harvest < planting:
            raise serializers.ValidationError({"expected_harvest_date": "Harvest must be after planting."})
        return attrs

    def create(self, validated_data):
        plan = super().create(validated_data)
        self._sync_current_plan(plan)
        return plan

    def update(self, instance, validated_data):
        plan = super().update(instance, validated_data)
        self._sync_current_plan(plan)
        return plan

    def _sync_current_plan(self, plan):
        if plan.status in (CropPlan.Status.PLANTED, CropPlan.Status.GROWING):
            field = plan.field
            if field.current_crop_plan_id != plan.id:
                field.current_crop_plan = plan
                if plan.planting_date:
                    field.planting_date = plan.planting_date
                if plan.expected_harvest_date:
                    field.expected_harvest_date = plan.expected_harvest_date
                field.status = "planted"
                field.save(
                    update_fields=["current_crop_plan", "planting_date", "expected_harvest_date", "status", "updated_at"]
                )


class RotationStepSerializer(serializers.ModelSerializer):
    crop_name = serializers.CharField(source="crop.name", read_only=True, default=None)
    crop_color = serializers.CharField(source="crop.color_hex", read_only=True, default=None)
    variety_name = serializers.CharField(source="variety.name", read_only=True, default=None)
    companion_names = serializers.SerializerMethodField()

    class Meta:
        model = RotationStep
        fields = (
            "id",
            "rotation",
            "year_offset",
            "order",
            "crop",
            "crop_name",
            "crop_color",
            "variety",
            "variety_name",
            "role",
            "companion_crops",
            "companion_names",
            "season_label",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
        extra_kwargs = {"companion_crops": {"required": False}}

    def get_companion_names(self, obj):
        return [c.name for c in obj.companion_crops.all()]

    def validate(self, attrs):
        role = attrs.get("role", getattr(self.instance, "role", RotationStep.Role.MAIN))
        crop = attrs.get("crop", getattr(self.instance, "crop", None))
        variety = attrs.get("variety", getattr(self.instance, "variety", None))
        if role != RotationStep.Role.FALLOW and not crop:
            raise serializers.ValidationError({"crop": "A crop is required unless the step is fallow."})
        if variety and crop and variety.crop_id != crop.id:
            raise serializers.ValidationError({"variety": "Variety does not belong to this crop."})
        return attrs


class RotationFieldPhaseSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source="field.name", read_only=True)

    class Meta:
        model = RotationFieldPhase
        fields = ("id", "rotation", "field", "field_name", "phase_offset")
        read_only_fields = ("id",)


class RotationPlanSerializer(serializers.ModelSerializer):
    farm_name = serializers.CharField(source="farm.name", read_only=True)
    steps = RotationStepSerializer(many=True, read_only=True)
    # Explicit method name: the default `get_field_names` would shadow
    # ModelSerializer.get_field_names(declared_fields, info) and break every
    # list/retrieve with a TypeError.
    field_names = serializers.SerializerMethodField(method_name="assigned_field_names")
    cycle_years = serializers.IntegerField(read_only=True)
    phases = RotationFieldPhaseSerializer(many=True, read_only=True)

    class Meta:
        model = RotationPlan
        fields = (
            "id",
            "farm",
            "farm_name",
            "name",
            "sequence",
            "fields",
            "field_names",
            "phases",
            "start_year",
            "cycle_years",
            "is_active",
            "notes",
            "steps",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
        extra_kwargs = {"fields": {"required": False}, "sequence": {"required": False}}

    def assigned_field_names(self, obj):
        return [f.name for f in obj.fields.all()]

    def validate_fields(self, fields):
        farm = self.initial_data.get("farm") or (self.instance.farm_id if self.instance else None)
        if farm:
            bad = [f.name for f in fields if str(f.farm_id) != str(farm)]
            if bad:
                raise serializers.ValidationError(f"Fields not on this farm: {', '.join(bad)}")
        return fields


class StrategyAllocationSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source="field.name", read_only=True)
    field_acres = serializers.DecimalField(source="field.acres", max_digits=12, decimal_places=2, read_only=True)
    field_soil = serializers.CharField(source="field.soil_type", read_only=True)
    crop_name = serializers.CharField(source="crop.name", read_only=True, default=None)
    crop_color = serializers.CharField(source="crop.color_hex", read_only=True, default=None)
    variety_name = serializers.CharField(source="variety.name", read_only=True, default=None)
    effective_acres = serializers.SerializerMethodField()

    class Meta:
        model = StrategyAllocation
        fields = (
            "id",
            "strategy",
            "field",
            "field_name",
            "field_acres",
            "field_soil",
            "crop",
            "crop_name",
            "crop_color",
            "variety",
            "variety_name",
            "planting_system",
            "acres",
            "effective_acres",
            "planting_date",
            "components",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_effective_acres(self, obj):
        return float(obj.effective_acres)

    def validate(self, attrs):
        strategy = attrs.get("strategy", getattr(self.instance, "strategy", None))
        field = attrs.get("field", getattr(self.instance, "field", None))
        if strategy and field and field.farm_id != strategy.farm_id:
            raise serializers.ValidationError({"field": "Field is not on the strategy's farm."})
        variety = attrs.get("variety", getattr(self.instance, "variety", None))
        crop = attrs.get("crop", getattr(self.instance, "crop", None))
        if variety and crop and variety.crop_id != crop.id:
            raise serializers.ValidationError({"variety": "Variety does not belong to this crop."})
        acres = attrs.get("acres")
        if acres is not None and field and acres > (field.acres or 0):
            raise serializers.ValidationError({"acres": f"Exceeds the field's {field.acres} acres."})
        components = attrs.get("components", getattr(self.instance, "components", []) or [])
        if not isinstance(components, list):
            raise serializers.ValidationError({"components": "Must be a list."})
        total = Decimal("0")
        for c in components:
            if not isinstance(c, dict) or not c.get("crop"):
                raise serializers.ValidationError({"components": "Each component needs a crop."})
            try:
                share = Decimal(str(c.get("share_pct", 0)))
            except Exception:
                raise serializers.ValidationError({"components": "share_pct must be numeric."})
            if share <= 0 or share > 100:
                raise serializers.ValidationError({"components": "share_pct must be between 0 and 100."})
            total += share
        if total > 100:
            raise serializers.ValidationError({"components": f"Component shares total {total}%, above 100%."})
        return attrs


class FarmingStrategySerializer(serializers.ModelSerializer):
    farm_name = serializers.CharField(source="farm.name", read_only=True)
    season_name = serializers.CharField(source="season.name", read_only=True)
    rotation_name = serializers.CharField(source="rotation.name", read_only=True, default=None)
    allocation_count = serializers.IntegerField(source="allocations.count", read_only=True)
    summary = serializers.SerializerMethodField()

    class Meta:
        model = FarmingStrategy
        fields = (
            "id",
            "organization",
            "farm",
            "farm_name",
            "season",
            "season_name",
            "name",
            "description",
            "status",
            "is_baseline",
            "rotation",
            "rotation_name",
            "price_multiplier",
            "yield_multiplier",
            "cost_multiplier",
            "rainfall_scenario",
            "allocation_count",
            "summary",
            "evaluated_at",
            "adopted_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "evaluated_at", "adopted_at", "created_at", "updated_at")

    def get_summary(self, obj):
        ev = obj.evaluation or {}
        totals = ev.get("totals") or {}
        return {
            "acres": totals.get("acres"),
            "revenue": totals.get("revenue"),
            "total_cost": totals.get("total_cost"),
            "margin": totals.get("margin"),
            "margin_per_acre": totals.get("margin_per_acre"),
            "risk_score": ev.get("risk_score"),
            "diversity_index": ev.get("diversity_index"),
            "rotation_score": ev.get("rotation_score"),
            "feasible": ev.get("feasible"),
            "hard_violations": ev.get("hard_violations"),
            "crop_acres": totals.get("crop_acres"),
        }

    def validate(self, attrs):
        for key in ("price_multiplier", "yield_multiplier", "cost_multiplier"):
            v = attrs.get(key)
            if v is not None and not (Decimal("0.1") <= v <= Decimal("5")):
                raise serializers.ValidationError({key: "Multipliers must be between 0.1 and 5."})
        farm = attrs.get("farm", getattr(self.instance, "farm", None))
        rotation = attrs.get("rotation", getattr(self.instance, "rotation", None))
        if rotation and farm and rotation.farm_id != farm.id:
            raise serializers.ValidationError({"rotation": "Rotation belongs to a different farm."})
        return attrs


class FarmingStrategyDetailSerializer(FarmingStrategySerializer):
    allocations = StrategyAllocationSerializer(many=True, read_only=True)
    evaluation = serializers.JSONField(read_only=True)

    class Meta(FarmingStrategySerializer.Meta):
        fields = FarmingStrategySerializer.Meta.fields + ("allocations", "evaluation")


class ResourceConstraintSerializer(serializers.ModelSerializer):
    farm_name = serializers.CharField(source="farm.name", read_only=True, default=None)
    season_name = serializers.CharField(source="season.name", read_only=True, default=None)
    label = serializers.CharField(source="get_resource_display", read_only=True)

    class Meta:
        model = ResourceConstraint
        fields = (
            "id",
            "organization",
            "farm",
            "farm_name",
            "season",
            "season_name",
            "resource",
            "label",
            "limit_value",
            "unit",
            "is_hard",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_at", "updated_at")

    def validate_limit_value(self, v):
        if v < 0:
            raise serializers.ValidationError("Limit cannot be negative.")
        return v


class PlantingScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlantingSchedule
        fields = ("id", "crop_plan", "stage", "scheduled_date", "completed_date", "notes", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class FertilizerPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = FertilizerPlan
        fields = (
            "id",
            "crop_plan",
            "product_name",
            "nutrient_analysis",
            "rate_per_acre",
            "unit",
            "application_date",
            "method",
            "cost",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class PesticideApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PesticideApplication
        fields = (
            "id",
            "crop_plan",
            "product_name",
            "target_pest",
            "rate_per_acre",
            "unit",
            "application_date",
            "reentry_hours",
            "phi_days",
            "applicator",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class SeasonalBudgetSerializer(serializers.ModelSerializer):
    farm_name = serializers.CharField(source="farm.name", read_only=True)
    season_name = serializers.CharField(source="season.name", read_only=True)

    class Meta:
        model = SeasonalBudget
        fields = (
            "id",
            "season",
            "season_name",
            "farm",
            "farm_name",
            "category",
            "planned_amount",
            "actual_amount",
            "currency",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
