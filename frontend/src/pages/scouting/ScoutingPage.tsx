import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Button } from "@chakra-ui/react";
import { getApiError, scoutingApi } from "@/api/client";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { SeverityMeter } from "@/components/ui/SensorSparkline";
import { useTranslation } from "react-i18next";

export default function ScoutingPage() {
  const { t } = useTranslation("operate");
  const navigate = useNavigate();
  const reportsQ = useQuery({ queryKey: ["scout-reports"], queryFn: () => scoutingApi.reports() });
  return (
    <Box>
      <PageHeader
        title={t("scouting.title")}
        subtitle={t("scouting.subtitle")}
        actions={
          <>
            <Button as={RouterLink} to="/scouting/treatments" variant="ghost" colorScheme="gray">
              Treatments
            </Button>
            <Button as={RouterLink} to="/scouting/new" colorScheme="brand">
              New report
            </Button>
          </>
        }
      />
      <ErrorBanner message={reportsQ.error ? getApiError(reportsQ.error) : null} />
      <DataTable
        rows={reportsQ.data?.results ?? []}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/scouting/${r.id}`)}
        emptyTitle={t("scouting.emptyTitle")}
        emptyBody={t("scouting.emptyBody")}
        columns={[
          { key: "field_name", header: t("labels.field", { ns: "common" }), render: (r) => r.field_name ?? "—" },
          { key: "observed_at", header: t("scouting.observed"), render: (r) => formatDateTime(r.observed_at) },
          { key: "health_score", header: t("labels.status", { ns: "common" }), render: (r) => r.health_score },
          {
            key: "severity",
            header: t("scouting.severity"),
            render: (r) => (
              <Box w="80px">
                <SeverityMeter value={r.severity} />
              </Box>
            ),
          },
          { key: "status", header: t("scouting.pests"), render: (r) => r.pests?.length ?? 0 },
          { key: "notes", header: t("labels.notes", { ns: "common" }), render: (r) => r.notes?.slice(0, 48) || "—" },
        ]}
      />
    </Box>
  );
}
