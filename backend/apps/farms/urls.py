from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.farms.views import (
    FarmViewSet,
    FieldNoteViewSet,
    FieldViewSet,
    PlotViewSet,
    RegionViewSet,
    SoilLayerViewSet,
)

router = DefaultRouter()
router.register("regions", RegionViewSet, basename="region")
router.register("farms", FarmViewSet, basename="farm")
router.register("fields", FieldViewSet, basename="field")
router.register("plots", PlotViewSet, basename="plot")
router.register("soil-layers", SoilLayerViewSet, basename="soil-layer")
router.register("field-notes", FieldNoteViewSet, basename="field-note")

urlpatterns = [
    path("", include(router.urls)),
]
