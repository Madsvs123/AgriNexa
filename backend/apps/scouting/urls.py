from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.scouting.views import ScoutReportViewSet, TreatmentPlanViewSet

router = DefaultRouter()
router.register("scout-reports", ScoutReportViewSet, basename="scout-report")
router.register("treatments", TreatmentPlanViewSet, basename="treatment")

urlpatterns = [
    path("", include(router.urls)),
]
