from rest_framework import serializers

from apps.crops.models import (
    Crop,
    CropPlan,
    CropVariety,
    FertilizerPlan,
    GrowingSeason,
    PesticideApplication,
    PlantingSchedule,
    RotationPlan,
    SeasonalBudget,
)


class CropSerializer(serializers.ModelSerializer):
    class Meta:
        model = Crop
        fields = (
            "id",
            "organization",
            "name",
            "category",
            "scientific_name",
            "typical_days",
            "water_need",
            "color_hex",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_at", "updated_at")

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

    class Meta:
        model = CropVariety
        fields = (
            "id",
            "crop",
            "crop_name",
            "name",
            "days_to_maturity",
            "seed_rate_per_acre",
            "expected_yield_per_acre",
            "yield_unit",
            "traits",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class GrowingSeasonSerializer(serializers.ModelSerializer):
    farm_name = serializers.CharField(source="farm.name", read_only=True, default=None)

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
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_at", "updated_at")


class CropPlanSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source="field.name", read_only=True)
    farm = serializers.UUIDField(source="field.farm_id", read_only=True)
    crop_name = serializers.CharField(source="crop.name", read_only=True)
    variety_name = serializers.CharField(source="variety.name", read_only=True, default=None)
    season_name = serializers.CharField(source="season.name", read_only=True)
    typical_days = serializers.IntegerField(source="crop.typical_days", read_only=True)

    class Meta:
        model = CropPlan
        fields = (
            "id",
            "field",
            "field_name",
            "farm",
            "season",
            "season_name",
            "crop",
            "crop_name",
            "variety",
            "variety_name",
            "planting_date",
            "expected_harvest_date",
            "target_yield",
            "yield_unit",
            "seed_required",
            "status",
            "notes",
            "typical_days",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

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
                field.status = "planted" if plan.status == CropPlan.Status.PLANTED else "planted"
                field.save(
                    update_fields=[
                        "current_crop_plan",
                        "planting_date",
                        "expected_harvest_date",
                        "status",
                        "updated_at",
                    ]
                )


class RotationPlanSerializer(serializers.ModelSerializer):
    farm_name = serializers.CharField(source="farm.name", read_only=True)

    class Meta:
        model = RotationPlan
        fields = (
            "id",
            "farm",
            "farm_name",
            "name",
            "sequence",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class PlantingScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlantingSchedule
        fields = (
            "id",
            "crop_plan",
            "stage",
            "scheduled_date",
            "completed_date",
            "notes",
            "created_at",
            "updated_at",
        )
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
