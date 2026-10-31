from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.serializers import UserSerializer
from apps.tenancy.models import FarmAccess, Invitation, Membership, Organization, Role, Team, TeamMembership

User = get_user_model()


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = (
            "id",
            "name",
            "slug",
            "org_type",
            "logo",
            "country",
            "timezone",
            "settings",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "slug", "is_active", "created_at", "updated_at")


class OrganizationSettingsSerializer(serializers.Serializer):
    units = serializers.CharField(required=False)
    unit_system = serializers.CharField(required=False)
    currency = serializers.CharField(required=False)
    moisture_unit = serializers.CharField(required=False)
    timezone = serializers.CharField(required=False)
    season_start_month = serializers.IntegerField(required=False)
    legal_name = serializers.CharField(required=False, allow_blank=True)
    tax_id = serializers.CharField(required=False, allow_blank=True)
    map_default_center = serializers.JSONField(required=False)

    def to_representation(self, instance):
        defaults = Organization.default_settings()
        data = {**defaults, **(instance.settings or {})}
        if data.get("unit_system") and not data.get("units"):
            data["units"] = data["unit_system"]
        if data.get("units") and not data.get("unit_system"):
            data["unit_system"] = data["units"]
        data.setdefault("timezone", instance.timezone or defaults["timezone"])
        return data


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ("id", "organization", "name", "is_system", "permissions", "created_at", "updated_at")
        read_only_fields = ("id", "organization", "is_system", "created_at", "updated_at")


class MembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="user", write_only=True, required=False
    )

    def validate_role(self, role):
        request = self.context.get("request")
        org = getattr(request, "organization", None) if request else None
        if role is not None and org is not None and role.organization_id != org.id:
            raise serializers.ValidationError("Role does not belong to this organization.")
        return role

    def validate(self, attrs):
        if self.instance is None and not attrs.get("user"):
            raise serializers.ValidationError({"user_id": "This field is required."})
        return attrs
    role_name = serializers.CharField(source="role.name", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Membership
        fields = (
            "id",
            "user",
            "user_id",
            "email",
            "organization",
            "role",
            "role_name",
            "is_owner",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "is_owner", "created_at", "updated_at")


class TeamMembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = TeamMembership
        fields = ("id", "team", "user", "user_id", "created_at")
        read_only_fields = ("id", "team", "created_at")


class TeamSerializer(serializers.ModelSerializer):
    members = UserSerializer(many=True, read_only=True)
    member_count = serializers.IntegerField(source="members.count", read_only=True)

    class Meta:
        model = Team
        fields = (
            "id",
            "organization",
            "name",
            "description",
            "members",
            "member_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_at", "updated_at")


class InvitationSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source="role.name", read_only=True)
    invited_by_email = serializers.CharField(source="invited_by.email", read_only=True, default=None)

    class Meta:
        model = Invitation
        # The token is deliberately excluded: it is a bearer credential and is
        # only ever delivered to the invitee by email.
        fields = (
            "id",
            "organization",
            "email",
            "role",
            "role_name",
            "farm_ids",
            "invited_by",
            "invited_by_email",
            "expires_at",
            "accepted_at",
            "status",
            "created_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "invited_by",
            "expires_at",
            "accepted_at",
            "status",
            "created_at",
        )

    def validate_role(self, role):
        request = self.context.get("request")
        org = getattr(request, "organization", None) if request else None
        if role is not None and org is not None and role.organization_id != org.id:
            raise serializers.ValidationError("Role does not belong to this organization.")
        return role

    def validate_farm_ids(self, farm_ids):
        request = self.context.get("request")
        org = getattr(request, "organization", None) if request else None
        if farm_ids and org is not None:
            from apps.farms.models import Farm

            valid = set(
                str(pk) for pk in Farm.objects.filter(organization=org, pk__in=farm_ids).values_list("pk", flat=True)
            )
            invalid = [str(f) for f in farm_ids if str(f) not in valid]
            if invalid:
                raise serializers.ValidationError("Unknown farms for this organization.")
        return farm_ids


class AcceptInvitationSerializer(serializers.Serializer):
    token = serializers.UUIDField()
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    first_name = serializers.CharField(required=False, allow_blank=True, default="")
    last_name = serializers.CharField(required=False, allow_blank=True, default="")


class FarmAccessSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source="user.email", read_only=True)
    farm_name = serializers.CharField(source="farm.name", read_only=True)

    class Meta:
        model = FarmAccess
        fields = (
            "id",
            "user",
            "user_email",
            "farm",
            "farm_name",
            "can_view",
            "can_edit",
            "can_manage",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
