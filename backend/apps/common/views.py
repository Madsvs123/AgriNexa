from django.db import models
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from apps.common.mixins import OrganizationQuerySetMixin
from apps.common.permissions import FarmAccessPermission, HasOrganization

_ORG_HOP_ATTRS = ("farm", "field", "sensor", "zone", "equipment", "item", "station", "crop", "crop_plan", "report", "season", "role", "team")


def _instance_organization_id(obj, depth=0):
    """Best-effort resolution of the owning organization of a model instance."""
    if obj is None or depth > 4 or not isinstance(obj, models.Model):
        return None
    org_id = getattr(obj, "organization_id", None)
    if org_id is not None:
        return org_id
    for attr in _ORG_HOP_ATTRS:
        if hasattr(obj, attr):
            related = getattr(obj, attr)
            if isinstance(related, models.Model):
                found = _instance_organization_id(related, depth + 1)
                if found is not None:
                    return found
    return None


class OrgScopedWriteMixin:
    """Reject writes that reference another organization's records via FKs."""

    def _check_org_scope(self, serializer):
        org = getattr(self.request, "organization", None)
        if org is None:
            return
        for name, value in serializer.validated_data.items():
            values = value if isinstance(value, (list, tuple)) else [value]
            for item in values:
                owner = _instance_organization_id(item)
                if owner is not None and owner != org.id:
                    raise ValidationError({name: "Object does not belong to this organization."})

    def perform_create(self, serializer):
        self._check_org_scope(serializer)
        super().perform_create(serializer)

    def perform_update(self, serializer):
        self._check_org_scope(serializer)
        super().perform_update(serializer)


class TenantModelViewSet(OrgScopedWriteMixin, OrganizationQuerySetMixin, ModelViewSet):
    permission_classes = [IsAuthenticated, HasOrganization, FarmAccessPermission]


class TenantReadOnlyModelViewSet(OrganizationQuerySetMixin, ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, HasOrganization, FarmAccessPermission]
