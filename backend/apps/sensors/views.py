from django.db.models import OuterRef, Q, Subquery
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.views import TenantModelViewSet
from apps.sensors.models import DeviceHealth, Sensor, SensorReading, SensorType
from apps.sensors.serializers import (
    DeviceHealthSerializer,
    IngestReadingSerializer,
    SensorReadingSerializer,
    SensorSerializer,
    SensorTypeSerializer,
)


class SensorTypeViewSet(TenantModelViewSet):
    serializer_class = SensorTypeSerializer
    queryset = SensorType.objects.all()
    search_fields = ("name", "category")
    filterset_fields = ("category",)

    def get_queryset(self):
        org = getattr(self.request, "organization", None)
        return SensorType.objects.filter(Q(organization=org) | Q(organization__isnull=True))

    def perform_create(self, serializer):
        serializer.save(organization=self.request.organization)


class SensorViewSet(TenantModelViewSet):
    serializer_class = SensorSerializer
    queryset = Sensor.objects.all()
    search_fields = ("name", "serial")
    filterset_fields = ("farm", "field", "status", "sensor_type")
    ordering_fields = ("name", "last_seen", "created_at")

    def get_queryset(self):
        latest = SensorReading.objects.filter(sensor=OuterRef("pk")).order_by("-recorded_at")
        return (
            super()
            .get_queryset()
            .select_related("farm", "field", "sensor_type", "health", "organization")
            .annotate(latest_value=Subquery(latest.values("value")[:1]))
        )

    @action(detail=True, methods=["get", "post"], url_path="readings")
    def readings(self, request, pk=None):
        sensor = self.get_object()
        if request.method == "GET":
            qs = SensorReading.objects.filter(sensor=sensor)
            page = self.paginate_queryset(qs)
            if page is not None:
                return self.get_paginated_response(SensorReadingSerializer(page, many=True).data)
            return Response(SensorReadingSerializer(qs[:200], many=True).data)

        serializer = IngestReadingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        recorded_at = data.get("recorded_at") or timezone.now()
        reading = SensorReading.objects.create(
            sensor=sensor,
            value=data["value"],
            recorded_at=recorded_at,
            quality=data.get("quality") or SensorReading.Quality.GOOD,
        )
        sensor.last_seen = timezone.now()
        if sensor.status == Sensor.Status.OFFLINE:
            sensor.status = Sensor.Status.ONLINE
        sensor.save(update_fields=["last_seen", "status", "updated_at"])
        health_fields = {
            k: data[k]
            for k in ("battery_pct", "signal_dbm", "firmware", "temperature_c", "uptime_hours", "last_error")
            if k in data
        }
        if health_fields:
            DeviceHealth.objects.update_or_create(sensor=sensor, defaults=health_fields)
        return Response(SensorReadingSerializer(reading).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "put", "patch"], url_path="health")
    def health(self, request, pk=None):
        sensor = self.get_object()
        health, _ = DeviceHealth.objects.get_or_create(sensor=sensor)
        if request.method == "GET":
            return Response(DeviceHealthSerializer(health).data)
        serializer = DeviceHealthSerializer(health, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="live")
    def live(self, request):
        farm_id = request.query_params.get("farm")
        qs = self.get_queryset()
        if farm_id:
            qs = qs.filter(farm_id=farm_id)
        latest = SensorReading.objects.filter(sensor=OuterRef("pk")).order_by("-recorded_at")
        qs = qs.annotate(
            latest_recorded_at=Subquery(latest.values("recorded_at")[:1]),
        )
        payload = []
        for sensor in qs:
            payload.append(
                {
                    "id": str(sensor.id),
                    "sensor": str(sensor.id),
                    "name": sensor.name,
                    "farm": str(sensor.farm_id),
                    "farm_name": sensor.farm.name if sensor.farm_id else None,
                    "field": str(sensor.field_id) if sensor.field_id else None,
                    "field_name": sensor.field.name if sensor.field_id else None,
                    "status": sensor.status,
                    "value": sensor.latest_value,
                    "last_reading": sensor.latest_value,
                    "last_reading_at": sensor.latest_recorded_at or sensor.last_seen,
                    "unit": sensor.sensor_type.unit,
                    "recorded_at": sensor.latest_recorded_at,
                    "last_seen": sensor.last_seen,
                    "lat": sensor.lat,
                    "lng": sensor.lng,
                }
            )
        return Response(payload)
