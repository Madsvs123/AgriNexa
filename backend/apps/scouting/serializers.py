from django.db import transaction
from rest_framework import serializers

from apps.scouting.models import (
    DiseaseObservation,
    PestIncident,
    ScoutPhoto,
    ScoutReport,
    TreatmentPlan,
    WeedPressure,
)


class DiseaseObservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiseaseObservation
        exclude = ("report",)


class PestIncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PestIncident
        exclude = ("report",)


class WeedPressureSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeedPressure
        exclude = ("report",)


class ScoutPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScoutPhoto
        fields = ("id", "report", "image", "caption", "taken_at", "created_at")
        read_only_fields = ("id", "created_at")


class ScoutReportSerializer(serializers.ModelSerializer):
    diseases = DiseaseObservationSerializer(many=True, required=False)
    pests = PestIncidentSerializer(many=True, required=False)
    weeds = WeedPressureSerializer(many=True, required=False)
    photos = ScoutPhotoSerializer(many=True, read_only=True)
    field_name = serializers.CharField(source="field.name", read_only=True)
    farm = serializers.UUIDField(source="field.farm_id", read_only=True)
    scout_email = serializers.CharField(source="scout.email", read_only=True, default=None)

    class Meta:
        model = ScoutReport
        fields = (
            "id",
            "field",
            "field_name",
            "farm",
            "scout",
            "scout_email",
            "report_date",
            "overall_health",
            "growth_stage",
            "notes",
            "weather_snapshot",
            "diseases",
            "pests",
            "weeds",
            "photos",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "scout", "created_at", "updated_at")

    @transaction.atomic
    def create(self, validated_data):
        diseases = validated_data.pop("diseases", [])
        pests = validated_data.pop("pests", [])
        weeds = validated_data.pop("weeds", [])
        report = ScoutReport.objects.create(**validated_data)
        self._replace_nested(report, diseases, pests, weeds)
        return report

    @transaction.atomic
    def update(self, instance, validated_data):
        diseases = validated_data.pop("diseases", None)
        pests = validated_data.pop("pests", None)
        weeds = validated_data.pop("weeds", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if diseases is not None or pests is not None or weeds is not None:
            if diseases is not None:
                instance.diseases.all().delete()
            if pests is not None:
                instance.pests.all().delete()
            if weeds is not None:
                instance.weeds.all().delete()
            self._replace_nested(
                instance,
                diseases or [],
                pests or [],
                weeds or [],
                replace_all=False,
                has_diseases=diseases is not None,
                has_pests=pests is not None,
                has_weeds=weeds is not None,
            )
        return instance

    def _replace_nested(
        self,
        report,
        diseases,
        pests,
        weeds,
        replace_all=True,
        has_diseases=True,
        has_pests=True,
        has_weeds=True,
    ):
        if replace_all or has_diseases:
            for item in diseases:
                DiseaseObservation.objects.create(report=report, **item)
        if replace_all or has_pests:
            for item in pests:
                PestIncident.objects.create(report=report, **item)
        if replace_all or has_weeds:
            for item in weeds:
                WeedPressure.objects.create(report=report, **item)


class TreatmentPlanSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source="field.name", read_only=True)
    assigned_to_email = serializers.CharField(source="assigned_to.email", read_only=True, default=None)

    class Meta:
        model = TreatmentPlan
        fields = (
            "id",
            "field",
            "field_name",
            "report",
            "issue_summary",
            "product_name",
            "rate",
            "scheduled_date",
            "follow_up_date",
            "status",
            "assigned_to",
            "assigned_to_email",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def create(self, validated_data):
        treatment = super().create(validated_data)
        self._maybe_create_task(treatment)
        return treatment

    def _maybe_create_task(self, treatment):
        try:
            from apps.platform.models import Task
        except Exception:
            return
        field = treatment.field
        Task.objects.create(
            organization=field.farm.organization,
            farm=field.farm,
            field=field,
            title=f"Treatment: {treatment.product_name}",
            description=treatment.issue_summary,
            status=Task.Status.TODO,
            priority=Task.Priority.MEDIUM,
            due_date=treatment.scheduled_date,
            assignee=treatment.assigned_to,
            created_by=self.context.get("request").user if self.context.get("request") else None,
            related_object_type="treatment_plan",
            related_object_id=treatment.id,
        )
