from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm
from django.utils.translation import gettext_lazy as _

from .models import FarmerProfile, User


class AgriNexaUserCreationForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("email",)


class AgriNexaUserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User
        fields = (
            "email",
            "first_name",
            "last_name",
            "phone",
            "avatar",
            "is_active",
            "is_staff",
            "is_superuser",
            "groups",
            "user_permissions",
        )


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    form = AgriNexaUserChangeForm
    add_form = AgriNexaUserCreationForm
    ordering = ("email",)
    list_display = ("email", "first_name", "last_name", "is_staff", "is_active", "date_joined")
    search_fields = ("email", "first_name", "last_name")
    list_filter = ("is_staff", "is_superuser", "is_active")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (_("Personal"), {"fields": ("first_name", "last_name", "phone", "avatar")}),
        (_("Permissions"), {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        (_("Dates"), {"fields": ("last_login", "last_login_at", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2", "is_staff", "is_superuser"),
            },
        ),
    )
    filter_horizontal = ("groups", "user_permissions")


@admin.register(FarmerProfile)
class FarmerProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "experience_years", "preferred_language", "license_number")
    search_fields = ("user__email", "license_number")
