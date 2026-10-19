from django.contrib import admin

from .models import CropHistory, Farm, Field, FieldNote, Plot, Region


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "organization", "parent")
    search_fields = ("name", "code")
    list_filter = ("organization",)


@admin.register(Farm)
class FarmAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "organization", "region", "total_acres", "status")
    search_fields = ("name", "code", "address")
    list_filter = ("status", "organization")


@admin.register(Field)
class FieldAdmin(admin.ModelAdmin):
    list_display = ("name", "farm", "acres", "status", "irrigation_type")
    search_fields = ("name", "code", "farm__name")
    list_filter = ("status", "irrigation_type")


@admin.register(Plot)
class PlotAdmin(admin.ModelAdmin):
    list_display = ("name", "field", "acres")
    search_fields = ("name", "field__name")


@admin.register(FieldNote)
class FieldNoteAdmin(admin.ModelAdmin):
    list_display = ("field", "note_type", "author", "created_at")
    list_filter = ("note_type",)


@admin.register(CropHistory)
class CropHistoryAdmin(admin.ModelAdmin):
    list_display = ("field", "crop_name", "variety_name", "season_name", "planted_at", "harvested_at")
    search_fields = ("crop_name", "variety_name", "field__name")
