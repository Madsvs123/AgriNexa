from rest_framework import serializers

from apps.analytics.models import Report


class ReportSerializer(serializers.ModelSerializer):
    created_by_email = serializers.CharField(source="created_by.email", read_only=True, default=None)

    class Meta:
        model = Report
        fields = (
            "id",
            "organization",
            "report_type",
            "params",
            "status",
            "file",
            "created_by",
            "created_by_email",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "status", "file", "created_by", "created_at", "updated_at")
