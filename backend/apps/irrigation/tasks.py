from datetime import timedelta
from decimal import Decimal

from celery import shared_task
from django.db.models import Q
from django.utils import timezone


@shared_task
def evaluate_irrigation_recommendations():
    from apps.irrigation.models import IrrigationRecommendation, IrrigationZone
    from apps.platform.services import create_notification
    from apps.sensors.models import Sensor, SensorReading

    created = 0
    cutoff = timezone.now() - timedelta(hours=6)
    for zone in IrrigationZone.objects.filter(is_active=True).select_related(
        "farm", "field", "farm__organization"
    ):
        q = Q(irrigation_zone=zone.id)
        if zone.field_id:
            q |= Q(field_id=zone.field_id)
        else:
            q |= Q(farm_id=zone.farm_id)
        sensors = Sensor.objects.filter(q, sensor_type__category="soil_moisture")
        latest_values = []
        for sensor in sensors:
            reading = SensorReading.objects.filter(sensor=sensor).order_by("-recorded_at").first()
            if reading:
                latest_values.append(reading.value)
        if not latest_values:
            continue
        avg = sum(latest_values) / len(latest_values)
        if avg >= zone.moisture_low_threshold:
            continue
        if IrrigationRecommendation.objects.filter(
            zone=zone,
            status=IrrigationRecommendation.Status.PENDING,
            created_at__gte=cutoff,
        ).exists():
            continue
        deficit = zone.moisture_low_threshold - avg
        duration = max(15, min(180, int(30 + Decimal(deficit) * 2)))
        rec = IrrigationRecommendation.objects.create(
            zone=zone,
            reason=(
                f"Average soil moisture {avg:.1f}% is below the "
                f"{zone.moisture_low_threshold}% low threshold."
            ),
            suggested_duration_minutes=duration,
            moisture_avg=avg,
        )
        created += 1
        org = zone.farm.organization
        for membership in org.memberships.filter(is_active=True).select_related("user"):
            create_notification(
                user=membership.user,
                organization=org,
                title=f"Irrigation recommended: {zone.name}",
                body=rec.reason,
                category="irrigation",
                link=f"/irrigation/zones/{zone.id}",
                payload={"recommendation_id": str(rec.id), "zone_id": str(zone.id)},
            )
    return created
