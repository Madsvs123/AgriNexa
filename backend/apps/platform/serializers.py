from rest_framework import serializers

from apps.platform.models import AuditLog, Document, Notification, Task


class TaskSerializer(serializers.ModelSerializer):
    farm_name = serializers.CharField(source="farm.name", read_only=True, default=None)
    field_name = serializers.CharField(source="field.name", read_only=True, default=None)
    assignee_email = serializers.CharField(source="assignee.email", read_only=True, default=None)
    created_by_email = serializers.CharField(source="created_by.email", read_only=True, default=None)

    class Meta:
        model = Task
        fields = (
            "id",
            "organization",
            "farm",
            "farm_name",
            "field",
            "field_name",
            "title",
            "description",
            "status",
            "priority",
            "due_date",
            "assignee",
            "assignee_email",
            "created_by",
            "created_by_email",
            "related_object_type",
            "related_object_id",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_by", "created_at", "updated_at")


class DocumentSerializer(serializers.ModelSerializer):
    farm_name = serializers.CharField(source="farm.name", read_only=True, default=None)
    uploaded_by_email = serializers.CharField(source="uploaded_by.email", read_only=True, default=None)

    class Meta:
        model = Document
        fields = (
            "id",
            "organization",
            "farm",
            "farm_name",
            "title",
            "category",
            "file",
            "uploaded_by",
            "uploaded_by_email",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "uploaded_by", "created_at", "updated_at")


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            "id",
            "user",
            "organization",
            "title",
            "body",
            "category",
            "link",
            "is_read",
            "payload",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "user",
            "organization",
            "title",
            "body",
            "category",
            "link",
            "payload",
            "created_at",
            "updated_at",
        )


class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source="user.email", read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "organization",
            "user",
            "user_email",
            "action",
            "model_name",
            "object_id",
            "changes",
            "ip_address",
            "created_at",
        )
        read_only_fields = fields
