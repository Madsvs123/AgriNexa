from apps.common.views import TenantModelViewSet
from apps.scouting.models import ScoutReport, TreatmentPlan
from apps.scouting.serializers import ScoutReportSerializer, TreatmentPlanSerializer


class ScoutReportViewSet(TenantModelViewSet):
    serializer_class = ScoutReportSerializer
    queryset = ScoutReport.objects.all()
    search_fields = ("notes", "growth_stage", "field__name")
    filterset_fields = ("field", "overall_health", "scout", "report_date")
    ordering_fields = ("report_date", "created_at")

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .select_related("field", "field__farm", "scout")
            .prefetch_related("diseases", "pests", "weeds", "photos")
        )


class TreatmentPlanViewSet(TenantModelViewSet):
    serializer_class = TreatmentPlanSerializer
    queryset = TreatmentPlan.objects.all()
    search_fields = ("issue_summary", "product_name", "notes")
    filterset_fields = ("field", "status", "assigned_to", "report")
    ordering_fields = ("scheduled_date", "created_at")

    def get_queryset(self):
        return super().get_queryset().select_related("field", "field__farm", "report", "assigned_to")
