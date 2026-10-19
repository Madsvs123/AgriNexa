from datetime import timedelta

from celery import shared_task
from django.utils import timezone


@shared_task
def check_sensor_health():
    from apps.platform.services import create_notification
    from apps.sensors.models import Sensor

    cutoff = timezone.now() - timedelta(minutes=30)
    stale = Sensor.objects.filter(status=Sensor.Status.ONLINE).filter(
        models_last_seen_before(cutoff)
    )
    count = 0
    for sensor in stale.select_related("farm", "organization"):
        sensor.status = Sensor.Status.OFFLINE
        sensor.save(update_fields=["status", "updated_at"])
        count += 1
        for membership in sensor.organization.memberships.filter(is_active=True).select_related("user"):
            create_notification(
                user=membership.user,
                organization=sensor.organization,
                title=f"Sensor offline: {sensor.name}",
                body=f"{sensor.name} on {sensor.farm.name} has not reported in 30 minutes.",
                category="sensor",
                link=f"/sensors/{sensor.id}",
                payload={"sensor_id": str(sensor.id), "farm_id": str(sensor.farm_id)},
            )
    return count


def models_last_seen_before(cutoff):
    from django.db.models import Q

    return Q(last_seen__isnull=True) | Q(last_seen__lt=cutoff)
