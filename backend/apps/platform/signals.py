from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.platform.models import Notification


@receiver(post_save, sender=Notification)
def broadcast_notification(sender, instance, created, **kwargs):
    if not created:
        return
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    payload = {
        "id": str(instance.id),
        "title": instance.title,
        "body": instance.body,
        "category": instance.category,
        "link": instance.link,
        "is_read": instance.is_read,
        "payload": instance.payload,
        "created_at": instance.created_at.isoformat(),
        "organization": str(instance.organization_id),
    }
    try:
        async_to_sync(channel_layer.group_send)(
            f"user_{instance.user_id}",
            {"type": "notification.message", "payload": payload},
        )
    except Exception:
        return
