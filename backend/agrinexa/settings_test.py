"""Test settings: same stack, in-memory SQLite, no Redis.

Lets `manage.py test` run without a PostgreSQL or Redis server:

    python manage.py test apps --settings=agrinexa.settings_test

Nothing in the suite depends on PostgreSQL-specific behaviour — boundaries and
settings are plain JSONFields, which SQLite supports natively.
"""

from .settings import *  # noqa: F401,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
