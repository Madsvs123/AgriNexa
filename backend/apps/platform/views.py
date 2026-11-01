from django.db.models import Case, IntegerField, Q, Value, When
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.i18n import language_payload
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


SEARCH_TYPES = ("farms", "fields", "equipment", "inventory", "tasks", "crops")
SEARCH_DEFAULT_LIMIT = 8
SEARCH_MAX_LIMIT = 25


def _match_rank(field, term):
    """Rank exact matches above prefix matches above everything else.

    Plain `icontains` ordering made the palette unusable for short queries —
    typing "n" surfaced whatever the database returned first. Callers order by
    this annotation, then by name.
    """
    return Case(
        When(**{f"{field}__iexact": term}, then=Value(0)),
        When(**{f"{field}__istartswith": term}, then=Value(1)),
        default=Value(2),
        output_field=IntegerField(),
    )


class LanguageDetectView(APIView):
    """Which language this caller should get, and why.

    Unauthenticated on purpose: the sign-in screen needs to render in the
    right language before anyone has credentials.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(language_payload(request))


class SearchView(APIView):
    """Global search backing the command palette.

    Unlike the ViewSets this is a plain APIView, so it applies the organization
    *and* farm-access boundary itself via `accessible_farm_ids`.
    """

    permission_classes = [IsAuthenticated, HasOrganization]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        org = request.organization

        requested = {
            t.strip() for t in (request.query_params.get("type") or "").split(",") if t.strip()
        }
        types = tuple(t for t in SEARCH_TYPES if t in requested) or SEARCH_TYPES

        try:
            limit = int(request.query_params.get("limit") or SEARCH_DEFAULT_LIMIT)
        except (TypeError, ValueError):
            limit = SEARCH_DEFAULT_LIMIT
        limit = max(1, min(limit, SEARCH_MAX_LIMIT))

        payload = {t: [] for t in SEARCH_TYPES}
        if not q:
            return Response({**payload, "query": q, "counts": {t: 0 for t in SEARCH_TYPES}})

        from apps.common.scoping import accessible_farm_ids
        from apps.crops.models import Crop
        from apps.equipment.models import Equipment
        from apps.farms.models import Farm, Field
        from apps.inventory.models import InventoryItem

        farm_ids = accessible_farm_ids(request.user, org)
        restricted = farm_ids is not None

        def ranked(qs, field="name"):
            return qs.annotate(_rank=_match_rank(field, q)).order_by("_rank", field)[:limit]

        def serialize(qs, extra=None):
            rows = []
            for obj in qs:
                row = {"id": str(obj.id), "name": getattr(obj, "name", str(obj))}
                if extra:
                    row.update(extra(obj))
                rows.append(row)
            return rows

        if "farms" in types:
            farms = Farm.objects.filter(organization=org).filter(
                Q(name__icontains=q) | Q(code__icontains=q)
            )
            if restricted:
                farms = farms.filter(id__in=farm_ids)
            payload["farms"] = serialize(ranked(farms), lambda o: {"code": o.code})

        if "fields" in types:
            fields = Field.objects.filter(farm__organization=org).filter(
                Q(name__icontains=q) | Q(code__icontains=q)
            )
            if restricted:
                fields = fields.filter(farm_id__in=farm_ids)
            payload["fields"] = serialize(
                ranked(fields.select_related("farm")),
                lambda o: {"code": o.code, "farm": str(o.farm_id), "farm_name": o.farm.name},
            )

        if "equipment" in types:
            equipment = Equipment.objects.filter(farm__organization=org).filter(
                Q(name__icontains=q)
                | Q(serial__icontains=q)
                | Q(manufacturer__icontains=q)
                | Q(model__icontains=q)
            )
            if restricted:
                equipment = equipment.filter(farm_id__in=farm_ids)
            payload["equipment"] = serialize(
                ranked(equipment.select_related("farm")),
                lambda o: {
                    "equipment_type": o.equipment_type,
                    "status": o.status,
                    "make": o.manufacturer,
                    "model": o.model,
                    "serial": o.serial,
                    "farm_name": o.farm.name,
                },
            )

        if "inventory" in types:
            inventory = InventoryItem.objects.filter(organization=org).filter(
                Q(name__icontains=q) | Q(sku__icontains=q) | Q(lot_number__icontains=q)
            )
            if restricted:
                # Org-wide stock (farm is NULL) stays visible to restricted users.
                inventory = inventory.filter(Q(farm_id__in=farm_ids) | Q(farm__isnull=True))
            payload["inventory"] = serialize(
                ranked(inventory),
                lambda o: {"sku": o.sku, "category": o.category, "unit": o.unit},
            )

        if "tasks" in types:
            tasks = Task.objects.filter(organization=org).filter(
                Q(title__icontains=q) | Q(description__icontains=q)
            )
            if restricted:
                tasks = tasks.filter(Q(farm_id__in=farm_ids) | Q(farm__isnull=True))
            payload["tasks"] = [
                {"id": str(t.id), "name": t.title, "status": t.status, "priority": t.priority}
                for t in ranked(tasks, "title")
            ]

        if "crops" in types:
            # Crops are organization-scoped, with no farm relation to restrict.
            crops = Crop.objects.filter(organization=org, name__icontains=q)
            payload["crops"] = serialize(ranked(crops), lambda o: {"category": o.category})

        payload["query"] = q
        payload["counts"] = {t: len(payload[t]) for t in SEARCH_TYPES}
        return Response(payload)
