from django.contrib import admin

from .models import (
    IrrigationEvent,
    IrrigationRecommendation,
    IrrigationSchedule,
    IrrigationZone,
    WaterUsage,
)


@admin.register(IrrigationZone)
class IrrigationZoneAdmin(admin.ModelAdmin):
    list_display = ("name", "farm", "method", "is_active", "acres")
    list_filter = ("method", "is_active")
    search_fields = ("name", "farm__name")


@admin.register(IrrigationSchedule)
class IrrigationScheduleAdmin(admin.ModelAdmin):
    list_display = ("name", "zone", "start_time", "duration_minutes", "recurrence", "is_active")


@admin.register(WaterUsage)
class WaterUsageAdmin(admin.ModelAdmin):
    list_display = ("zone", "usage_date", "gallons", "source", "cost")
    list_filter = ("source",)


@admin.register(IrrigationRecommendation)
class IrrigationRecommendationAdmin(admin.ModelAdmin):
    list_display = ("zone", "status", "moisture_avg", "suggested_duration_minutes", "created_at")
    list_filter = ("status",)


@admin.register(IrrigationEvent)
class IrrigationEventAdmin(admin.ModelAdmin):
    list_display = ("zone", "mode", "started_at", "ended_at", "water_used_gallons")
    list_filter = ("mode",)
