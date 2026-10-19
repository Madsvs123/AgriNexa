from django.contrib import admin

from .models import DeviceHealth, Sensor, SensorReading, SensorType


@admin.register(SensorType)
class SensorTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "unit", "organization")
    list_filter = ("category",)


@admin.register(Sensor)
class SensorAdmin(admin.ModelAdmin):
    list_display = ("name", "serial", "farm", "status", "last_seen")
    list_filter = ("status",)
    search_fields = ("name", "serial")


@admin.register(SensorReading)
class SensorReadingAdmin(admin.ModelAdmin):
    list_display = ("sensor", "value", "recorded_at", "quality")
    list_filter = ("quality",)
    date_hierarchy = "recorded_at"


@admin.register(DeviceHealth)
class DeviceHealthAdmin(admin.ModelAdmin):
    list_display = ("sensor", "battery_pct", "signal_dbm", "firmware", "updated_at")
