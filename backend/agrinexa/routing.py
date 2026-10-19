from django.urls import path

from apps.platform.consumers import NotificationConsumer
from apps.sensors.consumers import SensorStreamConsumer

websocket_urlpatterns = [
    path("ws/sensors/<uuid:farm_id>/", SensorStreamConsumer.as_asgi()),
    path("ws/notifications/", NotificationConsumer.as_asgi()),
]
