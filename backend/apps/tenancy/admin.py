from django.contrib import admin

from .models import FarmAccess, Invitation, Membership, Organization, Role, Team, TeamMembership


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "org_type", "country", "is_active")
    search_fields = ("name", "slug")
    list_filter = ("org_type", "is_active")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "is_system")
    list_filter = ("is_system", "organization")
    search_fields = ("name",)


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "organization", "role", "is_owner", "is_active")
    list_filter = ("is_owner", "is_active", "organization")
    search_fields = ("user__email", "organization__name")


class TeamMembershipInline(admin.TabularInline):
    model = TeamMembership
    extra = 0


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("name", "organization")
    search_fields = ("name",)
    inlines = [TeamMembershipInline]


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ("email", "organization", "role", "status", "expires_at")
    list_filter = ("status", "organization")
    search_fields = ("email",)


@admin.register(FarmAccess)
class FarmAccessAdmin(admin.ModelAdmin):
    list_display = ("user", "farm", "can_view", "can_edit", "can_manage")
    search_fields = ("user__email", "farm__name")
