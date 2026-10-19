from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.inventory.views import InventoryItemViewSet

router = DefaultRouter()
router.register("inventory", InventoryItemViewSet, basename="inventory")

urlpatterns = [
    path("", include(router.urls)),
]
