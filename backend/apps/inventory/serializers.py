from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.inventory.models import InventoryItem, StockMovement


class InventoryItemSerializer(serializers.ModelSerializer):
    farm_name = serializers.CharField(source="farm.name", read_only=True, default=None)
    item_name = serializers.CharField(source="name", read_only=True)
    item = serializers.UUIDField(source="id", read_only=True)
    is_low = serializers.BooleanField(read_only=True)
    message = serializers.SerializerMethodField()

    class Meta:
        model = InventoryItem
        fields = (
            "id",
            "item",
            "organization",
            "farm",
            "farm_name",
            "name",
            "item_name",
            "sku",
            "category",
            "unit",
            "quantity",
            "reorder_level",
            "unit_cost",
            "location",
            "lot_number",
            "expires_at",
            "is_low",
            "message",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_at", "updated_at")

    def get_message(self, obj):
        if obj.is_low:
            return f"{obj.name} is at or below reorder level ({obj.quantity} / {obj.reorder_level} {obj.unit})."
        return ""


class StockMovementSerializer(serializers.ModelSerializer):
    created_by_email = serializers.CharField(source="created_by.email", read_only=True, default=None)

    class Meta:
        model = StockMovement
        fields = (
            "id",
            "item",
            "quantity_delta",
            "movement_type",
            "reference",
            "notes",
            "created_by",
            "created_by_email",
            "created_at",
        )
        read_only_fields = ("id", "item", "created_by", "created_at")


class MoveStockSerializer(serializers.Serializer):
    quantity = serializers.DecimalField(max_digits=14, decimal_places=3, required=False)
    quantity_delta = serializers.DecimalField(max_digits=14, decimal_places=3, required=False)
    movement_type = serializers.ChoiceField(choices=StockMovement.MovementType.choices)
    reference = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        delta = attrs.get("quantity_delta")
        if delta is None:
            delta = attrs.get("quantity")
        if delta is None:
            raise serializers.ValidationError({"quantity": "This field is required."})
        attrs["quantity_delta"] = delta
        return attrs

    def save(self, **kwargs):
        item = kwargs["item"]
        user = kwargs.get("user")
        delta = self.validated_data["quantity_delta"]
        movement_type = self.validated_data["movement_type"]
        if movement_type == StockMovement.MovementType.OUT and delta > 0:
            delta = -delta
        with transaction.atomic():
            locked = InventoryItem.objects.select_for_update().get(pk=item.pk)
            locked.quantity = (locked.quantity or Decimal("0")) + delta
            locked.save(update_fields=["quantity", "updated_at"])
            movement = StockMovement.objects.create(
                item=locked,
                quantity_delta=delta,
                movement_type=movement_type,
                reference=self.validated_data.get("reference") or "",
                notes=self.validated_data.get("notes") or "",
                created_by=user,
            )
        return movement, locked
