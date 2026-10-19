MANAGER_PERMISSIONS = [
    "organizations.view",
    "organizations.change",
    "members.view",
    "members.manage",
    "teams.view",
    "teams.manage",
    "invitations.manage",
    "roles.view",
    "farms.view",
    "farms.change",
    "farms.delete",
    "fields.view",
    "fields.change",
    "crops.view",
    "crops.change",
    "sensors.view",
    "sensors.change",
    "irrigation.view",
    "irrigation.change",
    "irrigation.override",
    "scouting.view",
    "scouting.change",
    "weather.view",
    "weather.change",
    "inventory.view",
    "inventory.change",
    "equipment.view",
    "equipment.change",
    "tasks.view",
    "tasks.change",
    "documents.view",
    "documents.change",
    "analytics.view",
]

AGRONOMIST_PERMISSIONS = [
    "organizations.view",
    "members.view",
    "farms.view",
    "fields.view",
    "fields.change",
    "crops.view",
    "crops.change",
    "sensors.view",
    "irrigation.view",
    "irrigation.change",
    "scouting.view",
    "scouting.change",
    "weather.view",
    "inventory.view",
    "tasks.view",
    "tasks.change",
    "analytics.view",
]

OPERATOR_PERMISSIONS = [
    "organizations.view",
    "farms.view",
    "fields.view",
    "sensors.view",
    "sensors.change",
    "irrigation.view",
    "irrigation.change",
    "irrigation.override",
    "scouting.view",
    "scouting.change",
    "weather.view",
    "inventory.view",
    "inventory.change",
    "equipment.view",
    "equipment.change",
    "tasks.view",
    "tasks.change",
]

VIEWER_PERMISSIONS = [
    "organizations.view",
    "farms.view",
    "fields.view",
    "crops.view",
    "sensors.view",
    "irrigation.view",
    "scouting.view",
    "weather.view",
    "inventory.view",
    "equipment.view",
    "tasks.view",
    "analytics.view",
]

DEFAULT_ROLES = {
    "Owner": {"is_system": True, "permissions": ["*"]},
    "Manager": {"is_system": True, "permissions": MANAGER_PERMISSIONS},
    "Agronomist": {"is_system": True, "permissions": AGRONOMIST_PERMISSIONS},
    "Operator": {"is_system": True, "permissions": OPERATOR_PERMISSIONS},
    "Viewer": {"is_system": True, "permissions": VIEWER_PERMISSIONS},
}


def get_user_permissions(user, org):
    if not user or not getattr(user, "is_authenticated", False) or not org:
        return set()
    from apps.tenancy.models import Membership

    membership = (
        Membership.objects.filter(user=user, organization=org, is_active=True)
        .select_related("role")
        .first()
    )
    if not membership:
        return set()
    if membership.is_owner:
        return {"*"}
    perms = membership.role.permissions if membership.role else []
    if "*" in perms:
        return {"*"}
    return set(perms)


def create_default_roles(organization):
    from apps.tenancy.models import Role

    roles = {}
    for name, spec in DEFAULT_ROLES.items():
        role, _ = Role.objects.get_or_create(
            organization=organization,
            name=name,
            defaults={"is_system": spec["is_system"], "permissions": spec["permissions"]},
        )
        roles[name] = role
    return roles


def unique_slug(base):
    from apps.tenancy.models import Organization

    slug = base[:240] or "organization"
    candidate = slug
    i = 2
    while Organization.objects.filter(slug=candidate).exists():
        candidate = f"{slug}-{i}"
        i += 1
    return candidate
