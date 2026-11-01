import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardBody, Flex, SimpleGrid, Spacer, Text } from "@chakra-ui/react";
import { getApiError, sensorsApi } from "@/api/client";
import { formatDateTime, formatPct, statusTone } from "@/lib/utils";
import { StatusBadge, EmptyState } from "@/components/ui/StatCard";
import { SensorSparkline } from "@/components/ui/SensorSparkline";
import { FilterBar, FilterSelect } from "@/components/ui/FilterBar";
import { ListPage } from "@/components/templates/ListPage";
import { useSensorSocket } from "@/hooks/useSensorSocket";
import { useScope } from "@/hooks/useScope";
import { useUrlFilters } from "@/hooks/useUrlFilters";

const STATUS_OPTIONS: Array<[string, string]> = [
  ["healthy", "Healthy"],
  ["warning", "Warning"],
  ["critical", "Critical"],
];

const DEFAULTS = { status: "" };

/**
 * Sensor grid. The farm now comes from global scope rather than a page-local
 * selector, so moving here from the map or a field keeps the same farm.
 */
export default function SensorsPage() {
  const { farmId } = useScope();
  const { values, setValue, reset, activeCount } = useUrlFilters(DEFAULTS);
  useSensorSocket(farmId);

  const liveQ = useQuery({ queryKey: ["sensor-live", farmId], queryFn: () => sensorsApi.live() });
  const listQ = useQuery({
    queryKey: ["sensors", { farm: farmId }],
    queryFn: () => sensorsApi.list({ farm: farmId || undefined }),
  });

  const all = (liveQ.data?.length ? liveQ.data : listQ.data?.results) ?? [];
  const sensors = values.status
    ? all.filter((s) => statusTone(s.status) === values.status)
    : all;

  return (
    <ListPage
      title="Sensors"
      subtitle="Live probes across moisture, weather, and tank monitors."
      error={listQ.error ? getApiError(listQ.error) : null}
      loading={listQ.isLoading && !all.length}
      filters={
        <FilterBar activeCount={activeCount} onReset={reset}>
          <FilterSelect
            value={values.status}
            onChange={(v) => setValue("status", v)}
            label="Sensor status"
            allLabel="All statuses"
            options={STATUS_OPTIONS}
          />
        </FilterBar>
      }
    >
      {sensors.length === 0 ? (
        <Card variant="surface">
          <EmptyState
            title={activeCount ? "No sensors match this filter" : "No sensors reporting"}
            body={
              activeCount
                ? "Clear the status filter to see every probe on this farm."
                : "Pair a soil probe on North 80 to see sparklines and battery."
            }
          />
        </Card>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4}>
          {sensors.map((s) => (
            <Card
              key={s.id}
              as={RouterLink}
              to={`/sensors/${s.id}`}
              variant="surface"
              _hover={{ borderColor: "brand.300", textDecoration: "none" }}
              transition="border-color 0.15s"
            >
              <CardBody>
                <Flex align="center" gap={2}>
                  <Text as="strong">{s.name}</Text>
                  <Spacer />
                  <StatusBadge status={s.status} />
                </Flex>
                <Text color="fg.muted" fontSize="sm">
                  {s.sensor_type_name} · {s.field_name ?? s.farm_name}
                </Text>
                <Text fontFamily="heading" fontSize="28px" my={2}>
                  {s.last_reading ?? "—"}{" "}
                  <Text as="span" fontSize="sm">
                    {s.unit}
                  </Text>
                </Text>
                <SensorSparkline values={s.sparkline ?? []} />
                <Text color="fg.muted" fontSize="sm" mt={2}>
                  {formatDateTime(s.last_reading_at)} · Battery {formatPct(s.battery_pct)}
                </Text>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </ListPage>
  );
}
