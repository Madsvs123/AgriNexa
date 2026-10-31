from django.db.models import Q
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import HasOrganization
from apps.common.views import TenantModelViewSet, TenantReadOnlyModelViewSet
from apps.platform.models import AuditLog, Document, Notification, Task
from apps.platform.serializers import (
    AuditLogSerializer,
    DocumentSerializer,
    NotificationSerializer,
    TaskSerializer,
)


class TaskViewSet(TenantModelViewSet):
    serializer_class = TaskSerializer
    queryset = Task.objects.all()
    search_fields = ("title", "description")
    filterset_fields = ("farm", "field", "status", "priority", "assignee")
    ordering_fields = ("due_date", "created_at", "priority")

    def get_queryset(self):
        return super().get_queryset().select_related("farm", "field", "assignee", "created_by", "organization")


class DocumentViewSet(TenantModelViewSet):
    serializer_class = DocumentSerializer
    queryset = Document.objects.all()
    search_fields = ("title", "category", "notes")
    filterset_fields = ("farm", "category")

    def get_queryset(self):
        return super().get_queryset().select_related("farm", "uploaded_by", "organization")


class NotificationViewSet(TenantModelViewSet):
    serializer_class = NotificationSerializer
    queryset = Notification.objects.all()
    http_method_names = ["get", "post", "patch", "head", "options"]
    filterset_fields = ("is_read", "category")
    ordering_fields = ("created_at",)

    def create(self, request, *args, **kwargs):
        from rest_framework.exceptions import MethodNotAllowed

        raise MethodNotAllowed("POST")

    def get_queryset(self):
        org = getattr(self.request, "organization", None)
        return Notification.objects.filter(
            user=self.request.user, organization=org
        ).select_related("organization")

    @action(detail=True, methods=["post"], url_path="read")
    def read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=["is_read", "updated_at"])
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        updated = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({"updated": updated})


class AuditLogViewSet(TenantReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.all()
    filterset_fields = ("action", "user")
    search_fields = ("model_name", "object_id", "action")
    ordering_fields = ("created_at",)

    def get_queryset(self):
        return super().get_queryset().select_related("user", "organization")


class SearchView(APIView):
    permission_classes = [IsAuthenticated, HasOrganization]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        org = request.organization
        if not q:
            return Response(
                {"farms": [], "fields": [], "equipment": [], "inventory": [], "tasks": [], "crops": []}
            )

        from apps.crops.models import Crop
        from apps.equipment.models import Equipment
        from apps.farms.models import Farm, Field
        from apps.inventory.models import InventoryItem

        def serialize_named(qs, extra=None):
            items = []
            for obj in qs:
                row = {"id": str(obj.id), "name": getattr(obj, "name", str(obj))}
                if extra:
                    row.update(extra(obj))
                items.append(row)
            return items

        farms = Farm.objects.filter(organization=org, name__icontains=q)[:8]
        fields = Field.objects.filter(farm__organization=org, name__icontains=q).select_related("farm")[:8]
        equipment = Equipment.objects.filter(farm__organization=org, name__icontains=q)[:8]
        inventory = InventoryItem.objects.filter(organization=org, name__icontains=q)[:8]
        tasks = Task.objects.filter(organization=org).filter(
            Q(title__icontains=q) | Q(description__icontains=q)
        )[:8]
        crops = Crop.objects.filter(organization=org, name__icontains=q)[:8]

        return Response(
            {
                "farms": serialize_named(farms, lambda o: {"code": o.code}),
                "fields": serialize_named(fields, lambda o: {"farm": str(o.farm_id), "farm_name": o.farm.name}),
                "equipment": serialize_named(
                    equipment,
                    lambda o: {
                        "equipment_type": o.equipment_type,
                        "status": o.status,
                        "make": o.manufacturer,
                        "model": o.model,
                    },
                ),
                "inventory": serialize_named(inventory, lambda o: {"sku": o.sku, "category": o.category}),
                "tasks": [
                    {"id": str(t.id), "name": t.title, "status": t.status, "priority": t.priority} for t in tasks
                ],
                "crops": serialize_named(crops, lambda o: {"category": o.category}),
            }
        )
