from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.analytics.views import (
    AnalyticsCostsView,
    AnalyticsOverviewView,
    AnalyticsWaterView,
    AnalyticsYieldsView,
    DashboardCropProgressView,
    DashboardExpensesView,
    DashboardFieldHealthView,
    DashboardIrrigationView,
    DashboardKpisView,
    DashboardSummaryView,
    DashboardYieldsView,
    ReportViewSet,
)

router = DefaultRouter()
router.register("reports", ReportViewSet, basename="report")

urlpatterns = [
    path("dashboard/summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("dashboard/crop-progress/", DashboardCropProgressView.as_view(), name="dashboard-crop-progress"),
    path("dashboard/yields/", DashboardYieldsView.as_view(), name="dashboard-yields"),
    path("dashboard/field-health/", DashboardFieldHealthView.as_view(), name="dashboard-field-health"),
    path("dashboard/irrigation/", DashboardIrrigationView.as_view(), name="dashboard-irrigation"),
    path("dashboard/expenses/", DashboardExpensesView.as_view(), name="dashboard-expenses"),
    path("dashboard/kpis/", DashboardKpisView.as_view(), name="dashboard-kpis"),
    path("analytics/overview/", AnalyticsOverviewView.as_view(), name="analytics-overview"),
    path("analytics/yields/", AnalyticsYieldsView.as_view(), name="analytics-yields"),
    path("analytics/water/", AnalyticsWaterView.as_view(), name="analytics-water"),
    path("analytics/costs/", AnalyticsCostsView.as_view(), name="analytics-costs"),
    path("", include(router.urls)),
]
