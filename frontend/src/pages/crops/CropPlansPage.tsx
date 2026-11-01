import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Link, Text } from "@chakra-ui/react";
import { cropsApi, getApiError } from "@/api/client";
import { formatAcres, formatDate } from "@/lib/utils";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatCard";

export default function CropPlansPage() {
  const navigate = useNavigate();
  const plansQ = useQuery({ queryKey: ["crop-plans"], queryFn: () => cropsApi.plans() });
  return (
    <Box>
      <PageHeader
        title="Seasonal plans"
        subtitle="What is planted, where, and the yield target."
        crumbs={
          <>
            <Link as={RouterLink} to="/crops">
              Crops
            </Link>
            <Text as="span" mx={1}>
              /
            </Text>
            <Text as="span">Plans</Text>
          </>
        }
      />
      <ErrorBanner message={plansQ.error ? getApiError(plansQ.error) : null} />
      <DataTable
        rows={plansQ.data?.results ?? []}
        rowKey={(p) => p.id}
        onRowClick={(p) => navigate(`/crops/plans/${p.id}`)}
        emptyTitle="No seasonal plans"
        emptyBody="Create a plan for corn on North 80 once the seed is booked."
        columns={[
          { key: "name", header: "Plan" },
          { key: "crop_name", header: "Crop", render: (p) => p.crop_name ?? "—" },
          { key: "field_name", header: "Field", render: (p) => p.field_name ?? "—" },
          { key: "season_name", header: "Season", render: (p) => p.season_name ?? "—" },
          { key: "planted_acres", header: "Acres", render: (p) => formatAcres(p.planted_acres) },
          { key: "target_yield", header: "Target yield", render: (p) => p.target_yield ?? "—" },
          { key: "planting_date", header: "Planted", render: (p) => formatDate(p.planting_date) },
          { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
        ]}
      />
    </Box>
  );
}
