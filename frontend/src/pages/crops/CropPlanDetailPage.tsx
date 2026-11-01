import { Link as RouterLink, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays, parseISO } from "date-fns";
import { Box, Card, CardBody, Flex, Grid, Heading, Link, SimpleGrid, Text } from "@chakra-ui/react";
import { cropsApi, getApiError } from "@/api/client";
import { formatAcres, formatDate } from "@/lib/utils";
import { PageHeader, ErrorBanner, SkeletonBlock } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatCard";
import { DataTable } from "@/components/ui/DataTable";

export default function CropPlanDetailPage() {
  const { id = "" } = useParams();
  const planQ = useQuery({ queryKey: ["crop-plan", id], queryFn: () => cropsApi.getPlan(id), enabled: !!id });
  const schedQ = useQuery({ queryKey: ["planting-schedules", id], queryFn: () => cropsApi.plantingSchedules({ crop_plan: id }) });
  const fertQ = useQuery({ queryKey: ["fertilizer-plans", id], queryFn: () => cropsApi.fertilizerPlans({ crop_plan: id }) });
  const pestQ = useQuery({ queryKey: ["pesticides", id], queryFn: () => cropsApi.pesticides({ crop_plan: id }) });
  const plan = planQ.data;

  if (planQ.isLoading) {
    return (
      <Box>
        <SkeletonBlock />
      </Box>
    );
  }
  if (!plan) {
    return (
      <Box>
        <ErrorBanner message={planQ.error ? getApiError(planQ.error) : "Plan not found."} />
      </Box>
    );
  }

  const ganttStart = (schedQ.data?.results ?? []).reduce((min, s) => {
    const t = parseISO(s.start_date).getTime();
    return t < min ? t : min;
  }, Date.now());

  return (
    <Box>
      <PageHeader
        title={plan.name}
        subtitle={`${plan.crop_name} · ${plan.variety_name ?? "Variety TBD"} · ${plan.field_name}`}
        crumbs={
          <>
            <Link as={RouterLink} to="/crops/plans">
              Plans
            </Link>
            <Text as="span" mx={1}>
              /
            </Text>
            <Text as="span">{plan.name}</Text>
          </>
        }
      />
      <Flex align="center" gap={4} wrap="wrap" mb={4}>
        <StatusBadge status={plan.status} />
        <Text as="span">{formatAcres(plan.planted_acres)}</Text>
        <Text as="span">Target {plan.target_yield ?? "—"} bu/ac</Text>
        <Text as="span">Plant {formatDate(plan.planting_date)}</Text>
        <Text as="span">Harvest {formatDate(plan.expected_harvest)}</Text>
      </Flex>
      <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface" mb={4}>
        <CardBody>
          <Heading size="sm" mb={3}>
            Planting schedule
          </Heading>
          {(schedQ.data?.results ?? []).map((s) => {
            const start = parseISO(s.start_date);
            const offset = Math.max(0, differenceInDays(start, new Date(ganttStart)));
            const width = Math.max(8, differenceInDays(parseISO(s.end_date), start) * 12);
            return (
              <Grid key={s.id} templateColumns={{ base: "1fr", md: "220px 1fr" }} gap={3} alignItems="center" mb={3}>
                <Box>
                  <Text fontWeight="semibold">{s.activity}</Text>
                  <Text color="fg.muted">{s.field_name ?? plan.field_name}</Text>
                </Box>
                <Box position="relative" bg="bg.subtle" borderRadius="lg" h="28px">
                  <Box
                    h="100%"
                    bg="brand.500"
                    borderRadius="lg"
                    ml={`${offset * 8}px`}
                    w={`${width}px`}
                    title={`${formatDate(s.start_date)} – ${formatDate(s.end_date)}`}
                  />
                </Box>
              </Grid>
            );
          })}
          {!schedQ.data?.results.length ? (
            <Text color="fg.muted">Add tillage, plant, and harvest windows to see the Gantt.</Text>
          ) : null}
        </CardBody>
      </Card>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <Box>
          <Heading size="sm" mb={3}>
            Fertilizer plan
          </Heading>
          <DataTable
            rows={fertQ.data?.results ?? []}
            rowKey={(r) => r.id}
            emptyTitle="No fertilizer events"
            emptyBody="MAP, UAN, and sidedress will list here."
            columns={[
              { key: "product", header: "Product" },
              { key: "rate", header: "Rate" },
              { key: "scheduled_date", header: "Date", render: (r) => formatDate(r.scheduled_date) },
              { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
            ]}
          />
        </Box>
        <Box>
          <Heading size="sm" mb={3}>
            Pesticide applications
          </Heading>
          <DataTable
            rows={pestQ.data?.results ?? []}
            rowKey={(r) => r.id}
            emptyTitle="No applications"
            emptyBody="Post-emerge and fungicide passes will list here."
            columns={[
              { key: "product", header: "Product" },
              { key: "target", header: "Target" },
              { key: "rate", header: "Rate" },
              { key: "applied_at", header: "Applied", render: (r) => formatDate(r.applied_at) },
            ]}
          />
        </Box>
      </SimpleGrid>
    </Box>
  );
}
