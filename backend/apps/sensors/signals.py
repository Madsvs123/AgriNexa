from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.sensors.models import SensorReading


@receiver(post_save, sender=SensorReading)
def broadcast_sensor_reading(sender, instance, created, **kwargs):
    if not created:
        return
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    farm_id = instance.sensor.farm_id
    unit = None
    try:
        unit = instance.sensor.sensor_type.unit if instance.sensor.sensor_type_id else None
    except Exception:
        unit = None
    payload = {
        "id": str(instance.id),
        "sensor": str(instance.sensor_id),
        "sensor_name": instance.sensor.name,
        "farm": str(farm_id),
        "field": str(instance.sensor.field_id) if instance.sensor.field_id else None,
        "value": str(instance.value),
        "unit": unit,
        "recorded_at": instance.recorded_at.isoformat(),
        "quality": instance.quality,
    }
    try:
        async_to_sync(channel_layer.group_send)(
            f"farm_{farm_id}",
            {"type": "sensor.reading", "payload": payload},
        )
    except Exception:
        return
