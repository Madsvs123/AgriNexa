from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.sensors.views import SensorTypeViewSet, SensorViewSet

router = DefaultRouter()
router.register("sensor-types", SensorTypeViewSet, basename="sensor-type")
router.register("sensors", SensorViewSet, basename="sensor")

urlpatterns = [
    path("", include(router.urls)),
]
