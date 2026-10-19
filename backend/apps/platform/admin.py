from django.contrib import admin

from .models import AuditLog, Document, Notification, Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "organization", "status", "priority", "assignee", "due_date")
    list_filter = ("status", "priority")
    search_fields = ("title", "description")


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "organization", "category", "uploaded_by", "created_at")
    search_fields = ("title", "category")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "organization", "category", "is_read", "created_at")
    list_filter = ("is_read", "category")
    search_fields = ("title", "body")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "model_name", "user", "organization", "created_at")
    list_filter = ("action",)
    search_fields = ("model_name", "object_id")
    readonly_fields = ("organization", "user", "action", "model_name", "object_id", "changes", "ip_address", "created_at")
