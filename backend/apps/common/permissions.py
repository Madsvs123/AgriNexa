from rest_framework import permissions


def _get_user_permissions(user, organization):
    from apps.tenancy.permissions import get_user_permissions

    return get_user_permissions(user, organization)


class HasOrganization(permissions.BasePermission):
    message = "An organization context is required."

    def has_permission(self, request, view):
        return bool(getattr(request, "organization", None))


class HasPermission(permissions.BasePermission):
    """Use as `HasPermission("farms.change")` or set `required_permission` on the view."""

    def __init__(self, codename=None):
        self.codename = codename

    def __call__(self):
        return self

    def has_permission(self, request, view):
        codename = self.codename or getattr(view, "required_permission", None)
        if not codename:
            return True
        perms = _get_user_permissions(request.user, getattr(request, "organization", None))
        return "*" in perms or codename in perms


def _resolve_farm(obj):
    if obj is None:
        return None
    if obj.__class__.__name__ == "Farm":
        return obj
    for attr in ("farm", "field", "sensor", "zone", "equipment", "item", "station", "report"):
        if hasattr(obj, attr):
            related = getattr(obj, attr)
            if related is None:
                continue
            if attr == "farm":
                return related
            nested = _resolve_farm(related)
            if nested is not None:
                return nested
    if hasattr(obj, "crop_plan") and obj.crop_plan is not None:
        return _resolve_farm(obj.crop_plan)
    return None


class FarmAccessPermission(permissions.BasePermission):
    message = "You do not have access to this farm."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        from apps.tenancy.models import FarmAccess

        org = getattr(request, "organization", None)
        perms = _get_user_permissions(request.user, org)
        if "*" in perms:
            return True

        farm = _resolve_farm(obj)
        if farm is None:
            return True

        access = FarmAccess.objects.filter(user=request.user, farm=farm).first()
        if access is None:
            has_restricted_scope = FarmAccess.objects.filter(
                user=request.user, farm__organization=org
            ).exists()
            return not has_restricted_scope

        if request.method in permissions.SAFE_METHODS:
            return access.can_view
        if request.method == "DELETE":
            return access.can_manage
        return access.can_edit
