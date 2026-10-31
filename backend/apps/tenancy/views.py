import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import FarmerProfile
from apps.accounts.serializers import UserSerializer
from apps.common.views import TenantModelViewSet
from apps.tenancy.models import FarmAccess, Invitation, Membership, Organization, Role, Team, TeamMembership
from apps.tenancy.serializers import (
    AcceptInvitationSerializer,
    InvitationSerializer,
    MembershipSerializer,
    OrganizationSerializer,
    OrganizationSettingsSerializer,
    RoleSerializer,
    TeamMembershipSerializer,
    TeamSerializer,
)
User = get_user_model()


class OrganizationViewSet(TenantModelViewSet):
    serializer_class = OrganizationSerializer
    search_fields = ("name", "slug", "country")
    ordering_fields = ("name", "created_at")
    http_method_names = ["get", "put", "patch", "head", "options"]

    def get_queryset(self):
        return Organization.objects.filter(
            memberships__user=self.request.user,
            memberships__is_active=True,
        ).distinct()

    def get_permissions(self):
        return [IsAuthenticated()]

    @action(detail=True, methods=["get", "patch", "put"], url_path="settings")
    def org_settings(self, request, pk=None):
        org = self.get_object()
        if request.method == "GET":
            return Response(OrganizationSettingsSerializer(org).data)
        incoming = request.data if isinstance(request.data, dict) else {}
        merged = {**(org.settings or {}), **incoming}
        if merged.get("unit_system") and not merged.get("units"):
            merged["units"] = merged["unit_system"]
        org.settings = merged
        update_fields = ["settings", "updated_at"]
        if incoming.get("timezone"):
            org.timezone = incoming["timezone"]
            update_fields.append("timezone")
        org.save(update_fields=update_fields)
        return Response(OrganizationSettingsSerializer(org).data)


class MembershipViewSet(TenantModelViewSet):
    serializer_class = MembershipSerializer
    filterset_fields = ("is_active", "is_owner", "role")
    search_fields = ("user__email", "user__first_name", "user__last_name")
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return (
            Membership.objects.filter(organization=self.request.organization)
            .select_related("user", "role", "organization")
        )

    def perform_destroy(self, instance):
        if instance.is_owner:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"detail": "Cannot remove the organization owner."})
        instance.delete()


class RoleViewSet(TenantModelViewSet):
    serializer_class = RoleSerializer
    search_fields = ("name",)

    def get_queryset(self):
        return Role.objects.filter(organization=self.request.organization)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.organization)

    def perform_update(self, serializer):
        if serializer.instance.is_system:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"detail": "System roles cannot be modified."})
        serializer.save()

    def perform_destroy(self, instance):
        if instance.is_system:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"detail": "System roles cannot be deleted."})
        instance.delete()


