import { useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Box, Button, Card, CardBody, Flex, Heading, Select, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { cropsApi, getApiError } from "@/api/client";
import { DetailPage } from "@/components/templates/DetailPage";
import { DataTable } from "@/components/ui/DataTable";
import { StatCard, StatusBadge } from "@/components/ui/StatCard";
import { ConfirmDialog, Drawer } from "@/components/ui/Modal";
import { ErrorBanner, FormField } from "@/components/ui/FormField";
import { AssessmentPanel } from "@/components/planning/AssessmentPanel";
import { ComponentsEditor } from "@/components/planning/ComponentsEditor";
import { CropChip } from "@/components/planning/CropChip";
import { fmtMoney } from "@/lib/planning";
import { formatAcres, formatDate, formatNumber } from "@/lib/utils";
import type { StrategyComponent } from "@/types";

export default function CropPlanDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const planQ = useQuery({ queryKey: ["crop-plan", id], queryFn: () => cropsApi.getPlan(id), enabled: !!id });
  const assessQ = useQuery({ queryKey: ["crop-plan-assessment", id], queryFn: () => cropsApi.planAssessment(id), enabled: !!id });
  const schedQ = useQuery({ queryKey: ["planting-schedules", id], queryFn: () => cropsApi.plantingSchedules({ crop_plan: id }), enabled: !!id });
  const fertQ = useQuery({ queryKey: ["fertilizer-plans", id], queryFn: () => cropsApi.fertilizerPlans({ crop_plan: id }), enabled: !!id });
  const pestQ = useQuery({ queryKey: ["pesticides", id], queryFn: () => cropsApi.pesticides({ crop_plan: id }), enabled: !!id });
  const cropsQ = useQuery({ queryKey: ["crops"], queryFn: () => cropsApi.crops() });
  const varsQ = useQuery({ queryKey: ["varieties"], queryFn: () => cropsApi.varieties() });
  const plan = planQ.data;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [compOpen, setCompOpen] = useState(false);
  const [draft, setDraft] = useState<StrategyComponent[]>([]);
  const [compError, setCompError] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["crop-plan", id] });
    qc.invalidateQueries({ queryKey: ["crop-plans"] });
    qc.invalidateQueries({ queryKey: ["crop-plan-assessment", id] });
  };
  const setStatus = useMutation({
    mutationFn: (status: string) => cropsApi.patchPlan(id, { status }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: () => cropsApi.deletePlan(id),
    onSuccess: () => navigate("/crops/plans"),
  });
  const saveComponents = useMutation({
    mutationFn: async () => {
      if (!plan) return;
      await Promise.all(plan.components.map((c) => cropsApi.deletePlanComponent(c.id)));
      await Promise.all(
        draft.map((c, i) =>
          cropsApi.createPlanComponent({
            crop_plan: id,
            crop: c.crop,
            variety: c.variety ?? null,
            role: (c.role as "intercrop" | "relay" | "cover") ?? "intercrop",
            share_pct: c.share_pct,
            row_arrangement: c.row_arrangement ?? "",
            order: i + 1,
          }),
        ),
      );
      if (draft.length && plan.planting_system === "monoculture") {
        await cropsApi.patchPlan(id, { planting_system: "intercrop" });
      }
    },
    onSuccess: () => {
      invalidate();
      setCompOpen(false);
    },
    onError: (e) => setCompError(getApiError(e)),
  });

  const openComponents = () => {
    setDraft(
      (plan?.components ?? []).map((c) => ({
        crop: c.crop,
        variety: c.variety,
        share_pct: Number(c.share_pct),
        role: c.role,
        row_arrangement: c.row_arrangement,
      })),
    );
    setCompError(null);
    setCompOpen(true);
  };

  const primaryShare = plan ? 100 - plan.components.reduce((s, c) => s + Number(c.share_pct), 0) : 100;

  return (
    <>
      <DetailPage
        loading={planQ.isLoading}
        error={planQ.error ? getApiError(planQ.error) : !plan && !planQ.isLoading ? "Plan not found." : null}
        title={plan ? `${plan.crop_name} on ${plan.field_name}` : "Crop plan"}
        subtitle={
          plan ? (
            <Flex align="center" gap={2} wrap="wrap">
              <Text>
                {plan.season_name} · {plan.variety_name ?? "variety TBD"} · {plan.farm_name}
              </Text>
              <Badge textTransform="capitalize" colorScheme={plan.planting_system === "monoculture" ? "gray" : "brand"}>
                {plan.planting_system}
              </Badge>
              {plan.strategy_name ? <Badge variant="outline">from “{plan.strategy_name}”</Badge> : null}
            </Flex>
          ) : undefined
        }
        actions={
          plan ? (
            <>
              <Select
                size="sm"
                w="150px"
                value={plan.status}
                onChange={(e) => setStatus.mutate(e.target.value)}
                isDisabled={setStatus.isPending}
                aria-label="Plan status"
              >
                {["planned", "planted", "growing", "harvested", "cancelled"].map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </Select>
              <Button as={RouterLink} to={`/fields/${plan.field}`} variant="outline" colorScheme="gray" size="sm">
                Open field
              </Button>
              <Button variant="ghost" colorScheme="red" size="sm" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            </>
          ) : null
        }
        kpis={
          plan
            ? [
                <StatCard key="acres" label="Acres" value={formatAcres(plan.effective_acres)} />,
                <StatCard key="target" label="Target yield" value={plan.target_yield ? `${formatNumber(plan.target_yield, 0)} ${plan.yield_unit}/ac` : "—"} />,
                <StatCard key="plant" label="Planting" value={formatDate(plan.planting_date)} />,
                <StatCard key="harvest" label="Harvest" value={formatDate(plan.expected_harvest_date)} hint={assessQ.data ? `${assessQ.data.days_to_maturity} days to maturity` : undefined} />,
              ]
            : undefined
        }
        tabs={
          plan
            ? [
                {
                  id: "overview",
                  label: "Overview",
                  render: () => (
                    <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
                      <Card variant="surface">
                        <CardBody>
                          <Heading size="sm" mb={3}>
                            Window & rotation
                          </Heading>
                          <AssessmentPanel data={assessQ.data} loading={assessQ.isLoading} />
                        </CardBody>
                      </Card>
                      <Card variant="surface">
                        <CardBody>
                          <Flex align="center" mb={3}>
                            <Heading size="sm">Crop mix</Heading>
                            <Box flex="1" />
                            <Button size="sm" variant="outline" colorScheme="gray" onClick={openComponents}>
                              {plan.components.length ? "Edit mix" : "Add intercrop"}
                            </Button>
                          </Flex>
                          <Stack spacing={2}>
                            <Flex align="center" gap={3} p={2.5} bg="bg.subtle" borderRadius="md">
                              <CropChip name={plan.crop_name ?? "Crop"} color={plan.crop_color} detail={plan.variety_name ?? "primary"} />
                              <Box flex="1" />
                              <Text fontSize="sm" fontWeight="semibold">
                                {primaryShare}%
                              </Text>
                            </Flex>
                            {plan.components.map((c) => (
                              <Flex key={c.id} align="center" gap={3} p={2.5} borderWidth="1px" borderColor="border.default" borderRadius="md">
                                <CropChip name={c.crop_name ?? "Crop"} color={c.color_hex} detail={[c.variety_name, c.role, c.row_arrangement].filter(Boolean).join(" · ")} />
                                <Box flex="1" />
                                <Text fontSize="sm" fontWeight="semibold">
                                  {Number(c.share_pct)}%
                                </Text>
                              </Flex>
                            ))}
                            {!plan.components.length ? (
                              <Text fontSize="sm" color="fg.muted">
                                Monoculture. Add an intercrop, relay, or cover component to model a mixed system.
                              </Text>
                            ) : null}
                          </Stack>
                          {plan.notes ? (
                            <Text color="fg.muted" fontSize="sm" mt={4}>
                              {plan.notes}
                            </Text>
                          ) : null}
                        </CardBody>
                      </Card>
                    </SimpleGrid>
                  ),
                },
                {
                  id: "schedule",
                  label: "Schedule",
                  render: () => (
                    <DataTable
                      rows={schedQ.data?.results ?? []}
                      rowKey={(s) => s.id}
                      emptyTitle="No scheduled stages"
                      emptyBody="Tillage, planting, side-dress, and harvest stages will list here."
                      columns={[
                        { key: "stage", header: "Stage" },
                        { key: "scheduled_date", header: "Scheduled", render: (s) => formatDate(s.scheduled_date) },
                        { key: "completed_date", header: "Completed", render: (s) => (s.completed_date ? formatDate(s.completed_date) : <StatusBadge status="pending" label="Pending" />) },
                        { key: "notes", header: "Notes", render: (s) => s.notes || "—" },
                      ]}
                    />
                  ),
                },
                {
                  id: "inputs",
                  label: "Inputs",
                  render: () => (
                    <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
                      <Box>
                        <Heading size="sm" mb={3}>
                          Fertilizer
                        </Heading>
                        <DataTable
                          rows={fertQ.data?.results ?? []}
                          rowKey={(r) => r.id}
                          emptyTitle="No fertilizer events"
                          emptyBody="MAP, UAN, and side-dress passes will list here."
                          columns={[
                            { key: "product_name", header: "Product", render: (r) => `${r.product_name}${r.nutrient_analysis ? ` (${r.nutrient_analysis})` : ""}` },
                            { key: "rate", header: "Rate", render: (r) => `${formatNumber(r.rate_per_acre, 1)} ${r.unit}/ac` },
                            { key: "application_date", header: "Date", render: (r) => formatDate(r.application_date) },
                            { key: "method", header: "Method", render: (r) => r.method || "—" },
                            { key: "cost", header: "Cost", render: (r) => fmtMoney(r.cost) },
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
                            { key: "product_name", header: "Product" },
                            { key: "target_pest", header: "Target", render: (r) => r.target_pest || "—" },
                            { key: "rate", header: "Rate", render: (r) => `${formatNumber(r.rate_per_acre, 1)} ${r.unit}/ac` },
                            { key: "application_date", header: "Applied", render: (r) => formatDate(r.application_date) },
                            { key: "phi", header: "PHI / REI", render: (r) => `${r.phi_days}d / ${r.reentry_hours}h` },
                          ]}
                        />
                      </Box>
                    </SimpleGrid>
                  ),
                },
              ]
            : []
        }
      />

      <Drawer open={compOpen} title="Crop mix" onClose={() => setCompOpen(false)} wide>
        <ErrorBanner message={compError} />
        <FormField label="Secondary crops" hint="Shares are percentages of the field; the primary takes the remainder.">
          <ComponentsEditor
            value={draft}
            onChange={setDraft}
            crops={cropsQ.data?.results ?? []}
            varieties={varsQ.data?.results ?? []}
            primaryCropId={plan?.crop}
            primaryCropName={plan?.crop_name}
          />
        </FormField>
        <Button colorScheme="brand" onClick={() => saveComponents.mutate()} isDisabled={saveComponents.isPending}>
          {saveComponents.isPending ? "Saving…" : "Save mix"}
        </Button>
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this crop plan?"
        body="Schedules and input records attached to the plan are removed too."
        confirmLabel="Delete plan"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
