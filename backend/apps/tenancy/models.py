import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedModel, UUIDModel


class Organization(UUIDModel, TimeStampedModel):
    class OrgType(models.TextChoices):
        FARM = "farm", "Farm"
        AGRIBUSINESS = "agribusiness", "Agribusiness"
        CONSULTANT = "consultant", "Consultant"
        COOPERATIVE = "cooperative", "Cooperative"
        RESEARCH = "research", "Research"

    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, max_length=255)
    org_type = models.CharField(max_length=32, choices=OrgType.choices, default=OrgType.FARM)
    logo = models.ImageField(upload_to="org_logos/", blank=True, null=True)
    country = models.CharField(max_length=64, blank=True)
    timezone = models.CharField(max_length=64, default="UTC")
    settings = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    @staticmethod
    def default_settings():
        return {
            "units": "imperial",
            "unit_system": "imperial",
            "currency": "USD",
            "moisture_unit": "percent",
            "timezone": "America/Chicago",
            "season_start_month": 3,
            "legal_name": "",
            "tax_id": "",
            "map_default_center": {"lat": 41.6, "lng": -93.6},
        }

    def save(self, *args, **kwargs):
        if not self.settings:
            self.settings = self.default_settings()
        super().save(*args, **kwargs)


class Role(UUIDModel, TimeStampedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="roles")
    name = models.CharField(max_length=64)
    is_system = models.BooleanField(default=False)
    permissions = models.JSONField(default=list, blank=True)

    class Meta:
        unique_together = ("organization", "name")
        ordering = ["name"]

    def __str__(self):
        return f"{self.organization.name} / {self.name}"


class Membership(UUIDModel, TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="memberships")
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name="memberships")
    is_owner = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("user", "organization")
        ordering = ["-is_owner", "created_at"]

    def __str__(self):
        return f"{self.user} @ {self.organization}"


class Team(UUIDModel, TimeStampedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="teams")
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through="TeamMembership",
        related_name="teams",
        blank=True,
    )

    class Meta:
        unique_together = ("organization", "name")
        ordering = ["name"]

    def __str__(self):
        return self.name


class TeamMembership(UUIDModel, TimeStampedModel):
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="team_memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="team_memberships"
    )

    class Meta:
        unique_together = ("team", "user")

    def __str__(self):
        return f"{self.user} in {self.team}"


class Invitation(UUIDModel, TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        EXPIRED = "expired", "Expired"
        REVOKED = "revoked", "Revoked"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="invitations")
    email = models.EmailField()
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name="invitations")
    farm_ids = models.JSONField(default=list, blank=True)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="sent_invitations",
    )
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.email} -> {self.organization}"

    def is_expired(self):
        return timezone.now() >= self.expires_at


class FarmAccess(UUIDModel, TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="farm_access")
    farm = models.ForeignKey("farms.Farm", on_delete=models.CASCADE, related_name="access_grants")
    can_view = models.BooleanField(default=True)
    can_edit = models.BooleanField(default=False)
    can_manage = models.BooleanField(default=False)

    class Meta:
        unique_together = ("user", "farm")

    def __str__(self):
        return f"{self.user} access {self.farm}"
