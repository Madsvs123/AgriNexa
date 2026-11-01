import { Link as RouterLink } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  Heading,
  Link,
  Progress,
  SimpleGrid,
  Spacer,
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
import {
  AlertTriangle,
  Droplets,
  Gauge,
  Package,
  Radio,
  Tractor,
  Wheat,
  MapPinned,
} from "lucide-react";
import {
  dashboardApi,
  inventoryApi,
  platformApi,
  sensorsApi,
  weatherApi,
  getApiError,
} from "@/api/client";
import { useScope } from "@/hooks/useScope";
import { formatAcres, formatNumber, formatPct, statusTone } from "@/lib/utils";
import { ErrorBanner, SkeletonKpis } from "@/components/ui/FormField";
import { StatCard, StatusBadge, ChartCard } from "@/components/ui/StatCard";
import { useRegisterPageTitle } from "@/components/layout/PageTitleContext";
import { density } from "@/theme";

const TONE_ACCENT: Record<string, string> = {
  healthy: "green.400",
  warning: "yellow.400",
  critical: "red.500",
  idle: "gray.400",
};

/** One row of the "Right now" band: a count, a label, and somewhere to go. */
function AttentionTile({
  icon,
  label,
  count,
  to,
  tone,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  to: string;
  tone: string;
  children?: React.ReactNode;
}) {
  return (
    <Card variant="surface" as={RouterLink} to={to} _hover={{ borderColor: "brand.300" }} transition="border-color 0.15s">
      <CardBody py={3}>
        <Flex align="center" gap={2}>
          <Box color={count > 0 ? tone : "fg.muted"}>{icon}</Box>
          <Text fontSize="sm" color="fg.muted">
            {label}
          </Text>
          <Spacer />
          <Text fontFamily="heading" fontSize="xl" fontWeight="semibold" color={count > 0 ? tone : "fg.muted"}>
            {count}
          </Text>
        </Flex>
        {children ? (
          <Box mt={1.5} fontSize="sm" color="fg.muted" noOfLines={2}>
            {children}
          </Box>
        ) : null}
      </CardBody>
    </Card>
  );
}

/**
 * Season overview, organised into three bands by urgency rather than a flat
 * stack of fifteen equal-weight cards: what needs attention now, where the
 * season stands, and trends (collapsed by default).
 */
