import { Link as RouterLink } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  Heading,
  Link,
  Progress,
  SimpleGrid,
  Text,
} from "@chakra-ui/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Droplets, Gauge, Tractor, Wheat, MapPinned } from "lucide-react";
import {
  dashboardApi,
  inventoryApi,
  platformApi,
  sensorsApi,
  weatherApi,
  getApiError,
} from "@/api/client";
import { useUiStore } from "@/stores/uiStore";
import { formatAcres, formatNumber, formatPct, seasonParams, statusTone } from "@/lib/utils";
import { PageHeader, ErrorBanner, SkeletonKpis } from "@/components/ui/FormField";
import { StatCard, StatusBadge } from "@/components/ui/StatCard";
import { ChartCard } from "@/components/ui/StatCard";

const TONE_ACCENT: Record<string, string> = {
  healthy: "green.400",
  warning: "yellow.400",
  critical: "red.500",
  idle: "gray.400",
};

export default function DashboardPage() {
  const seasonId = useUiStore((s) => s.seasonId);
  const params = seasonParams(seasonId);
  const results = useQueries({
    queries: [
      { queryKey: ["dashboard", "summary", seasonId], queryFn: () => dashboardApi.summary(params) },
      { queryKey: ["dashboard", "crop-progress", seasonId], queryFn: () => dashboardApi.cropProgress(params) },
      { queryKey: ["dashboard", "field-health", seasonId], queryFn: () => dashboardApi.fieldHealth(params) },
      { queryKey: ["dashboard", "irrigation", seasonId], queryFn: () => dashboardApi.irrigation(params) },
      { queryKey: ["dashboard", "expenses", seasonId], queryFn: () => dashboardApi.expenses(params) },
      { queryKey: ["dashboard", "yields", seasonId], queryFn: () => dashboardApi.yields(params) },
      { queryKey: ["weather", "current"], queryFn: () => weatherApi.current() },
      { queryKey: ["inventory", "alerts"], queryFn: () => inventoryApi.alerts() },
      { queryKey: ["sensor-live"], queryFn: () => sensorsApi.live() },
      { queryKey: ["tasks", { status: "todo" }], queryFn: () => platformApi.tasks({ status: "todo" }) },
    ],
  });
  const [
    summaryQ,
    progressQ,
    healthQ,
    irrigQ,
    expensesQ,
    yieldsQ,
    weatherQ,
    invAlertQ,
    liveQ,
    tasksQ,
  ] = results;
  const err = results.find((r) => r.error)?.error;
  const summary = summaryQ.data;

  return (
    <Box>
      <PageHeader
        title="Season operations"
        subtitle="Acres, moisture, water, and alerts across the organization."
        actions={
          <Button as={RouterLink} to="/map" colorScheme="brand">
            Open farm map
          </Button>
        }
      />
      <ErrorBanner message={err ? getApiError(err) : null} />
      {summaryQ.isLoading ? (
        <SkeletonKpis />
      ) : (
        <SimpleGrid columns={{ base: 2, md: 3, xl: 6 }} spacing={4} mb={6}>
          <StatCard label="Acres" value={formatAcres(summary?.total_acres)} icon={<MapPinned size={14} />} hint="Owned + operated" />
          <StatCard label="Active fields" value={formatNumber(summary?.active_fields)} icon={<Wheat size={14} />} />
          <StatCard
            label="Yield estimate"
            value={`${formatNumber(summary?.yield_estimate, 0)} bu`}
            hint="Season to date"
          />
          <StatCard
            label="Open alerts"
            value={formatNumber(summary?.open_alerts)}
            icon={<AlertTriangle size={14} />}
          />
          <StatCard
            label="Water used"
            value={`${formatNumber(summary?.water_used, 0)} gal`}
            icon={<Droplets size={14} />}
          />
          <StatCard
            label="Equipment uptime"
            value={formatPct(summary?.equipment_uptime)}
            icon={<Tractor size={14} />}
            hint="Rolling 7-day"
          />
        </SimpleGrid>
      )}

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={4}>
        <ChartCard title="Crop progress">
          {(progressQ.data ?? []).length === 0 ? (
            <Text color="fg.muted">No crop plans in this season. Add a plan for corn on North 80.</Text>
          ) : (
            (progressQ.data ?? []).map((c) => (
              <Box key={c.crop_name} mb={3}>
                <Flex align="center" justify="space-between" gap={2}>
                  <Text as="span" fontWeight="semibold">
                    {c.crop_name}
                  </Text>
                  <Text as="span" color="fg.muted">
                    {formatAcres(c.planted_acres)}
                  </Text>
                </Flex>
                <Progress
                  value={Math.min(100, c.progress_pct)}
                  size="sm"
                  colorScheme="brand"
                  borderRadius="full"
                  bg="bg.subtle"
                  mt={1.5}
                />
              </Box>
            ))
          )}
        </ChartCard>
        <ChartCard title="Irrigation">
          <Flex align="center" gap={2}>
            <Gauge size={18} />
            <Box>
              <Text>
                {irrigQ.data?.zones_running ?? 0} of {irrigQ.data?.zones_total ?? 0} zones running
              </Text>
              <Text color="fg.muted">
                {formatNumber(irrigQ.data?.gallons_today)} gal today · {formatPct(irrigQ.data?.efficiency_pct)} efficiency
              </Text>
            </Box>
          </Flex>
          <Button as={RouterLink} to="/irrigation" variant="ghost" colorScheme="gray" size="sm" mt={3}>
            Review zones
          </Button>
        </ChartCard>
        <ChartCard title="Weather now">
          {weatherQ.data ? (
            <Box>
              <Text fontFamily="heading" fontSize="4xl" lineHeight="1.1">
                {Math.round(weatherQ.data.temperature_f)}°
              </Text>
              <Text>
                {weatherQ.data.conditions} · Wind {weatherQ.data.wind_mph} mph · RH {weatherQ.data.humidity}%
              </Text>
              <Link as={RouterLink} to="/weather" color="brand.500">
                Full forecast
              </Link>
            </Box>
          ) : (
            <Text color="fg.muted">Select a farm with a weather station to see conditions.</Text>
          )}
        </ChartCard>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
        <ChartCard title="Field health">
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            {(healthQ.data ?? []).slice(0, 8).map((f) => (
              <Box
                key={f.id}
                as={RouterLink}
                to={`/fields/${f.id}`}
                bg="bg.surface"
                borderWidth="1px"
                borderColor="border.default"
                borderLeftWidth="4px"
                borderLeftColor={TONE_ACCENT[statusTone(f.health_status)] ?? "gray.400"}
                borderRadius="lg"
                p={3}
                _hover={{ bg: "bg.subtle" }}
              >
                <Text as="span" fontWeight="semibold">
                  {f.name}
                </Text>
                <Text color="fg.muted">
                  {f.farm_name} · {f.crop_name ?? "Fallow"}
                </Text>
                <Flex align="center" gap={2} mt={2}>
                  <StatusBadge status={f.health_status} />
                  <Text as="span" color="fg.muted">
                    {f.moisture != null ? `${f.moisture}% moisture` : "No probe"}
                  </Text>
                </Flex>
              </Box>
            ))}
          </SimpleGrid>
          {!healthQ.data?.length ? <Text color="fg.muted">Field health cards appear once probes report in.</Text> : null}
        </ChartCard>
        <ChartCard title="Expenses">
          <Box h="180px">
            <ResponsiveContainer>
              <AreaChart data={expensesQ.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip />
                <Area dataKey="amount" stroke="#2F6F4E" fill="#7CB51833" />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </ChartCard>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
        <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface">
          <CardBody>
            <Flex align="center" justify="space-between" mb={3}>
              <Heading size="sm">Low stock</Heading>
              <Link as={RouterLink} to="/inventory" color="brand.500">
                Inventory
              </Link>
            </Flex>
            {(invAlertQ.data ?? []).slice(0, 5).map((a) => (
              <Flex key={a.id} align="center" gap={2} mb={2}>
                <Box>
                  <Text>{a.item_name}</Text>
                  <Text color="fg.muted">
                    {a.quantity} on hand / reorder {a.reorder_level}
                  </Text>
                </Box>
              </Flex>
            ))}
            {!invAlertQ.data?.length ? <Text color="fg.muted">Seed, MAP, and diesel are above reorder points.</Text> : null}
          </CardBody>
        </Card>
        <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface">
          <CardBody>
            <Flex align="center" justify="space-between" mb={3}>
              <Heading size="sm">Sensor alerts</Heading>
              <Link as={RouterLink} to="/sensors" color="brand.500">
                Sensors
              </Link>
            </Flex>
            {(liveQ.data ?? [])
              .filter((s) => statusTone(s.status) !== "healthy")
              .slice(0, 6)
              .map((s) => (
                <Flex key={s.id} as={RouterLink} to={`/sensors/${s.id}`} align="center" gap={2} mb={2}>
                  <StatusBadge status={s.status} />
                  <Text as="span">
                    {s.name} · {s.field_name ?? s.farm_name}
                  </Text>
                </Flex>
              ))}
            {(liveQ.data ?? []).every((s) => statusTone(s.status) === "healthy") ? (
              <Text color="fg.muted">All live probes look healthy.</Text>
            ) : null}
          </CardBody>
        </Card>
        <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface">
          <CardBody>
            <Flex align="center" justify="space-between" mb={3}>
              <Heading size="sm">Recent tasks</Heading>
              <Link as={RouterLink} to="/tasks" color="brand.500">
                Board
              </Link>
            </Flex>
            {(tasksQ.data?.results ?? []).slice(0, 6).map((t) => (
              <Flex key={t.id} align="center" gap={2} mb={2}>
                <StatusBadge status={t.status} />
                <Text as="span">{t.title}</Text>
              </Flex>
            ))}
            {!tasksQ.data?.results.length ? (
              <Text color="fg.muted">No open tasks. Side-dress and scout walks will show here.</Text>
            ) : null}
          </CardBody>
        </Card>
      </SimpleGrid>

      <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface" mt={4}>
        <CardBody>
          <Heading size="sm" mb={3}>
            Yield vs target
          </Heading>
          <Box h="200px">
            <ResponsiveContainer>
              <BarChart data={yieldsQ.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="actual" fill="#2F6F4E" />
                <Bar dataKey="target" fill="#D4A017" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardBody>
      </Card>
    </Box>
  );
}
