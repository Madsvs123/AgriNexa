from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.tenancy.views import (
    InvitationViewSet,
    MembershipViewSet,
    OrganizationViewSet,
    RoleViewSet,
    TeamViewSet,
)

router = DefaultRouter()
router.register("organizations", OrganizationViewSet, basename="organization")
router.register("members", MembershipViewSet, basename="member")
router.register("teams", TeamViewSet, basename="team")
router.register("roles", RoleViewSet, basename="role")
router.register("invitations", InvitationViewSet, basename="invitation")

urlpatterns = [
    path("", include(router.urls)),
]
