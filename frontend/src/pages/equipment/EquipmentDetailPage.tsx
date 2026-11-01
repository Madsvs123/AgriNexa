import { Link as RouterLink, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Card, CardBody, Heading, Link, SimpleGrid, Text } from "@chakra-ui/react";
import { equipmentApi, getApiError } from "@/api/client";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { PageHeader, ErrorBanner, SkeletonBlock } from "@/components/ui/FormField";
import { StatusBadge, StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/ui/DataTable";
import { MapView } from "@/components/ui/MapView";

export default function EquipmentDetailPage() {
  const { id = "" } = useParams();
  const eqQ = useQuery({ queryKey: ["equipment", id], queryFn: () => equipmentApi.get(id), enabled: !!id });
  const maintQ = useQuery({ queryKey: ["maintenance", id], queryFn: () => equipmentApi.maintenance({ equipment: id }) });
  const fuelQ = useQuery({ queryKey: ["fuel-logs", id], queryFn: () => equipmentApi.fuelLogs({ equipment: id }) });
  const bdQ = useQuery({ queryKey: ["breakdowns", id], queryFn: () => equipmentApi.breakdowns({ equipment: id }) });
  const svcQ = useQuery({ queryKey: ["service-history", id], queryFn: () => equipmentApi.serviceHistory({ equipment: id }) });
  const e = eqQ.data;
  if (eqQ.isLoading) {
    return (
      <Box>
        <SkeletonBlock />
      </Box>
    );
  }
  if (!e) {
    return (
      <Box>
        <ErrorBanner message={eqQ.error ? getApiError(eqQ.error) : "Machine not found."} />
      </Box>
    );
  }
  return (
    <Box>
      <PageHeader
        title={e.name}
        subtitle={`${e.year ?? ""} ${e.make} ${e.model} · ${e.farm_name}`}
        crumbs={
          <>
            <Link as={RouterLink} to="/equipment">
              Equipment
            </Link>
            <Text as="span" mx={1}>
              /
            </Text>
            <Text as="span">{e.name}</Text>
          </>
        }
      />
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <StatCard label="Hours" value={formatNumber(e.hours)} />
        <StatCard label="Fuel" value={e.fuel_level != null ? `${e.fuel_level}%` : "—"} />
        <StatCard label="Status" value={<StatusBadge status={e.status} />} />
        <StatCard label="Type" value={e.type} />
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
        <Box bg="bg.surface" borderWidth="1px" borderColor="border.default" borderRadius="xl" overflow="hidden" minH="220px">
          <MapView height="220px" equipment={[e]} center={e.lat && e.lng ? [e.lat, e.lng] : undefined} />
        </Box>
        <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface">
          <CardBody>
            <Heading size="sm" mb={3}>
              Breakdowns
            </Heading>
            {(bdQ.data?.results ?? []).map((b) => (
              <Box key={b.id} mb={2}>
                <Text as="strong">{formatDateTime(b.occurred_at)}</Text> — {b.description}
                <Text color="fg.muted">{b.resolved_at ? `Resolved ${formatDate(b.resolved_at)}` : "Open"}</Text>
              </Box>
            ))}
            {!bdQ.data?.results.length ? <Text color="fg.muted">No open breakdowns.</Text> : null}
          </CardBody>
        </Card>
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <Box>
          <Heading size="sm" mb={3}>
            Maintenance schedule
          </Heading>
          <DataTable
            rows={maintQ.data?.results ?? []}
            rowKey={(r) => r.id}
            emptyTitle="No maintenance due"
            emptyBody="Oil, filters, and greasing intervals will list here."
            columns={[
              { key: "title", header: "Work" },
              { key: "due_date", header: "Due", render: (r) => formatDate(r.due_date) },
              { key: "cost", header: "Cost", render: (r) => (r.cost != null ? `$${r.cost}` : "—") },
            ]}
          />
        </Box>
        <Box>
          <Heading size="sm" mb={3}>
            Fuel logs
          </Heading>
          <DataTable
            rows={fuelQ.data?.results ?? []}
            rowKey={(r) => r.id}
            emptyTitle="No fuel logs"
            emptyBody="Tender fills will appear here."
            columns={[
              { key: "recorded_at", header: "When", render: (r) => formatDateTime(r.recorded_at) },
              { key: "gallons", header: "Gallons" },
              { key: "cost", header: "Cost", render: (r) => (r.cost != null ? `$${r.cost}` : "—") },
            ]}
          />
        </Box>
      </SimpleGrid>
      <Box as="section" mt={4}>
        <Heading size="sm" mb={3}>
          Service history
        </Heading>
        <DataTable
          rows={svcQ.data?.results ?? []}
          rowKey={(r) => r.id}
          emptyTitle="No dealer tickets"
          emptyBody="Shop invoices from the John Deere dealer will list here."
          columns={[
            { key: "performed_at", header: "Date", render: (r) => formatDate(r.performed_at) },
            { key: "summary", header: "Summary" },
            { key: "vendor", header: "Vendor" },
            { key: "cost", header: "Cost", render: (r) => (r.cost != null ? `$${r.cost}` : "—") },
          ]}
        />
      </Box>
    </Box>
  );
}
