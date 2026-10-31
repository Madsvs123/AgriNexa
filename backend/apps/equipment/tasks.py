from celery import shared_task


@shared_task
def flag_due_maintenance():
    from apps.equipment.models import MaintenanceSchedule
    from apps.platform.models import Notification
    from apps.platform.services import create_notification

    count = 0
    due = MaintenanceSchedule.objects.filter(is_active=True).select_related(
        "equipment", "equipment__farm", "equipment__farm__organization"
    )
    for schedule in due:
        equipment = schedule.equipment
        if equipment.hours < schedule.next_due_hours:
            continue
        count += 1
        org = equipment.farm.organization
        for membership in org.memberships.filter(is_active=True).select_related("user"):
            if Notification.objects.filter(
                user=membership.user,
                organization=org,
                category="equipment",
                link=f"/equipment/{equipment.id}",
                is_read=False,
            ).exists():
                continue
            create_notification(
                user=membership.user,
                organization=org,
                title=f"Maintenance due: {equipment.name}",
                body=f"{schedule.title} is due at {schedule.next_due_hours} hours (currently {equipment.hours}).",
                category="equipment",
                link=f"/equipment/{equipment.id}",
                payload={"equipment_id": str(equipment.id), "schedule_id": str(schedule.id)},
            )
        if equipment.status == equipment.Status.OPERATIONAL:
            equipment.status = equipment.Status.MAINTENANCE
            equipment.save(update_fields=["status", "updated_at"])
    return count
