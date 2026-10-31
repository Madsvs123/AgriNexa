import uuid

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken

from apps.tenancy.models import Membership, Organization


class OrganizationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.jwt_auth = JWTAuthentication()

    def _resolve_user(self, request):
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated:
            return user
        # Session auth hasn't identified the user; API clients authenticate
        # with a Bearer token that DRF only verifies later, inside the view.
        try:
            result = self.jwt_auth.authenticate(request)
        except (InvalidToken, AuthenticationFailed):
            return None
        if result is None:
            return None
        return result[0]

    def __call__(self, request):
        request.organization = None
        user = self._resolve_user(request)
        if user is not None and user.is_authenticated:
            org_id = request.headers.get("X-Organization-ID") or request.META.get(
                "HTTP_X_ORGANIZATION_ID"
            )
            memberships = Membership.objects.filter(
                user=user, is_active=True, organization__is_active=True
            ).select_related("organization")
            if org_id:
                try:
                    org_uuid = uuid.UUID(str(org_id))
                except ValueError:
                    org_uuid = None
                if org_uuid:
                    match = memberships.filter(organization_id=org_uuid).first()
                    if match:
                        request.organization = match.organization
            if request.organization is None:
                first = memberships.order_by("-is_owner", "created_at").first()
                if first:
                    request.organization = first.organization
        return self.get_response(request)
