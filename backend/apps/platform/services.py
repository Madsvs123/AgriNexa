from apps.platform.models import Notification


def create_notification(user, organization, title, body="", category="", link="", payload=None):
    if not user or not organization:
        return None
    return Notification.objects.create(
        user=user,
        organization=organization,
        title=title,
        body=body,
        category=category,
        link=link,
        payload=payload or {},
    )
