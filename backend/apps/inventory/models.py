from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.common.models import OrganizationScopedModel, TimeStampedModel, UUIDModel


class InventoryItem(UUIDModel, TimeStampedModel, OrganizationScopedModel):
    class Category(models.TextChoices):
        SEEDS = "seeds", _("Seeds")
        FERTILIZERS = "fertilizers", _("Fertilizers")
        CHEMICALS = "chemicals", _("Chemicals")
        FUEL = "fuel", _("Fuel")
        SPARE_PARTS = "spare_parts", _("Spare Parts")
        HARVESTED = "harvested", _("Harvested")

    farm = models.ForeignKey(
        "farms.Farm", on_delete=models.CASCADE, null=True, blank=True, related_name="inventory_items"
    )
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=64, blank=True)
    category = models.CharField(max_length=16, choices=Category.choices, default=Category.SEEDS)
    unit = models.CharField(max_length=32, default="kg")
    quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    reorder_level = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    location = models.CharField(max_length=128, blank=True)
    lot_number = models.CharField(max_length=64, blank=True)
    expires_at = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def is_low(self):
        return self.quantity <= self.reorder_level


class StockMovement(UUIDModel):
    class MovementType(models.TextChoices):
        IN = "in", _("In")
        OUT = "out", _("Out")
        ADJUST = "adjust", _("Adjust")
        HARVEST = "harvest", _("Harvest")

    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="movements")
    quantity_delta = models.DecimalField(max_digits=14, decimal_places=3)
    movement_type = models.CharField(max_length=16, choices=MovementType.choices)
    reference = models.CharField(max_length=128, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_movements",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.movement_type} {self.quantity_delta} {self.item}"
