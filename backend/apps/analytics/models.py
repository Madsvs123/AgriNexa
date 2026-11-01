from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.common.models import OrganizationScopedModel, TimeStampedModel, UUIDModel


class Report(UUIDModel, TimeStampedModel, OrganizationScopedModel):
    class ReportType(models.TextChoices):
        CROP_PROGRESS = "crop_progress", _("Crop Progress")
        YIELD = "yield", _("Yield")
        IRRIGATION = "irrigation", _("Irrigation")
        INVENTORY = "inventory", _("Inventory")
        EQUIPMENT = "equipment", _("Equipment")
        WEATHER = "weather", _("Weather")
        FINANCIAL = "financial", _("Financial")

    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        READY = "ready", _("Ready")
        FAILED = "failed", _("Failed")

    report_type = models.CharField(max_length=32, choices=ReportType.choices)
    params = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    file = models.FileField(upload_to="reports/", null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reports",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.report_type} ({self.status})"
