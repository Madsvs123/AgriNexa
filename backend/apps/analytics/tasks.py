import json

from celery import shared_task
from django.core.files.base import ContentFile
from django.utils import timezone


@shared_task
def generate_report(report_id):
    from apps.analytics.models import Report
    from apps.crops.models import CropPlan, SeasonalBudget
    from apps.equipment.models import Equipment
    from apps.farms.models import Farm, Field
    from apps.inventory.models import InventoryItem
    from apps.irrigation.models import WaterUsage

    try:
        report = Report.objects.select_related("organization").get(pk=report_id)
    except Report.DoesNotExist:
        return False

    org = report.organization
    payload = {
        "report_type": report.report_type,
        "params": report.params,
        "generated_at": timezone.now().isoformat(),
        "organization": str(org.id),
        "organization_name": org.name,
    }
    try:
        if report.report_type == Report.ReportType.CROP_PROGRESS:
            payload["crop_plans"] = list(
                CropPlan.objects.filter(field__farm__organization=org).values(
                    "id", "status", "planting_date", "expected_harvest_date"
                )
            )
        elif report.report_type == Report.ReportType.YIELD:
            payload["plans"] = list(
                CropPlan.objects.filter(field__farm__organization=org).values(
                    "field__name", "crop__name", "target_yield", "yield_unit"
                )
            )
        elif report.report_type == Report.ReportType.IRRIGATION:
            payload["water_usage"] = list(
                WaterUsage.objects.filter(zone__farm__organization=org).values(
                    "usage_date", "gallons", "cost", "zone__name"
                )
            )
        elif report.report_type == Report.ReportType.INVENTORY:
            payload["items"] = list(
                InventoryItem.objects.filter(organization=org).values("name", "quantity", "unit", "category")
            )
        elif report.report_type == Report.ReportType.EQUIPMENT:
            payload["equipment"] = list(
                Equipment.objects.filter(farm__organization=org).values("name", "status", "hours", "equipment_type")
            )
        elif report.report_type == Report.ReportType.WEATHER:
            payload["note"] = "Weather snapshot placeholder"
        elif report.report_type == Report.ReportType.FINANCIAL:
            payload["budgets"] = list(
                SeasonalBudget.objects.filter(farm__organization=org).values(
                    "category", "planned_amount", "actual_amount", "currency"
                )
            )
        payload["farms"] = Farm.objects.filter(organization=org).count()
        payload["fields"] = Field.objects.filter(farm__organization=org).count()
        content = json.dumps(payload, indent=2, default=str)
        report.file.save(f"reports/{report.id}.json", ContentFile(content.encode("utf-8")), save=False)
        report.status = Report.Status.READY
        report.save(update_fields=["file", "status", "updated_at"])
        return True
    except Exception:
        report.status = Report.Status.FAILED
        report.save(update_fields=["status", "updated_at"])
        return False
