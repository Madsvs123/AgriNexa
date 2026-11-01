from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.common.models import TimeStampedModel, UUIDModel


class Equipment(UUIDModel, TimeStampedModel):
    class EquipmentType(models.TextChoices):
        TRACTOR = "tractor", _("Tractor")
        HARVESTER = "harvester", _("Harvester")
        IRRIGATION_SYSTEM = "irrigation_system", _("Irrigation System")
        SPRAYER = "sprayer", _("Sprayer")
        PLANTER = "planter", _("Planter")
        DRONE = "drone", _("Drone")
        TRUCK = "truck", _("Truck")
        OTHER = "other", _("Other")

    class Status(models.TextChoices):
        OPERATIONAL = "operational", _("Operational")
        MAINTENANCE = "maintenance", _("Maintenance")
        BROKEN = "broken", _("Broken")
        RETIRED = "retired", _("Retired")

    farm = models.ForeignKey("farms.Farm", on_delete=models.CASCADE, related_name="equipment")
    name = models.CharField(max_length=128)
    equipment_type = models.CharField(max_length=32, choices=EquipmentType.choices, default=EquipmentType.OTHER)
    manufacturer = models.CharField(max_length=128, blank=True)
    model = models.CharField(max_length=128, blank=True)
    year = models.PositiveIntegerField(null=True, blank=True)
    serial = models.CharField(max_length=128, blank=True)
    hours = models.DecimalField(max_digits=10, decimal_places=1, default=0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPERATIONAL)
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    fuel_capacity = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)
    assigned_field = models.ForeignKey(
        "farms.Field", on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_equipment"
    )

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "equipment"

    def __str__(self):
        return self.name


class MaintenanceSchedule(UUIDModel, TimeStampedModel):
    equipment = models.ForeignKey(Equipment, on_delete=models.CASCADE, related_name="maintenance_schedules")
    title = models.CharField(max_length=128)
    interval_hours = models.PositiveIntegerField(default=100)
    last_service_at = models.DateField(null=True, blank=True)
    last_service_hours = models.DecimalField(max_digits=10, decimal_places=1, default=0)
    next_due_hours = models.DecimalField(max_digits=10, decimal_places=1, default=100)
    next_due_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["next_due_hours"]

    def __str__(self):
        return f"{self.equipment} {self.title}"


class FuelLog(UUIDModel, TimeStampedModel):
    equipment = models.ForeignKey(Equipment, on_delete=models.CASCADE, related_name="fuel_logs")
    gallons = models.DecimalField(max_digits=10, decimal_places=2)
    cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    hours = models.DecimalField(max_digits=10, decimal_places=1, null=True, blank=True)
    logged_at = models.DateTimeField()
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-logged_at"]

    def __str__(self):
        return f"{self.equipment} {self.gallons} gal"


class Breakdown(UUIDModel, TimeStampedModel):
    class Severity(models.TextChoices):
        LOW = "low", _("Low")
        MEDIUM = "medium", _("Medium")
        HIGH = "high", _("High")
        CRITICAL = "critical", _("Critical")

    class Status(models.TextChoices):
        OPEN = "open", _("Open")
        IN_PROGRESS = "in_progress", _("In Progress")
        RESOLVED = "resolved", _("Resolved")

    equipment = models.ForeignKey(Equipment, on_delete=models.CASCADE, related_name="breakdowns")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    severity = models.CharField(max_length=16, choices=Severity.choices, default=Severity.MEDIUM)
    reported_at = models.DateTimeField()
    resolved_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reported_breakdowns",
    )

    class Meta:
        ordering = ["-reported_at"]

    def __str__(self):
        return self.title


class ServiceHistory(UUIDModel, TimeStampedModel):
    equipment = models.ForeignKey(Equipment, on_delete=models.CASCADE, related_name="service_history")
    service_date = models.DateField()
    description = models.TextField()
    cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    hours_at_service = models.DecimalField(max_digits=10, decimal_places=1, default=0)
    vendor = models.CharField(max_length=128, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-service_date"]
        verbose_name_plural = "service history"

    def __str__(self):
        return f"{self.equipment} {self.service_date}"
