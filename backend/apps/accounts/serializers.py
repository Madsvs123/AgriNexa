from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password as django_validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.accounts.models import FarmerProfile

from apps.common.i18n import SUPPORTED_LANGUAGES, normalize_language

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    avatar = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "avatar",
            "is_active",
            "date_joined",
            "last_login_at",
        )
        read_only_fields = ("id", "email", "is_active", "date_joined", "last_login_at")


def _as_list(value):
    if value is None or value == "":
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        return [part.strip() for part in value.split(",") if part.strip()]
    return list(value)


class FarmerProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    phone = serializers.CharField(source="user.phone", required=False, allow_blank=True)
    years_experience = serializers.IntegerField(source="experience_years", required=False)

    class Meta:
        model = FarmerProfile
        fields = (
            "id",
            "user",
            "phone",
            "certifications",
            "experience_years",
            "years_experience",
            "specialties",
            "preferred_language",
            "license_number",
            "bio",
            "emergency_contact",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_preferred_language(self, value):
        """Only languages the product actually ships can be stored.

        This field drives the API's response language, so an unrecognised code
        would silently fall back to English on every request.
        """
        if not value:
            return "en"
        normalized = normalize_language(value)
        if not normalized:
            raise serializers.ValidationError(
                f"Unsupported language. Choose one of: {', '.join(SUPPORTED_LANGUAGES)}."
            )
        return normalized

    def to_representation(self, instance):
        data = super().to_representation(instance)
        certs = data.get("certifications") or []
        specs = data.get("specialties") or []
        data["certifications"] = ", ".join(certs) if isinstance(certs, list) else certs
        data["specialties"] = ", ".join(specs) if isinstance(specs, list) else specs
        return data

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", None)
        if user_data and "phone" in user_data:
            instance.user.phone = user_data["phone"]
            instance.user.save(update_fields=["phone"])
        for key in ("certifications", "specialties"):
            if key in validated_data:
                validated_data[key] = _as_list(validated_data[key])
        return super().update(instance, validated_data)

    def to_internal_value(self, data):
        # Only transform plain dict payloads; inserting a list into a QueryDict
        # (multipart/form data) breaks its value handling.
        if isinstance(data, dict) and not hasattr(data, "getlist"):
            incoming = dict(data)
            for key in ("certifications", "specialties"):
                if key in incoming and isinstance(incoming[key], str):
                    incoming[key] = _as_list(incoming[key])
            return super().to_internal_value(incoming)
        return super().to_internal_value(data)


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True, default="")
    organization_name = serializers.CharField(max_length=255)
    org_type = serializers.ChoiceField(
        choices=("farm", "agribusiness", "consultant", "cooperative", "research"),
        default="farm",
    )
    country = serializers.CharField(max_length=64, required=False, default="")
    timezone = serializers.CharField(max_length=64, required=False, default="UTC")

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def validate_password(self, value):
        try:
            django_validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    @transaction.atomic
    def create(self, validated_data):
        from apps.sensors.defaults import ensure_builtin_sensor_types
        from apps.tenancy.models import Membership, Organization
        from apps.tenancy.services import create_default_roles, unique_slug

        password = validated_data.pop("password")
        org_name = validated_data.pop("organization_name")
        org_type = validated_data.pop("org_type")
        country = validated_data.pop("country", "")
        tz = validated_data.pop("timezone", "UTC")

        user = User.objects.create_user(password=password, **validated_data)
        org = Organization.objects.create(
            name=org_name,
            slug=unique_slug(slugify(org_name) or "organization"),
            org_type=org_type,
            country=country,
            timezone=tz,
            settings=Organization.default_settings(),
        )
        roles = create_default_roles(org)
        Membership.objects.create(
            user=user,
            organization=org,
            role=roles["Owner"],
            is_owner=True,
            is_active=True,
        )
        FarmerProfile.objects.create(user=user)
        ensure_builtin_sensor_types()
        return {"user": user, "organization": org}


class LoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        email = attrs.get(self.username_field)
        if isinstance(email, str):
            attrs[self.username_field] = email.lower()
        data = super().validate(attrs)
        self.user.last_login_at = timezone.now()
        self.user.save(update_fields=["last_login_at"])
        data["user"] = UserSerializer(self.user, context=self.context).data
        from apps.tenancy.serializers import OrganizationSerializer
        from apps.tenancy.models import Membership

        memberships = (
            Membership.objects.filter(user=self.user, is_active=True, organization__is_active=True)
            .select_related("organization", "role")
        )
        data["organizations"] = OrganizationSerializer(
            [m.organization for m in memberships], many=True, context=self.context
        ).data
        return data


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()
