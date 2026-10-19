from apps.tenancy.models import Membership, Organization


class OrganizationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.organization = None
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated:
            org_id = request.headers.get("X-Organization-ID") or request.META.get(
                "HTTP_X_ORGANIZATION_ID"
            )
            memberships = Membership.objects.filter(
                user=user, is_active=True, organization__is_active=True
            ).select_related("organization")
            if org_id:
                match = memberships.filter(organization_id=org_id).first()
                if match:
                    request.organization = match.organization
            if request.organization is None:
                first = memberships.order_by("-is_owner", "created_at").first()
                if first:
                    request.organization = first.organization
        return self.get_response(request)
