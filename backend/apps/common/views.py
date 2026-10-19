from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from apps.common.mixins import OrganizationQuerySetMixin
from apps.common.permissions import HasOrganization


class TenantModelViewSet(OrganizationQuerySetMixin, ModelViewSet):
    permission_classes = [IsAuthenticated, HasOrganization]


class TenantReadOnlyModelViewSet(OrganizationQuerySetMixin, ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, HasOrganization]
