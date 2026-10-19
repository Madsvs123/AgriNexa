from django.apps import AppConfig


class IrrigationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.irrigation"
    label = "irrigation"
    verbose_name = "Irrigation"

    def ready(self):
        return None
