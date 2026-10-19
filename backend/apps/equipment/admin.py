from django.contrib import admin

from .models import Breakdown, Equipment, FuelLog, MaintenanceSchedule, ServiceHistory


@admin.register(Equipment)
class EquipmentAdmin(admin.ModelAdmin):
    list_display = ("name", "farm", "equipment_type", "status", "hours")
    list_filter = ("equipment_type", "status")
    search_fields = ("name", "serial", "manufacturer", "model")


@admin.register(MaintenanceSchedule)
class MaintenanceScheduleAdmin(admin.ModelAdmin):
    list_display = ("title", "equipment", "next_due_hours", "next_due_date", "is_active")


@admin.register(FuelLog)
class FuelLogAdmin(admin.ModelAdmin):
    list_display = ("equipment", "gallons", "cost", "hours", "logged_at")


@admin.register(Breakdown)
class BreakdownAdmin(admin.ModelAdmin):
    list_display = ("title", "equipment", "severity", "status", "reported_at")
    list_filter = ("severity", "status")


@admin.register(ServiceHistory)
class ServiceHistoryAdmin(admin.ModelAdmin):
    list_display = ("equipment", "service_date", "cost", "vendor", "hours_at_service")
