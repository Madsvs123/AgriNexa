import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Card,
  CardBody,
  Flex,
  Select,
  SimpleGrid,
  Spacer,
  Text,
} from "@chakra-ui/react";
import { farmsApi, getApiError, sensorsApi } from "@/api/client";
import { formatDateTime, formatPct } from "@/lib/utils";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { StatusBadge, EmptyState } from "@/components/ui/StatCard";
import { SensorSparkline } from "@/components/ui/SensorSparkline";
import { useSensorSocket } from "@/hooks/useSensorSocket";
import { useState } from "react";

export default function SensorsPage() {
  const farmsQ = useQuery({ queryKey: ["farms"], queryFn: () => farmsApi.list() });
  const [farmId, setFarmId] = useState("");
  const selected = farmId || farmsQ.data?.results[0]?.id || null;
  useSensorSocket(selected);
  const liveQ = useQuery({ queryKey: ["sensor-live", selected], queryFn: () => sensorsApi.live() });
  const listQ = useQuery({
    queryKey: ["sensors", { farm: selected }],
    queryFn: () => sensorsApi.list({ farm: selected || undefined }),
  });
  const sensors = (liveQ.data?.length ? liveQ.data : listQ.data?.results) ?? [];

  return (
    <Box>
      <PageHeader
        title="Sensors"
        subtitle="Live probes across moisture, weather, and tank monitors."
        actions={
          <Select aria-label="Farm" value={selected ?? ""} onChange={(e) => setFarmId(e.target.value)} maxW="xs" bg="bg.surface">
            {(farmsQ.data?.results ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        }
      />
      <ErrorBanner message={listQ.error ? getApiError(listQ.error) : null} />
      {sensors.length === 0 ? (
        <Card variant="outline" borderColor="border.default" bg="bg.surface">
          <EmptyState title="No sensors reporting" body="Pair a soil probe on North 80 to see sparklines and battery." />
        </Card>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          {sensors.map((s) => (
            <Card
              key={s.id}
              as={RouterLink}
              to={`/sensors/${s.id}`}
              variant="outline"
              borderColor="border.default"
              bg="bg.surface"
              _hover={{ borderColor: "brand.300", textDecoration: "none" }}
            >
              <CardBody>
                <Flex align="center" gap={2}>
                  <Text as="strong">{s.name}</Text>
                  <Spacer />
                  <StatusBadge status={s.status} />
                </Flex>
                <Text color="fg.muted">
                  {s.sensor_type_name} · {s.field_name ?? s.farm_name}
                </Text>
                <Text fontFamily="heading" fontSize="28px" my={2}>
                  {s.last_reading ?? "—"}{" "}
                  <Text as="span" fontSize="sm">
                    {s.unit}
                  </Text>
                </Text>
                <SensorSparkline values={s.sparkline ?? []} />
                <Text color="fg.muted" mt={2}>
                  {formatDateTime(s.last_reading_at)} · Battery {formatPct(s.battery_pct)}
                </Text>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}
