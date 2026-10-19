from django.apps import AppConfig


class ScoutingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.scouting"
    label = "scouting"
    verbose_name = "Scouting"

    def ready(self):
        return None
