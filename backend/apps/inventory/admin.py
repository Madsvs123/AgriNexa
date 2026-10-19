from django.contrib import admin

from .models import InventoryItem, StockMovement


class StockMovementInline(admin.TabularInline):
    model = StockMovement
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ("name", "sku", "category", "quantity", "reorder_level", "organization")
    list_filter = ("category",)
    search_fields = ("name", "sku", "lot_number")
    inlines = [StockMovementInline]


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("item", "movement_type", "quantity_delta", "created_by", "created_at")
    list_filter = ("movement_type",)
