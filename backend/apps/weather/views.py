from datetime import datetime, time, timedelta
from collections import defaultdict

from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import HasOrganization
from apps.common.views import TenantModelViewSet
from apps.sensors.models import Sensor, SensorReading
from apps.weather.models import WeatherAlert, WeatherForecast, WeatherReading, WeatherStation
from apps.weather.serializers import (
    WeatherAlertSerializer,
    WeatherForecastSerializer,
    WeatherReadingSerializer,
    WeatherStationSerializer,
)


def _c_to_f(value):
    if value is None:
        return None
    return round(float(value) * 9 / 5 + 32, 1)


def _mm_to_in(value):
    if value is None:
        return None
    return round(float(value) / 25.4, 2)


def _kph_to_mph(value):
    if value is None:
        return None
    return round(float(value) / 1.609, 1)


def _farm_from_request(request):
    farm_id = request.query_params.get("farm")
    from apps.farms.models import Farm

    farms = Farm.objects.filter(organization=request.organization)
    if farm_id:
        try:
            return farms.filter(pk=farm_id).first()
        except (ValueError, DjangoValidationError):
            return farms.first()
    return farms.first()


class WeatherStationViewSet(TenantModelViewSet):
    serializer_class = WeatherStationSerializer
    queryset = WeatherStation.objects.all()
    search_fields = ("name",)
    filterset_fields = ("farm", "source", "is_active")

    def get_queryset(self):
        return super().get_queryset().select_related("farm", "sensor")


class WeatherCurrentView(APIView):
    permission_classes = [IsAuthenticated, HasOrganization]

    def get(self, request):
        farm = _farm_from_request(request)
        if not farm:
            return Response({"detail": "No farm found", "code": "not_found"}, status=404)
        station = farm.weather_stations.filter(is_active=True).first()
        reading = None
        if station:
            reading = WeatherReading.objects.filter(station=station).order_by("-recorded_at").first()
        temp_c = reading.temperature_c if reading else None
        humidity = reading.humidity_pct if reading else None
        wind_kph = reading.wind_kph if reading else None
        rain_mm = reading.rainfall_mm if reading else 0
        forecast = (
            WeatherForecast.objects.filter(farm=farm, forecast_date=timezone.now().date()).first()
            if farm
            else None
        )
        conditions = forecast.conditions if forecast else "Observed"
        return Response(
            {
                "farm": str(farm.id),
                "farm_name": farm.name,
                "station": WeatherStationSerializer(station).data if station else None,
                "current": WeatherReadingSerializer(reading).data if reading else None,
                "temperature_c": temp_c,
                "temperature_f": _c_to_f(temp_c) or 0,
                "humidity": humidity or 0,
                "wind_mph": _kph_to_mph(wind_kph) or 0,
                "wind_kph": wind_kph,
                "conditions": conditions,
                "rainfall_in": _mm_to_in(rain_mm) or 0,
                "rainfall_mm": rain_mm,
                "feels_like": _c_to_f(temp_c) or 0,
                "updated_at": reading.recorded_at if reading else None,
            }
        )


class WeatherForecastView(APIView):
    permission_classes = [IsAuthenticated, HasOrganization]

    def get(self, request):
        farm = _farm_from_request(request)
        if not farm:
            return Response([])
        qs = WeatherForecast.objects.filter(farm=farm, forecast_date__gte=timezone.now().date())
        payload = []
        for item in qs:
            payload.append(
                {
                    **WeatherForecastSerializer(item).data,
                    "date": item.forecast_date,
                    "high": _c_to_f(item.high_c) or 0,
                    "low": _c_to_f(item.low_c) or 0,
                    "precip_chance": item.precip_chance or 0,
                    "rainfall_in": _mm_to_in(item.precip_mm) or 0,
                    "wind_mph": _kph_to_mph(item.wind_kph) or 0,
                    "conditions": item.conditions,
                }
            )
        return Response(payload)


