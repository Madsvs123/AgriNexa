import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Button } from "@chakra-ui/react";
import { getApiError, scoutingApi } from "@/api/client";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { SeverityMeter } from "@/components/ui/SensorSparkline";

export default function ScoutingPage() {
  const navigate = useNavigate();
  const reportsQ = useQuery({ queryKey: ["scout-reports"], queryFn: () => scoutingApi.reports() });
  return (
    <Box>
      <PageHeader
        title="Scouting"
        subtitle="Walk notes, pests, and follow-up treatments."
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
        emptyTitle="No scout reports"
        emptyBody="Log a walk on South Bottom after the next rain."
        columns={[
          { key: "field_name", header: "Field", render: (r) => r.field_name ?? "—" },
          { key: "observed_at", header: "Observed", render: (r) => formatDateTime(r.observed_at) },
          { key: "health_score", header: "Health", render: (r) => r.health_score },
          {
            key: "severity",
            header: "Severity",
            render: (r) => (
              <Box w="80px">
                <SeverityMeter value={r.severity} />
              </Box>
            ),
          },
          { key: "status", header: "Pests", render: (r) => r.pests?.length ?? 0 },
          { key: "notes", header: "Notes", render: (r) => r.notes?.slice(0, 48) || "—" },
        ]}
      />
    </Box>
  );
}
