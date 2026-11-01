import { Link as RouterLink, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Box,
  Card,
  CardBody,
  Heading,
  Link,
  List,
  ListItem,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { getApiError, sensorsApi } from "@/api/client";
import { formatDateTime, formatPct } from "@/lib/utils";
import { PageHeader, ErrorBanner, SkeletonBlock } from "@/components/ui/FormField";
import { StatusBadge, StatCard, ChartCard } from "@/components/ui/StatCard";
import { MapView } from "@/components/ui/MapView";
import { useSensorSocket } from "@/hooks/useSensorSocket";

export default function SensorDetailPage() {
  const { id = "" } = useParams();
  const sensorQ = useQuery({ queryKey: ["sensor", id], queryFn: () => sensorsApi.get(id), enabled: !!id });
  const readingsQ = useQuery({
    queryKey: ["sensor-readings", id],
    queryFn: () => sensorsApi.readings(id),
    enabled: !!id,
  });
  const healthQ = useQuery({ queryKey: ["sensor-health", id], queryFn: () => sensorsApi.health(id), enabled: !!id });
  const typesQ = useQuery({ queryKey: ["sensor-types"], queryFn: () => sensorsApi.types() });
  useSensorSocket(sensorQ.data?.farm);
  const sensor = sensorQ.data;
  const type = typesQ.data?.results.find((t) => t.id === sensor?.sensor_type);

  if (sensorQ.isLoading) {
    return (
      <Box>
        <SkeletonBlock />
      </Box>
    );
  }
  if (!sensor) {
    return (
      <Box>
        <ErrorBanner message={sensorQ.error ? getApiError(sensorQ.error) : "Sensor not found."} />
      </Box>
    );
  }

  const chart = (readingsQ.data ?? []).map((r) => ({ t: r.recorded_at, v: r.value }));

  return (
    <Box>
      <PageHeader
        title={sensor.name}
        subtitle={`${sensor.sensor_type_name ?? type?.name ?? "Probe"} · ${sensor.field_name ?? sensor.farm_name}`}
        crumbs={
          <>
            <Link as={RouterLink} to="/sensors">
              Sensors
            </Link>
            <Text as="span" mx={1}>
              /
            </Text>
            <Text as="span">{sensor.name}</Text>
          </>
        }
      />
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <StatCard label="Last reading" value={`${sensor.last_reading ?? "—"} ${sensor.unit ?? type?.unit ?? ""}`} hint={formatDateTime(sensor.last_reading_at)} />
        <StatCard label="Status" value={<StatusBadge status={sensor.status} />} />
        <StatCard label="Battery" value={formatPct(sensor.battery_pct ?? healthQ.data?.battery_pct)} />
        <StatCard label="Signal" value={healthQ.data?.signal_strength != null ? `${healthQ.data.signal_strength} dBm` : "—"} />
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <ChartCard title="History">
          <Box h="260px">
            <ResponsiveContainer>
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
                <XAxis dataKey="t" hide />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="v" stroke="#2F6F4E" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </ChartCard>
        <Stack spacing={4}>
          <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface">
            <CardBody>
              <Heading size="sm" mb={2}>
                Device health
              </Heading>
              <StatusBadge status={healthQ.data?.status ?? sensor.status} />
              <Text color="fg.muted">Last seen {formatDateTime(healthQ.data?.last_seen)}</Text>
              <List styleType="disc" pl={5}>
                {(healthQ.data?.issues ?? []).map((i) => (
                  <ListItem key={i}>{i}</ListItem>
                ))}
              </List>
              {type ? (
                <Text color="fg.muted">
                  Type config: {type.name} ({type.unit}). {type.description}
                </Text>
              ) : null}
            </CardBody>
          </Card>
          <Box bg="bg.surface" borderWidth="1px" borderColor="border.default" borderRadius="xl" overflow="hidden" minH="220px">
            <MapView
              height="220px"
              sensors={[sensor]}
              center={sensor.lat && sensor.lng ? [sensor.lat, sensor.lng] : undefined}
            />
          </Box>
        </Stack>
      </SimpleGrid>
    </Box>
  );
}
