from django.contrib import admin

from .models import (
    DiseaseObservation,
    PestIncident,
    ScoutPhoto,
    ScoutReport,
    TreatmentPlan,
    WeedPressure,
)


class DiseaseInline(admin.TabularInline):
    model = DiseaseObservation
    extra = 0


class PestInline(admin.TabularInline):
    model = PestIncident
    extra = 0


class WeedInline(admin.TabularInline):
    model = WeedPressure
    extra = 0


class PhotoInline(admin.TabularInline):
    model = ScoutPhoto
    extra = 0


@admin.register(ScoutReport)
class ScoutReportAdmin(admin.ModelAdmin):
    list_display = ("field", "scout", "report_date", "overall_health", "growth_stage")
    list_filter = ("overall_health",)
    search_fields = ("field__name", "notes")
    inlines = [DiseaseInline, PestInline, WeedInline, PhotoInline]


@admin.register(TreatmentPlan)
class TreatmentPlanAdmin(admin.ModelAdmin):
    list_display = ("product_name", "field", "status", "scheduled_date", "assigned_to")
    list_filter = ("status",)
    search_fields = ("issue_summary", "product_name")
