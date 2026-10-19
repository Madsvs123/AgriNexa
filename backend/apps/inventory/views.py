from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.views import TenantModelViewSet
from apps.inventory.models import InventoryItem
from apps.inventory.serializers import InventoryItemSerializer, MoveStockSerializer, StockMovementSerializer


class InventoryItemViewSet(TenantModelViewSet):
    serializer_class = InventoryItemSerializer
    queryset = InventoryItem.objects.all()
    search_fields = ("name", "sku", "lot_number", "location")
    filterset_fields = ("farm", "category")
    ordering_fields = ("name", "quantity", "expires_at")

    def get_queryset(self):
        return super().get_queryset().select_related("farm", "organization")

    @action(detail=True, methods=["post"], url_path="move")
    def move(self, request, pk=None):
        item = self.get_object()
        serializer = MoveStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        movement, item = serializer.save(item=item, user=request.user)
        return Response(
            {
                "movement": StockMovementSerializer(movement).data,
                "item": InventoryItemSerializer(item).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="alerts")
    def alerts(self, request):
        qs = self.get_queryset()
        low = [item for item in qs if item.quantity <= item.reorder_level]
        return Response(InventoryItemSerializer(low, many=True).data)
