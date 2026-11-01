import { Link as RouterLink, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Card, CardBody, Flex, Heading, Link, SimpleGrid, Text } from "@chakra-ui/react";
import { getApiError, irrigationApi } from "@/api/client";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, ErrorBanner, SkeletonBlock } from "@/components/ui/FormField";
import { StatusBadge, StatCard } from "@/components/ui/StatCard";

export default function IrrigationZonePage() {
  const { id = "" } = useParams();
  const zoneQ = useQuery({ queryKey: ["irrigation-zone", id], queryFn: () => irrigationApi.getZone(id), enabled: !!id });
  const schedQ = useQuery({ queryKey: ["irrigation-schedules", id], queryFn: () => irrigationApi.schedules({ zone: id }) });
  const usageQ = useQuery({ queryKey: ["water-usage", id], queryFn: () => irrigationApi.waterUsage({ zone: id }) });
  const zone = zoneQ.data;

  if (zoneQ.isLoading) {
    return (
      <Box>
        <SkeletonBlock />
      </Box>
    );
  }
  if (!zone) {
    return (
      <Box>
        <ErrorBanner message={zoneQ.error ? getApiError(zoneQ.error) : "Zone not found."} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={zone.name}
        subtitle={`${zone.field_name} · ${zone.method}`}
        crumbs={
          <>
            <Link as={RouterLink} to="/irrigation">
              Irrigation
            </Link>
            <Text as="span" mx={1}>
              /
            </Text>
            <Text as="span">{zone.name}</Text>
          </>
        }
      />
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <StatCard label="Moisture" value={`${zone.moisture ?? "—"}%`} />
        <StatCard label="Threshold" value={`${zone.threshold}%`} />
        <StatCard label="Status" value={<StatusBadge status={zone.status} />} />
        <StatCard label="Last run" value={formatDateTime(zone.last_run_at)} />
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface">
          <CardBody>
            <Heading size="sm" mb={3}>
              Schedules
            </Heading>
            {(schedQ.data?.results ?? []).map((s) => (
              <Flex key={s.id} align="center" gap={2} justify="space-between" mb={2}>
                <Text as="span">
                  {s.start_time} · {s.duration_minutes} min
                </Text>
                <StatusBadge status={s.is_active ? "healthy" : "idle"} />
              </Flex>
            ))}
          </CardBody>
        </Card>
        <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface">
          <CardBody>
            <Heading size="sm" mb={3}>
              Water usage
            </Heading>
            {(usageQ.data?.results ?? []).slice(0, 8).map((u) => (
              <Flex key={u.id} align="center" gap={2} justify="space-between" mb={2}>
                <Text as="span">{u.gallons} gal</Text>
                <Text as="span" color="fg.muted">
                  {formatDateTime(u.recorded_at)}
                </Text>
              </Flex>
            ))}
          </CardBody>
        </Card>
      </SimpleGrid>
    </Box>
  );
}