class TeamViewSet(TenantModelViewSet):
    serializer_class = TeamSerializer
    search_fields = ("name", "description")

    def get_queryset(self):
        return Team.objects.filter(organization=self.request.organization).prefetch_related("members")

    def perform_create(self, serializer):
        serializer.save(organization=self.request.organization)

    @action(detail=True, methods=["get", "post"], url_path="members")
    def members(self, request, pk=None):
        team = self.get_object()
        if request.method == "GET":
            qs = TeamMembership.objects.filter(team=team).select_related("user")
            return Response(TeamMembershipSerializer(qs, many=True).data)
        user_id = request.data.get("user_id") or request.data.get("user")
        if not user_id:
            return Response(
                {"detail": "user_id is required", "code": "invalid"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = User.objects.filter(pk=user_id).first()
        if not user:
            return Response({"detail": "User not found", "code": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        if not Membership.objects.filter(user=user, organization=request.organization, is_active=True).exists():
            return Response(
                {"detail": "User is not a member of this organization", "code": "invalid"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        tm, _ = TeamMembership.objects.get_or_create(team=team, user=user)
        return Response(TeamMembershipSerializer(tm).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path="members/(?P<userId>[^/.]+)")
    def remove_member(self, request, pk=None, userId=None):
        team = self.get_object()
        deleted, _ = TeamMembership.objects.filter(team=team, user_id=userId).delete()
        if not deleted:
            return Response({"detail": "Member not found", "code": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class InvitationViewSet(TenantModelViewSet):
    serializer_class = InvitationSerializer
    filterset_fields = ("status", "role")
    search_fields = ("email",)

    def get_permissions(self):
        if getattr(self, "action", None) == "accept":
            return [AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "action", None) == "accept":
            return Invitation.objects.all()
        return Invitation.objects.filter(organization=self.request.organization).select_related(
            "role", "invited_by", "organization"
        )

    def perform_create(self, serializer):
        invitation = serializer.save(
            organization=self.request.organization,
            invited_by=self.request.user,
            token=uuid.uuid4(),
            expires_at=timezone.now() + timedelta(days=7),
            status=Invitation.Status.PENDING,
        )
        self._send_invite_email(invitation)

    def _send_invite_email(self, invitation):
        accept_url = f"{settings.FRONTEND_URL}/invites/{invitation.token}"
        send_mail(
            subject=f"Invitation to join {invitation.organization.name} on AgriNexa",
            message=f"You have been invited to join {invitation.organization.name}. Accept: {accept_url}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[invitation.email],
            fail_silently=True,
        )

    @action(detail=True, methods=["post"], url_path="resend")
    def resend(self, request, pk=None):
        invitation = self.get_object()
        invitation.token = uuid.uuid4()
        invitation.expires_at = timezone.now() + timedelta(days=7)
        invitation.status = Invitation.Status.PENDING
        invitation.save(update_fields=["token", "expires_at", "status", "updated_at"])
        self._send_invite_email(invitation)
        return Response(InvitationSerializer(invitation).data)

    @action(detail=False, methods=["post"], url_path="accept", permission_classes=[AllowAny])
    def accept(self, request):
        serializer = AcceptInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["token"]
        invitation = Invitation.objects.select_related("organization", "role").filter(token=token).first()
        if not invitation:
            return Response({"detail": "Invitation not found", "code": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        if invitation.status == Invitation.Status.REVOKED:
            return Response({"detail": "Invitation has been revoked", "code": "revoked"}, status=status.HTTP_400_BAD_REQUEST)
        if invitation.status == Invitation.Status.ACCEPTED:
            return Response({"detail": "Invitation already accepted", "code": "accepted"}, status=status.HTTP_400_BAD_REQUEST)
        if invitation.is_expired():
            invitation.status = Invitation.Status.EXPIRED
            invitation.save(update_fields=["status", "updated_at"])
            return Response({"detail": "Invitation has expired", "code": "expired"}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user if request.user.is_authenticated else None
        if user and user.email.lower() != invitation.email.lower():
            return Response(
                {"detail": "This invitation was sent to a different email address", "code": "email_mismatch"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user is None and User.objects.filter(email__iexact=invitation.email).exists():
            # Never mint tokens for an existing account off an invite token alone:
            # the inviter knows the token, so this would allow account takeover.
            return Response(
                {"detail": "An account with this email already exists. Sign in, then accept the invitation.",
                 "code": "login_required"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if user is None:
            password = serializer.validated_data.get("password")
            if not password:
                return Response(
                    {"detail": "Password is required to create an account", "code": "password_required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user = User.objects.create_user(
                email=invitation.email.lower(),
                password=password,
                first_name=serializer.validated_data.get("first_name", ""),
                last_name=serializer.validated_data.get("last_name", ""),
            )
            FarmerProfile.objects.get_or_create(user=user)

        with transaction.atomic():
            membership, created = Membership.objects.get_or_create(
                user=user,
                organization=invitation.organization,
                defaults={"role": invitation.role, "is_active": True, "is_owner": False},
            )
            if not created:
                membership.role = invitation.role
                membership.is_active = True
                membership.save(update_fields=["role", "is_active", "updated_at"])
            from apps.farms.models import Farm

            valid_farm_ids = Farm.objects.filter(
                organization=invitation.organization, pk__in=invitation.farm_ids or []
            ).values_list("pk", flat=True)
            for farm_id in valid_farm_ids:
                FarmAccess.objects.get_or_create(
                    user=user,
                    farm_id=farm_id,
                    defaults={"can_view": True, "can_edit": False, "can_manage": False},
                )
            invitation.status = Invitation.Status.ACCEPTED
            invitation.accepted_at = timezone.now()
            invitation.save(update_fields=["status", "accepted_at", "updated_at"])

        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "detail": "Invitation accepted",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
                "organization": OrganizationSerializer(invitation.organization).data,
                "organizations": [
                    OrganizationSerializer(invitation.organization).data,
                ],
            }
        )
