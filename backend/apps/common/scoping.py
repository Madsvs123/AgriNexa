"""Shared farm-access resolution.

`OrganizationQuerySetMixin` enforces farm access for every ViewSet, but plain
`APIView` endpoints (global search, aggregates) have to apply the same boundary
by hand. Both now resolve the allowed farms through `accessible_farm_ids` so the
two cannot drift apart.
"""


def accessible_farm_ids(user, organization):
    """Farm IDs `user` may view inside `organization`.

    Returns ``None`` when the user is unrestricted — an owner, a wildcard role,
    or a member with no FarmAccess rows at all. Callers treat ``None`` as "skip
    farm filtering" rather than "no farms", matching FarmAccessPermission, which
    only restricts users who have at least one explicit grant.
    """
    from apps.tenancy.models import FarmAccess, Membership

    if organization is None or user is None or not user.is_authenticated:
        return []

    membership = (
        Membership.objects.filter(user=user, organization=organization, is_active=True)
        .select_related("role")
        .first()
    )
    if membership and (
        membership.is_owner or (membership.role and "*" in (membership.role.permissions or []))
    ):
        return None

    farm_ids = list(
        FarmAccess.objects.filter(
            user=user, farm__organization=organization, can_view=True
        ).values_list("farm_id", flat=True)
    )
    return farm_ids or None
