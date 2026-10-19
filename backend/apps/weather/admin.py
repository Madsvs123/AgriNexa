from django.contrib import admin

from .models import WeatherAlert, WeatherForecast, WeatherReading, WeatherStation


@admin.register(WeatherStation)
class WeatherStationAdmin(admin.ModelAdmin):
    list_display = ("name", "farm", "source", "is_active")
    list_filter = ("source", "is_active")
    search_fields = ("name", "farm__name")


@admin.register(WeatherReading)
class WeatherReadingAdmin(admin.ModelAdmin):
    list_display = ("station", "temperature_c", "humidity_pct", "rainfall_mm", "recorded_at")
    date_hierarchy = "recorded_at"


@admin.register(WeatherForecast)
class WeatherForecastAdmin(admin.ModelAdmin):
    list_display = ("farm", "forecast_date", "high_c", "low_c", "conditions")
    list_filter = ("farm",)


@admin.register(WeatherAlert)
class WeatherAlertAdmin(admin.ModelAdmin):
    list_display = ("title", "farm", "alert_type", "severity", "is_active", "starts_at")
    list_filter = ("alert_type", "severity", "is_active")
