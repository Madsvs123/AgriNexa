import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  Heading,
  Input,
  Link,
  Progress,
  SimpleGrid,
  Spacer,
  Text,
} from "@chakra-ui/react";
import { getApiError, irrigationApi } from "@/api/client";
import { formatDateTime, formatNumber, formatTime } from "@/lib/utils";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { StatusBadge, ChartCard, EmptyState } from "@/components/ui/StatCard";
import { Modal } from "@/components/ui/Modal";

export default function IrrigationPage() {
  const qc = useQueryClient();
  const zonesQ = useQuery({ queryKey: ["irrigation-zones"], queryFn: () => irrigationApi.zones() });
  const schedQ = useQuery({ queryKey: ["irrigation-schedules"], queryFn: () => irrigationApi.schedules() });
  const recQ = useQuery({ queryKey: ["irrigation-recs"], queryFn: () => irrigationApi.recommendations() });
  const analyticsQ = useQuery({ queryKey: ["irrigation-analytics"], queryFn: () => irrigationApi.analytics() });
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [minutes, setMinutes] = useState("30");
  const [reason, setReason] = useState("Manual soak ahead of heat");
  const override = useMutation({
    mutationFn: () => irrigationApi.override(overrideId!, { duration_minutes: Number(minutes), notes: reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["irrigation-zones"] });
      setOverrideId(null);
    },
  });
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  return (
    <Box>
      <PageHeader title="Irrigation" subtitle="Zones, schedules, recommendations, and water efficiency." />
      <ErrorBanner message={zonesQ.error ? getApiError(zonesQ.error) : null} />
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={4}>
        {(zonesQ.data?.results ?? []).map((z) => (
          <Card key={z.id} as="article" variant="outline" borderColor="border.default" bg="bg.surface">
            <CardBody>
              <Flex align="center" gap={2}>
                <Link as={RouterLink} to={`/irrigation/zones/${z.id}`}>
                  <Text as="strong">{z.name}</Text>
                </Link>
                <Spacer />
                <StatusBadge status={z.status} />
              </Flex>
              <Text color="fg.muted">
                {z.field_name} · {z.method}
              </Text>
              <Text>
                Moisture {z.moisture ?? "—"}% / threshold {z.threshold}%
              </Text>
              <Progress
                value={Math.min(100, ((z.moisture ?? 0) / Math.max(z.threshold, 1)) * 100)}
                size="sm"
                colorScheme="brand"
                borderRadius="full"
                my={2}
              />
              <Button variant="ghost" colorScheme="gray" size="sm" onClick={() => setOverrideId(z.id)}>
                Manual override
              </Button>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>
      {!zonesQ.data?.results.length ? (
        <Card variant="outline" borderColor="border.default" bg="bg.surface">
          <EmptyState title="No irrigation zones" body="Create a pivot or drip zone on South Bottom to schedule sets." />
        </Card>
      ) : null}

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
        <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface">
          <CardBody>
            <Heading size="sm" mb={3}>
              Schedules
            </Heading>
            {(schedQ.data?.results ?? []).map((s) => (
              <Flex key={s.id} align="center" gap={2} justify="space-between" mb={2.5}>
                <Box>
                  <Text as="strong">{s.zone_name ?? "Zone"}</Text>
                  <Text color="fg.muted">
                    {formatTime(s.start_time)} · {s.duration_minutes} min · {(s.days_of_week ?? []).join(", ")}
                  </Text>
                </Box>
                <StatusBadge status={s.is_active ? "healthy" : "idle"} label={s.is_active ? "On" : "Off"} />
              </Flex>
            ))}
            {!schedQ.data?.results.length ? <Text color="fg.muted">No repeating sets. Add a 5 a.m. corn pivot program.</Text> : null}
          </CardBody>
        </Card>
        <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface">
          <CardBody>
            <Heading size="sm" mb={3}>
              Recommendations
            </Heading>
            {(recQ.data ?? []).filter((r) => !dismissedIds.includes(r.id)).map((r) => (
              <Box key={r.id} borderWidth="1px" borderColor="border.default" borderRadius="xl" bg="bg.subtle" p={4} mb={2}>
                <Flex align="center" gap={2}>
                  <StatusBadge status={r.priority} />
                  <Text as="strong">{r.zone_name}</Text>
                </Flex>
                <Text>{r.message}</Text>
                <Text color="fg.muted">
                  {r.suggested_minutes} min suggested · {formatDateTime(r.created_at)}
                </Text>
                <Flex align="center" gap={2} mt={2}>
                  <Button colorScheme="brand" size="sm" onClick={() => setOverrideId(r.zone)}>
                    Apply
                  </Button>
                  <Button variant="ghost" colorScheme="gray" size="sm" onClick={() => setDismissedIds((ids) => [...ids, r.id])}>
                    Dismiss
                  </Button>
                </Flex>
              </Box>
            ))}
            {!recQ.data?.length ? <Text color="fg.muted">No moisture-driven recommendations right now.</Text> : null}
          </CardBody>
        </Card>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <ChartCard title="Water by day">
          <Box h="220px">
            <ResponsiveContainer>
              <LineChart data={analyticsQ.data?.daily ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
                <XAxis dataKey="date" hide />
                <YAxis />
                <Tooltip />
                <Line dataKey="gallons" stroke="#3D7EA6" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </ChartCard>
        <ChartCard title="Efficiency by zone">
          <Text color="fg.muted">
            {formatNumber(analyticsQ.data?.efficiency_pct)}% efficiency · {formatNumber(analyticsQ.data?.gallons_this_week)} gal this week
          </Text>
          <Box h="180px">
            <ResponsiveContainer>
              <BarChart data={analyticsQ.data?.by_zone ?? []}>
                <XAxis dataKey="zone_name" hide />
                <Tooltip />
                <Bar dataKey="gallons" fill="#2F6F4E" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </ChartCard>
      </SimpleGrid>

      <Modal
        open={!!overrideId}
        title="Manual irrigation override"
        onClose={() => setOverrideId(null)}
        footer={
          <>
            <Button variant="ghost" colorScheme="gray" onClick={() => setOverrideId(null)}>
              Cancel
            </Button>
            <Button colorScheme="brand" isDisabled={override.isPending} onClick={() => override.mutate()}>
              Run set
            </Button>
          </>
        }
      >
        <FormField label="Duration (minutes)" htmlFor="dur">
          <Input id="dur" type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </FormField>
        <FormField label="Reason" htmlFor="reason">
          <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </Modal>
    </Box>
  );
}