export default function DashboardPage() {
  useRegisterPageTitle("Dashboard");
  const { seasonId, params } = useScope();

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
  const [summaryQ, progressQ, healthQ, irrigQ, expensesQ, yieldsQ, weatherQ, invAlertQ, liveQ, tasksQ] = results;
  const err = results.find((r) => r.error)?.error;
  const summary = summaryQ.data;

  const lowStock = invAlertQ.data ?? [];
  const sensorAlerts = (liveQ.data ?? []).filter((s) => statusTone(s.status) !== "healthy");
  const openTasks = tasksQ.data?.results ?? [];

  return (
    <Box>
      <Flex as="header" align="flex-start" justify="space-between" gap={4} wrap="wrap" mb={density.card}>
        <Box>
          <Heading size="lg">Season operations</Heading>
          <Text color="fg.muted" mt={1}>
            Acres, moisture, water, and alerts across the organization.
          </Text>
        </Box>
        <Flex gap={2}>
          <Button as={RouterLink} to="/scouting/new" variant="outline" colorScheme="gray">
            Log scout report
          </Button>
          <Button as={RouterLink} to="/map" colorScheme="brand">
            Open farm map
          </Button>
        </Flex>
      </Flex>

      <ErrorBanner message={err ? getApiError(err) : null} />

      {/* ── Band 1: needs attention ─────────────────────────────────────── */}
      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wider" color="fg.muted" mb={2}>
        Right now
      </Text>
      <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={density.card} mb={density.section}>
        <AttentionTile
          icon={<AlertTriangle size={16} />}
          label="Open alerts"
          count={summary?.open_alerts ?? 0}
          to="/notifications"
          tone="red.500"
        />
        <AttentionTile
          icon={<Radio size={16} />}
          label="Sensor alerts"
          count={sensorAlerts.length}
          to="/sensors"
          tone="orange.500"
        >
          {sensorAlerts.slice(0, 2).map((s) => s.name).join(", ") || "All live probes healthy."}
        </AttentionTile>
        <AttentionTile
          icon={<Package size={16} />}
          label="Low stock"
          count={lowStock.length}
          to="/inventory"
          tone="yellow.600"
        >
          {lowStock.slice(0, 2).map((a) => a.item_name).join(", ") || "Above reorder points."}
        </AttentionTile>
        <AttentionTile
          icon={<Gauge size={16} />}
          label="Open tasks"
          count={openTasks.length}
          to="/tasks"
          tone="blue.500"
        >
          {openTasks.slice(0, 2).map((t) => t.title).join(", ") || "Nothing queued."}
        </AttentionTile>
      </SimpleGrid>

      {/* ── Band 2: season state ────────────────────────────────────────── */}
      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wider" color="fg.muted" mb={2}>
        This season
      </Text>
      {summaryQ.isLoading ? (
        <SkeletonKpis count={5} />
      ) : (
        <SimpleGrid columns={{ base: 2, md: 3, xl: 5 }} spacing={density.card} mb={density.card}>
          <StatCard label="Acres" value={formatAcres(summary?.total_acres)} icon={<MapPinned size={14} />} hint="Owned + operated" />
          <StatCard label="Active fields" value={formatNumber(summary?.active_fields)} icon={<Wheat size={14} />} />
          <StatCard label="Yield estimate" value={`${formatNumber(summary?.yield_estimate, 0)} bu`} hint="Season to date" />
          <StatCard label="Water used" value={`${formatNumber(summary?.water_used, 0)} gal`} icon={<Droplets size={14} />} />
          <StatCard label="Equipment uptime" value={formatPct(summary?.equipment_uptime)} icon={<Tractor size={14} />} hint="Rolling 7-day" />
        </SimpleGrid>
      )}

      <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={density.card} mb={density.section}>
        <ChartCard title="Crop progress">
          {(progressQ.data ?? []).length === 0 ? (
            <Text color="fg.muted">No crop plans in this season. Add a plan for corn on North 80.</Text>
          ) : (
            (progressQ.data ?? []).slice(0, 5).map((c) => (
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

        <ChartCard
          title="Irrigation"
          action={
            <Link as={RouterLink} to="/irrigation" color="brand.500" fontSize="sm">
              Zones
            </Link>
          }
        >
          <Text fontFamily="heading" fontSize="3xl" lineHeight="1.1">
            {irrigQ.data?.zones_running ?? 0}
            <Text as="span" fontSize="md" color="fg.muted">
              {" "}
              / {irrigQ.data?.zones_total ?? 0} running
            </Text>
          </Text>
          <Text color="fg.muted" mt={1}>
            {formatNumber(irrigQ.data?.gallons_today)} gal today · {formatPct(irrigQ.data?.efficiency_pct)} efficiency
          </Text>
        </ChartCard>

        <ChartCard
          title="Weather now"
          action={
            <Link as={RouterLink} to="/weather" color="brand.500" fontSize="sm">
              Forecast
            </Link>
          }
        >
          {weatherQ.data ? (
            <Box>
              <Text fontFamily="heading" fontSize="3xl" lineHeight="1.1">
                {Math.round(weatherQ.data.temperature_f)}°
              </Text>
              <Text color="fg.muted" mt={1}>
                {weatherQ.data.conditions} · Wind {weatherQ.data.wind_mph} mph · RH {weatherQ.data.humidity}%
              </Text>
            </Box>
          ) : (
            <Text color="fg.muted">Select a farm with a weather station to see conditions.</Text>
          )}
        </ChartCard>
      </SimpleGrid>

      {/* ── Band 3: trends, collapsed by default ────────────────────────── */}
      <Accordion allowMultiple defaultIndex={[]}>
        <AccordionItem borderWidth="1px" borderColor="border.default" borderRadius="xl" bg="bg.surface" mb={density.card}>
          <AccordionButton py={3} px={4} _hover={{ bg: "bg.subtle" }} borderRadius="xl">
            <Heading size="sm" flex="1" textAlign="left">
              Field health
            </Heading>
            <Text fontSize="sm" color="fg.muted" mr={2}>
              {(healthQ.data ?? []).length} fields
            </Text>
            <AccordionIcon />
          </AccordionButton>
          <AccordionPanel px={4} pb={4}>
            {!healthQ.data?.length ? (
              <Text color="fg.muted">Field health cards appear once probes report in.</Text>
            ) : (
              <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={density.dense}>
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
                    <Text color="fg.muted" fontSize="sm">
                      {f.farm_name} · {f.crop_name ?? "Fallow"}
                    </Text>
                    <Flex align="center" gap={2} mt={2}>
                      <StatusBadge status={f.health_status} />
                      <Text as="span" color="fg.muted" fontSize="sm">
                        {f.moisture != null ? `${f.moisture}%` : "No probe"}
                      </Text>
                    </Flex>
                  </Box>
                ))}
              </SimpleGrid>
            )}
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem borderWidth="1px" borderColor="border.default" borderRadius="xl" bg="bg.surface">
          <AccordionButton py={3} px={4} _hover={{ bg: "bg.subtle" }} borderRadius="xl">
            <Heading size="sm" flex="1" textAlign="left">
              Trends
            </Heading>
            <Text fontSize="sm" color="fg.muted" mr={2}>
              Expenses · yield vs target
            </Text>
            <AccordionIcon />
          </AccordionButton>
          <AccordionPanel px={4} pb={4}>
            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={density.card}>
              <Box>
                <Text fontSize="sm" color="fg.muted" mb={2}>
                  Expenses
                </Text>
                <Box h="200px">
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
              </Box>
              <Box>
                <Text fontSize="sm" color="fg.muted" mb={2}>
                  Yield vs target
                </Text>
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
              </Box>
            </SimpleGrid>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </Box>
  );
}
