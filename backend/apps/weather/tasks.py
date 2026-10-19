from datetime import datetime, time, timedelta
from decimal import Decimal

from celery import shared_task
from django.conf import settings
from django.utils import timezone


def _seasonal_stub(lat, day_index):
    month = (timezone.now() + timedelta(days=day_index)).month
    if month in (12, 1, 2):
        high, low, precip, conditions = 4, -6, 2, "cold"
    elif month in (3, 4, 5):
        high, low, precip, conditions = 18, 6, 8, "partly cloudy"
    elif month in (6, 7, 8):
        high, low, precip, conditions = 30, 18, 4, "warm"
    else:
        high, low, precip, conditions = 22, 10, 6, "clear"
    if lat is not None and Decimal(str(lat)) < 0:
        high, low = low + 16, high - 16
    return high, low, precip, conditions


@shared_task
def refresh_forecasts():
    from apps.farms.models import Farm
    from apps.weather.models import WeatherForecast, WeatherReading

    api_key = getattr(settings, "OPENWEATHER_API_KEY", "") or ""
    created = 0
    for farm in Farm.objects.filter(status="active"):
        lat = farm.lat
        lng = farm.lng
        station = farm.weather_stations.filter(is_active=True).first()
        if station and station.lat and not lat:
            lat, lng = station.lat, station.lng
        days = []
        if api_key and lat and lng:
            days = _fetch_openweather(lat, lng, api_key)
        if not days:
            last = None
            if station:
                last = WeatherReading.objects.filter(station=station).order_by("-recorded_at").first()
            for i in range(7):
                high, low, precip, conditions = _seasonal_stub(lat, i)
                if last and last.temperature_c is not None:
                    high = float(last.temperature_c) + 4
                    low = float(last.temperature_c) - 6
                days.append(
                    {
                        "forecast_date": (timezone.now() + timedelta(days=i)).date(),
                        "high_c": high,
                        "low_c": low,
                        "precip_chance": min(80, precip * 8),
                        "precip_mm": precip,
                        "conditions": conditions,
                        "wind_kph": 12,
                    }
                )
        for day in days:
            _, was_created = WeatherForecast.objects.update_or_create(
                farm=farm,
                forecast_date=day["forecast_date"],
                defaults={
                    "high_c": day["high_c"],
                    "low_c": day["low_c"],
                    "precip_chance": day["precip_chance"],
                    "precip_mm": day["precip_mm"],
                    "conditions": day["conditions"],
                    "wind_kph": day.get("wind_kph"),
                },
            )
            created += int(was_created)
    return created


def _fetch_openweather(lat, lng, api_key):
    try:
        import requests
    except ImportError:
        return []
    try:
        resp = requests.get(
            "https://api.openweathermap.org/data/2.5/forecast",
            params={"lat": float(lat), "lon": float(lng), "appid": api_key, "units": "metric"},
            timeout=12,
        )
        resp.raise_for_status()
        payload = resp.json()
    except Exception:
        return []
    by_date = {}
    for item in payload.get("list", []):
        ts = datetime.fromtimestamp(item["dt"], tz=timezone.get_current_timezone())
        day = ts.date()
        main = item.get("main") or {}
        weather = (item.get("weather") or [{}])[0]
        wind = item.get("wind") or {}
        rain = (item.get("rain") or {}).get("3h", 0) or 0
        entry = by_date.setdefault(
            day,
            {"highs": [], "lows": [], "precip": 0, "conditions": weather.get("description", ""), "wind": []},
        )
        if "temp_max" in main:
            entry["highs"].append(main["temp_max"])
        if "temp_min" in main:
            entry["lows"].append(main["temp_min"])
        entry["precip"] += rain
        entry["wind"].append(wind.get("speed", 0) * 3.6)
        if weather.get("description"):
            entry["conditions"] = weather["description"]
    days = []
    for day, entry in sorted(by_date.items())[:7]:
        days.append(
            {
                "forecast_date": day,
                "high_c": max(entry["highs"]) if entry["highs"] else None,
                "low_c": min(entry["lows"]) if entry["lows"] else None,
                "precip_chance": min(100, entry["precip"] * 10),
                "precip_mm": entry["precip"],
                "conditions": entry["conditions"],
                "wind_kph": max(entry["wind"]) if entry["wind"] else None,
            }
        )
    return days


@shared_task
def evaluate_weather_alerts():
    from apps.farms.models import Farm
    from apps.platform.services import create_notification
    from apps.weather.models import WeatherAlert, WeatherForecast

    created = 0
    today = timezone.now().date()
    window = today + timedelta(days=3)
    for farm in Farm.objects.filter(status="active").select_related("organization"):
        forecasts = list(
            WeatherForecast.objects.filter(farm=farm, forecast_date__range=(today, window))
        )
        frost_days = [f for f in forecasts if f.low_c is not None and f.low_c < 2]
        heat_days = [f for f in forecasts if f.high_c is not None and f.high_c > 35]
        alerts = []
        if frost_days:
            start = timezone.make_aware(datetime.combine(frost_days[0].forecast_date, time.min))
            alerts.append(
                {
                    "alert_type": WeatherAlert.AlertType.FROST,
                    "severity": WeatherAlert.Severity.HIGH,
                    "title": f"Frost risk at {farm.name}",
                    "message": f"Overnight lows drop below 2°C on {frost_days[0].forecast_date}.",
                    "starts_at": start,
                }
            )
        if heat_days:
            alerts.append(
                {
                    "alert_type": WeatherAlert.AlertType.HEAT,
                    "severity": WeatherAlert.Severity.MEDIUM,
                    "title": f"Heat stress risk at {farm.name}",
                    "message": f"Highs exceed 35°C on {heat_days[0].forecast_date}.",
                    "starts_at": timezone.now(),
                }
            )
        for spec in alerts:
            exists = WeatherAlert.objects.filter(
                farm=farm,
                alert_type=spec["alert_type"],
                is_active=True,
                created_at__gte=timezone.now() - timedelta(hours=12),
            ).exists()
            if exists:
                continue
            alert = WeatherAlert.objects.create(
                farm=farm,
                ends_at=timezone.now() + timedelta(days=3),
                **spec,
            )
            created += 1
            for membership in farm.organization.memberships.filter(is_active=True).select_related("user"):
                create_notification(
                    user=membership.user,
                    organization=farm.organization,
                    title=alert.title,
                    body=alert.message,
                    category="weather",
                    link=f"/weather/alerts/{alert.id}",
                    payload={"alert_id": str(alert.id), "farm_id": str(farm.id)},
                )
    return created
