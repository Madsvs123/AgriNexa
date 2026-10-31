from celery import shared_task


@shared_task
def check_reorder_levels():
    from apps.inventory.models import InventoryItem
    from apps.platform.models import Notification
    from apps.platform.services import create_notification

    count = 0
    items = InventoryItem.objects.select_related("organization", "farm")
    for item in items:
        if item.quantity > item.reorder_level:
            continue
        count += 1
        for membership in item.organization.memberships.filter(is_active=True).select_related("user"):
            if Notification.objects.filter(
                user=membership.user,
                organization=item.organization,
                category="inventory",
                link=f"/inventory/{item.id}",
                is_read=False,
            ).exists():
                continue
            create_notification(
                user=membership.user,
                organization=item.organization,
                title=f"Low stock: {item.name}",
                body=f"{item.name} is at {item.quantity} {item.unit} (reorder level {item.reorder_level}).",
                category="inventory",
                link=f"/inventory/{item.id}",
                payload={"item_id": str(item.id)},
            )
    return count