def _parse_dt_param(value):
    if not value:
        return None
    dt = parse_datetime(value)
    if dt is None:
        day = parse_date(value)
        if day is None:
            return None
        dt = datetime.combine(day, time.min)
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt)
    return dt


class WeatherHistoryView(APIView):
    permission_classes = [IsAuthenticated, HasOrganization]

    def get(self, request):
        farm = _farm_from_request(request)
        if not farm:
            return Response([])
        try:
            days = int(request.query_params.get("days", 14))
        except (TypeError, ValueError):
            days = 14
        since = timezone.now() - timedelta(days=days)
        start = _parse_dt_param(request.query_params.get("start"))
        end = _parse_dt_param(request.query_params.get("end"))
        qs = WeatherReading.objects.filter(
            station__farm=farm, recorded_at__gte=start or since
        ).select_related("station")
        if end:
            qs = qs.filter(recorded_at__lte=end)
        by_day = defaultdict(list)
        for reading in qs:
            by_day[reading.recorded_at.date()].append(reading)
        payload = []
        for day in sorted(by_day.keys()):
            readings = by_day[day]
            temps = [float(r.temperature_c) for r in readings if r.temperature_c is not None]
            rain = sum(float(r.rainfall_mm or 0) for r in readings)
            payload.append(
                {
                    "date": day.isoformat(),
                    "temp_high": _c_to_f(max(temps)) if temps else None,
                    "temp_low": _c_to_f(min(temps)) if temps else None,
                    "rainfall_mm": rain,
                    "rainfall_in": _mm_to_in(rain),
                }
            )
        return Response(payload)


class WeatherAlertViewSet(TenantModelViewSet):
    serializer_class = WeatherAlertSerializer
    queryset = WeatherAlert.objects.all()
    filterset_fields = ("farm", "alert_type", "severity", "is_active")
    search_fields = ("title", "message")

    def get_queryset(self):
        return super().get_queryset().select_related("farm")


class WeatherRecommendationsView(APIView):
    permission_classes = [IsAuthenticated, HasOrganization]

    def get(self, request):
        farm = _farm_from_request(request)
        if not farm:
            return Response([])
        recommendations = []
        forecasts = list(
            WeatherForecast.objects.filter(farm=farm, forecast_date__gte=timezone.now().date())[:5]
        )
        if any(f.low_c is not None and f.low_c < 2 for f in forecasts):
            recommendations.append(
                {
                    "id": "frost",
                    "category": "frost",
                    "title": "Frost risk",
                    "body": "Protect sensitive crops from frost over the next few nights.",
                }
            )
        if any(f.high_c is not None and f.high_c > 35 for f in forecasts):
            recommendations.append(
                {
                    "id": "heat",
                    "category": "heat",
                    "title": "Heat stress",
                    "body": "High heat expected. Increase irrigation frequency and avoid midday spraying.",
                }
            )
        if any(f.precip_chance and f.precip_chance >= 60 for f in forecasts):
            recommendations.append(
                {
                    "id": "rain",
                    "category": "rain",
                    "title": "Rain likely",
                    "body": "Rain is likely. Consider delaying fertilizer or pesticide applications.",
                }
            )

        sensors = Sensor.objects.filter(farm=farm, sensor_type__category="soil_moisture")
        moisture_values = []
        for sensor in sensors:
            reading = SensorReading.objects.filter(sensor=sensor).order_by("-recorded_at").first()
            if reading:
                moisture_values.append(reading.value)
        if moisture_values:
            avg = sum(moisture_values) / len(moisture_values)
            if avg < 20:
                recommendations.append(
                    {
                        "id": "irrigation-low",
                        "category": "irrigation",
                        "title": "Irrigate soon",
                        "body": f"Average soil moisture is {avg:.1f}%. Irrigate soon.",
                    }
                )
            elif avg > 45:
                recommendations.append(
                    {
                        "id": "irrigation-hold",
                        "category": "irrigation",
                        "title": "Hold irrigation",
                        "body": f"Soil moisture is ample ({avg:.1f}%). Hold irrigation if rain is forecast.",
                    }
                )
        return Response(recommendations)
