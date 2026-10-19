from django.apps import AppConfig


class SensorsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.sensors"
    label = "sensors"
    verbose_name = "Sensors"

    def ready(self):
        from apps.sensors import signals  # noqa: F401
