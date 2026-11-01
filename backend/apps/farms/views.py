from django.db.models import Count
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.views import TenantModelViewSet
from apps.farms import elevation, geometry
from apps.farms.models import CropHistory, Farm, Field, FieldNote, Plot, Region, SoilLayer
from apps.farms.serializers import (
    CropHistorySerializer,
    FarmSerializer,
    FieldNoteSerializer,
    FieldSerializer,
    PlotSerializer,
    RegionSerializer,
    SoilLayerSerializer,
)
from apps.tenancy.models import FarmAccess
from apps.tenancy.serializers import FarmAccessSerializer


class RegionViewSet(TenantModelViewSet):
    serializer_class = RegionSerializer
    search_fields = ("name", "code")
    filterset_fields = ("parent",)
    ordering_fields = ("name", "created_at")

    def get_queryset(self):
        return super().get_queryset().select_related("parent", "organization")

    queryset = Region.objects.all()


class FarmViewSet(TenantModelViewSet):
    serializer_class = FarmSerializer
    search_fields = ("name", "code", "address", "contact_name")
    filterset_fields = ("status", "region")
    ordering_fields = ("name", "total_acres", "created_at")

    queryset = Farm.objects.all()

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .select_related("region", "organization")
            .annotate(field_count=Count("fields"))
        )

    @action(detail=True, methods=["get", "put"], url_path="access")
    def access(self, request, pk=None):
        farm = self.get_object()
        if request.method == "GET":
            grants = FarmAccess.objects.filter(farm=farm).select_related("user", "farm")
            return Response(FarmAccessSerializer(grants, many=True).data)

        from apps.tenancy.models import Membership

        member_ids = set(
            str(pk)
            for pk in Membership.objects.filter(
                organization=farm.organization, is_active=True
            ).values_list("user_id", flat=True)
        )
        data = request.data if isinstance(request.data, list) else [request.data]
        results = []
        for item in data:
            user_id = item.get("user") or item.get("user_id")
            if not user_id or str(user_id) not in member_ids:
                continue
            grant, _ = FarmAccess.objects.update_or_create(
                user_id=user_id,
                farm=farm,
                defaults={
                    "can_view": item.get("can_view", True),
                    "can_edit": item.get("can_edit", False),
                    "can_manage": item.get("can_manage", False),
                },
            )
            results.append(grant)
        return Response(FarmAccessSerializer(results, many=True).data)


class FieldViewSet(TenantModelViewSet):
    serializer_class = FieldSerializer
    search_fields = ("name", "code", "soil_type")
    filterset_fields = ("farm", "status", "irrigation_type")
    ordering_fields = ("name", "acres", "created_at")
    queryset = Field.objects.all()

    def get_queryset(self):
        return super().get_queryset().select_related("farm", "current_crop_plan", "current_crop_plan__crop")

    @action(detail=True, methods=["get"], url_path="elevation")
    def elevation(self, request, pk=None):
        field = self.get_object()
        if not geometry.has_boundary(field.boundary):
            return Response(
                {"detail": "Field has no boundary to estimate elevation for.", "code": "no_boundary"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        refresh = request.query_params.get("refresh") in ("1", "true", "yes")
        if field.elevation_cache and not refresh:
            return Response(field.elevation_cache)
        estimate = elevation.estimate_elevation(field.boundary)
        field.elevation_cache = estimate
        field.save(update_fields=["elevation_cache", "updated_at"])
        return Response(estimate)

    @action(detail=True, methods=["get", "post"], url_path="history")
    def history(self, request, pk=None):
        field = self.get_object()
        if request.method == "GET":
            qs = CropHistory.objects.filter(field=field)
            return Response(CropHistorySerializer(qs, many=True).data)
        serializer = CropHistorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(field=field)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PlotViewSet(TenantModelViewSet):
    serializer_class = PlotSerializer
    search_fields = ("name", "notes")
    filterset_fields = ("field",)
    queryset = Plot.objects.all()

    def get_queryset(self):
        return super().get_queryset().select_related("field", "field__farm")


class SoilLayerViewSet(TenantModelViewSet):
    serializer_class = SoilLayerSerializer
    search_fields = ("name", "soil_type", "notes")
    filterset_fields = ("field", "soil_type")
    queryset = SoilLayer.objects.all()

    def get_queryset(self):
        return super().get_queryset().select_related("field", "field__farm")


class FieldNoteViewSet(TenantModelViewSet):
    serializer_class = FieldNoteSerializer
    search_fields = ("content",)
    filterset_fields = ("field", "note_type", "author")
    queryset = FieldNote.objects.all()

    def get_queryset(self):
        return super().get_queryset().select_related("field", "author", "field__farm")
