from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.platform.views import (
    AuditLogViewSet,
    DocumentViewSet,
    LanguageDetectView,
    NotificationViewSet,
    SearchView,
    TaskViewSet,
)

router = DefaultRouter()
router.register("tasks", TaskViewSet, basename="task")
router.register("documents", DocumentViewSet, basename="document")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("audit-logs", AuditLogViewSet, basename="audit-log")

urlpatterns = [
    path("i18n/detect/", LanguageDetectView.as_view(), name="language-detect"),
    path("search/", SearchView.as_view(), name="search"),
    path("", include(router.urls)),
]
