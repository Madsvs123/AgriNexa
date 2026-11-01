import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  Heading,
  Input,
  Select,
  SimpleGrid,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Stack,
  Text,
  useToast,
} from "@chakra-ui/react";
import { cropsApi, farmsApi, getApiError } from "@/api/client";
import { useTranslation } from "react-i18next";
import { DetailPage } from "@/components/templates/DetailPage";
import { DataTable } from "@/components/ui/DataTable";
import { StatCard } from "@/components/ui/StatCard";
import { ConfirmDialog, Drawer } from "@/components/ui/Modal";
import { ErrorBanner, FormField } from "@/components/ui/FormField";
import { AssessmentPanel } from "@/components/planning/AssessmentPanel";
import { ComponentsEditor } from "@/components/planning/ComponentsEditor";
import { ConstraintBars } from "@/components/planning/ConstraintBars";
import { CropChip } from "@/components/planning/CropChip";
import { MetricGrid } from "@/components/planning/MetricGrid";
import { usePlanningMessage } from "@/components/planning/PlanningMessage";
import { useDebounced } from "@/hooks/useDebounced";
import { PLANTING_SYSTEMS, RAINFALL_OPTIONS, fitScheme, riskScheme } from "@/lib/planning";
import { formatDate, formatNumber } from "@/lib/utils";
import { formatAcres } from "@/lib/utils";
import type { Field, PlantingSystem, StrategyAllocation, StrategyComponent } from "@/types";
import { formatCurrency } from "@/i18n/format";
import { usePlanningLabels } from "@/lib/usePlanningLabels";

type Draft = {
  field: string;
  crop: string;
  variety: string;
  planting_system: PlantingSystem;
  planting_date: string;
  acres: string;
  components: StrategyComponent[];
  notes: string;
};

function AllocationDrawer({
  open,
  onClose,
  field,
  initial,
  strategyId,
  season,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  field: Field | null;
  initial: StrategyAllocation | null;
  strategyId: string;
  season: string;
  onSaved: () => void;
}) {
  const cropsQ = useQuery({ queryKey: ["crops"], queryFn: () => cropsApi.crops() });
  const varsQ = useQuery({ queryKey: ["varieties"], queryFn: () => cropsApi.varieties() });
  const { t } = useTranslation("grow");
  const labels = usePlanningLabels();
  const crops = cropsQ.data?.results ?? [];
  const varieties = varsQ.data?.results ?? [];
  const [d, setD] = useState<Draft>({ field: "", crop: "", variety: "", planting_system: "monoculture", planting_date: "", acres: "", components: [], notes: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && field) {
      setD({
        field: field.id,
        crop: initial?.crop ?? "",
        variety: initial?.variety ?? "",
        planting_system: initial?.planting_system ?? "monoculture",
        planting_date: initial?.planting_date ?? "",
        acres: initial?.acres == null ? "" : String(initial.acres),
        components: initial?.components ?? [],
        notes: initial?.notes ?? "",
      });
      setError(null);
    }
  }, [open, field, initial]);

  const debouncedDate = useDebounced(d.planting_date, 300);
  const assessQ = useQuery({
    queryKey: ["assess", d.field, d.crop, d.variety, debouncedDate, season],
    queryFn: () => cropsApi.assess({ field: d.field, crop: d.crop, season, variety: d.variety || undefined, planting_date: debouncedDate || undefined }),
    enabled: open && !!d.field && !!d.crop && !!season,
    placeholderData: (prev) => prev,
  });
  const recQ = useQuery({
    queryKey: ["recommend", d.field, d.crop, debouncedDate, season],
    queryFn: () => cropsApi.recommendVarieties({ field: d.field, crop: d.crop, season, planting_date: debouncedDate || undefined }),
    enabled: open && !!d.field && !!d.crop && !!season,
  });

  const save = useMutation({
    mutationFn: () => {
      const body: Partial<StrategyAllocation> = {
        strategy: strategyId,
        field: d.field,
        crop: d.crop || null,
        variety: d.variety || null,
        planting_system: d.planting_system,
        planting_date: d.planting_date || null,
        acres: d.acres ? Number(d.acres) : null,
        components: d.planting_system === "monoculture" ? [] : d.components,
        notes: d.notes,
      };
      return initial ? cropsApi.patchAllocation(initial.id, body) : cropsApi.createAllocation(body);
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (e) => setError(getApiError(e)),
  });
  const remove = useMutation({
    mutationFn: () => cropsApi.deleteAllocation(initial!.id),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  const cropVarieties = varieties.filter((v) => v.crop === d.crop && v.is_active);
  const selectedCrop = crops.find((c) => c.id === d.crop);
  const mixed = d.planting_system !== "monoculture" && d.planting_system !== "cover";

  return (
    <Drawer open={open} title={field ? `${field.name} · ${field.acres} ac` : "Allocation"} onClose={onClose} wide>
      <ErrorBanner message={error} />
      <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={4}>
        <FormField label={t("labels.crop", { ns: "common" })} htmlFor="a-crop" hint={field?.soil_type ? `${t("labels.soil", { ns: "common" })}: ${labels.soil(field.soil_type)}` : undefined}>
          <Select id="a-crop" value={d.crop} onChange={(e) => setD({ ...d, crop: e.target.value, variety: "", components: [] })}>
            <option value="">{t("detail.leaveFallow")}</option>
            {crops.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField label={t("plans.plantingSystem")} htmlFor="a-sys">
          <Select id="a-sys" value={d.planting_system} onChange={(e) => setD({ ...d, planting_system: e.target.value as PlantingSystem })}>
            {PLANTING_SYSTEMS.map((v) => (
              <option key={v} value={v}>
                {labels.plantingSystem(v)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t("labels.planting", { ns: "common" })} htmlFor="a-date">
          <Input id="a-date" type="date" value={d.planting_date} onChange={(e) => setD({ ...d, planting_date: e.target.value })} />
        </FormField>
        <FormField label={t("labels.acres", { ns: "common" })} htmlFor="a-acres" hint={t("detail.blankWholeField")}>
          <Input id="a-acres" type="number" step="0.1" value={d.acres} onChange={(e) => setD({ ...d, acres: e.target.value })} />
        </FormField>
      </SimpleGrid>

      {d.crop ? (
        <FormField label={t("labels.variety", { ns: "common" })} htmlFor="a-var" hint={recQ.data?.results.length ? t("detail.rankedForField") : undefined}>
          <Select id="a-var" value={d.variety} onChange={(e) => setD({ ...d, variety: e.target.value })} isDisabled={!cropVarieties.length}>
            <option value="">{cropVarieties.length ? t("detail.useCropDefaults") : t("composer.noVarieties")}</option>
            {(recQ.data?.results ?? cropVarieties.map((v) => ({ variety_id: v.id, name: v.name, score: null as number | null, days_to_maturity: v.days_to_maturity }))).map((r) => (
              <option key={r.variety_id} value={r.variety_id}>
                {r.name} · {r.days_to_maturity}d{r.score != null ? ` · score ${r.score}` : ""}
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}

      {d.crop && mixed ? (
        <FormField label={t("detail.mixedComponents")}>
          <ComponentsEditor value={d.components} onChange={(c) => setD({ ...d, components: c })} crops={crops} varieties={varieties} primaryCropId={d.crop} primaryCropName={selectedCrop?.name} />
        </FormField>
      ) : null}

      {d.crop ? (
        <Card variant="inset" mb={4}>
          <CardBody>
            <AssessmentPanel data={assessQ.data} loading={assessQ.isFetching} compact />
          </CardBody>
        </Card>
      ) : null}

      <FormField label={t("labels.notes", { ns: "common" })} htmlFor="a-notes">
        <Input id="a-notes" value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
      </FormField>
      <Flex gap={2}>
        <Button colorScheme="brand" onClick={() => save.mutate()} isDisabled={save.isPending}>
          {save.isPending ? t("actions.saving", { ns: "common" }) : t("detail.saveAllocation")}
        </Button>
        {initial ? (
          <Button variant="ghost" colorScheme="red" onClick={() => remove.mutate()} isDisabled={remove.isPending}>
            {t("actions.remove", { ns: "common" })}
          </Button>
        ) : null}
      </Flex>
    </Drawer>
  );
}

export default function StrategyDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation("grow");
  const renderMessage = usePlanningMessage();
  const labels = usePlanningLabels();
  const stratQ = useQuery({ queryKey: ["strategy", id], queryFn: () => cropsApi.getStrategy(id), enabled: !!id });
  const s = stratQ.data;
  const fieldsQ = useQuery({ queryKey: ["fields", { farm: s?.farm }], queryFn: () => farmsApi.fields({ farm: s?.farm }), enabled: !!s?.farm });
  const cropsQ = useQuery({ queryKey: ["crops"], queryFn: () => cropsApi.crops() });
  const crops = cropsQ.data?.results ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["strategy", id] });
    qc.invalidateQueries({ queryKey: ["strategies"] });
  };

  const [editField, setEditField] = useState<Field | null>(null);
  const [adoptOpen, setAdoptOpen] = useState(false);
  const [forceAdopt, setForceAdopt] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Assumptions (debounced patch)
  const [price, setPrice] = useState(1);
  const [yld, setYld] = useState(1);
  const [cost, setCost] = useState(1);
  const [rain, setRain] = useState<"dry" | "normal" | "wet">("normal");
  useEffect(() => {
    if (s) {
      setPrice(Number(s.price_multiplier));
      setYld(Number(s.yield_multiplier));
      setCost(Number(s.cost_multiplier));
      setRain(s.rainfall_scenario);
    }
  }, [s?.id, s?.price_multiplier, s?.yield_multiplier, s?.cost_multiplier, s?.rainfall_scenario]); // eslint-disable-line react-hooks/exhaustive-deps
  const assumptions = useDebounced({ price, yld, cost, rain }, 400);
  const patchAssumptions = useMutation({
    mutationFn: () => cropsApi.patchStrategy(id, { price_multiplier: assumptions.price, yield_multiplier: assumptions.yld, cost_multiplier: assumptions.cost, rainfall_scenario: assumptions.rain }),
    onSuccess: invalidate,
  });
  useEffect(() => {
    if (!s) return;
    const changed =
      Number(s.price_multiplier) !== assumptions.price ||
      Number(s.yield_multiplier) !== assumptions.yld ||
      Number(s.cost_multiplier) !== assumptions.cost ||
      s.rainfall_scenario !== assumptions.rain;
    if (changed) patchAssumptions.mutate();
  }, [assumptions]); // eslint-disable-line react-hooks/exhaustive-deps

  const evaluate = useMutation({ mutationFn: () => cropsApi.evaluateStrategy(id), onSuccess: invalidate });
  const clone = useMutation({
    mutationFn: () => cropsApi.cloneStrategy(id),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["strategies"] });
      navigate(`/crops/strategies/${c.id}`);
    },
  });
  const setBaseline = useMutation({ mutationFn: () => cropsApi.patchStrategy(id, { is_baseline: true }), onSuccess: invalidate });
  const adopt = useMutation({
    mutationFn: () => cropsApi.adoptStrategy(id, forceAdopt),
    onSuccess: (r) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["crop-plans"] });
      setAdoptOpen(false);
      toast({
        status: "success",
        title: t("detail.adoptedToast"),
        description: r.skipped.length
          ? t("detail.adoptedSkipped", {
              created: r.created.length,
              updated: r.updated.length,
              skipped: r.skipped.length,
            })
          : t("detail.adoptedDetail", { created: r.created.length, updated: r.updated.length }),
      });
    },
    onError: (e) => toast({ status: "error", title: t("detail.adoptFailed"), description: getApiError(e) }),
  });
  const remove = useMutation({ mutationFn: () => cropsApi.deleteStrategy(id), onSuccess: () => navigate("/crops/strategies") });

  const ev = s?.evaluation;
  const fields = fieldsQ.data?.results ?? [];
  const byField = useMemo(() => new Map((s?.allocations ?? []).map((a) => [a.field, a])), [s?.allocations]);
  const fieldResult = (fid: string) => ev?.fields.find((f) => f.field_id === fid);

  return (
    <>
      <DetailPage
        loading={stratQ.isLoading}
        error={stratQ.error ? getApiError(stratQ.error) : !s && !stratQ.isLoading ? t("detail.notFound", "Strategy not found.") : null}
        title={s?.name ?? "Strategy"}
        subtitle={
          s ? (
            <Flex align="center" gap={2} wrap="wrap">
              <Text>{s.farm_name} · {s.season_name}</Text>
              <Badge textTransform="capitalize" colorScheme={s.status === "adopted" ? "green" : s.status === "candidate" ? "blue" : "gray"}>{s.status}</Badge>
              {s.is_baseline ? <Badge colorScheme="yellow">{t("detail.baseline")}</Badge> : null}
              {s.rotation_name ? <Badge variant="outline">{t("detail.fromRotation", { name: s.rotation_name })}</Badge> : null}
              {ev ? <Badge colorScheme={ev.feasible ? "green" : "red"}>{ev.feasible ? t("detail.feasible") : t("strategies.violations", { count: ev.hard_violations })}</Badge> : null}
            </Flex>
          ) : undefined
        }
        actions={
          s ? (
            <>
              <Button size="sm" variant="ghost" colorScheme="gray" onClick={() => evaluate.mutate()} isDisabled={evaluate.isPending}>
                {evaluate.isPending ? t("detail.evaluating") : t("detail.reEvaluate")}
              </Button>
              <Button size="sm" variant="outline" colorScheme="gray" onClick={() => clone.mutate()}>
                {t("actions.clone", { ns: "common" })}
              </Button>
              {!s.is_baseline ? <Button size="sm" variant="outline" colorScheme="gray" onClick={() => setBaseline.mutate()}>
                  {t("strategies.setBaseline")}
                </Button> : null}
              <Button size="sm" as={RouterLink} to={`/crops/strategies/compare?ids=${id}`} variant="outline" colorScheme="gray">
                {t("compare.compare")}
              </Button>
              <Button size="sm" colorScheme="brand" onClick={() => { setForceAdopt(false); setAdoptOpen(true); }} isDisabled={s.status === "adopted" || !s.allocations?.length}>
                {s.status === "adopted" ? t("detail.adopted") : t("detail.adopt")}
              </Button>
              <Button size="sm" variant="ghost" colorScheme="red" onClick={() => setConfirmDelete(true)}>
                {t("actions.delete", { ns: "common" })}
              </Button>
            </>
          ) : null
        }
        kpis={
          ev
            ? [
                <StatCard key="m" label={t("detail.netMargin")} value={formatCurrency(ev.totals.margin)} hint={t("detail.perAcre", { value: formatCurrency(ev.totals.margin_per_acre) })} />,
                <StatCard key="r" label={t("detail.risk")} value={<Badge colorScheme={riskScheme(ev.risk_score)} fontSize="lg" px={2}>{ev.risk_score}</Badge>} hint={t("detail.riskHint")} />,
                <StatCard key="d" label={t("detail.diversity")} value={ev.diversity_index.toFixed(2)} hint={t("detail.diversityHint", { count: ev.crop_count })} />,
                <StatCard key="rot" label={t("detail.rotation")} value={ev.rotation_score != null ? ev.rotation_score : "—"} hint={t("detail.rotationHint")} />,
              ]
            : undefined
        }
        rail={
          ev ? (
            <Stack spacing={4}>
              <Card variant="surface">
                <CardBody>
                  <Heading size="xs" mb={3}>{t("detail.constraints")}</Heading>
                  <ConstraintBars results={ev.constraints} compact />
                </CardBody>
              </Card>
              <Card variant="surface">
                <CardBody>
                  <Heading size="xs" mb={3}>{t("detail.cropMix")}</Heading>
                  <Stack spacing={1.5}>
                    {Object.entries(ev.totals.crop_acres).sort((a, b) => b[1] - a[1]).map(([name, acres]) => (
                      <Flex key={name} align="center" gap={2} fontSize="sm">
                        <CropChip name={name} color={crops.find((c) => c.name === name)?.color_hex} size="xs" />
                        <Box flex="1" />
                        <Text color="fg.muted">{formatNumber(acres, 0)} ac · {ev.totals.acres ? Math.round((acres / ev.totals.acres) * 100) : 0}%</Text>
                      </Flex>
                    ))}
                    {ev.unplanted_acres ? (
                      <Text fontSize="sm" color="fg.muted">{t("detail.unallocatedAcres", { acres: formatAcres(ev.unplanted_acres) })}</Text>
                    ) : null}
                  </Stack>
                </CardBody>
              </Card>
              {ev.warnings.length ? (
                <Card variant="surface">
                  <CardBody>
                    <Heading size="xs" mb={2}>{t("detail.warningsCount", { count: ev.warnings.length })}</Heading>
                    <Stack spacing={1.5}>
                      {ev.warnings.slice(0, 8).map((w, i) => (
                        <Text key={`${w.code}-${i}`} fontSize="xs" color="fg.muted">
                          • {renderMessage(w)}
                        </Text>
                      ))}
                    </Stack>
                  </CardBody>
                </Card>
              ) : null}
            </Stack>
          ) : undefined
        }
        tabs={
          s
            ? [
                {
                  id: "allocations",
                  label: t("detail.fieldsTab", { allocated: s.allocations?.length ?? 0, total: fields.length }),
                  render: () => (
                    <Stack spacing={3}>
                      <Text color="fg.muted" fontSize="sm">
                        {t("detail.allocationsIntro")}
                      </Text>
                      <DataTable
                        rows={fields}
                        rowKey={(f) => f.id}
                        onRowClick={(f) => setEditField(f)}
                        emptyTitle={t("detail.noFieldsTitle")}
                        emptyBody={t("detail.noFieldsBody")}
                        columns={[
                          { key: "name", header: t("detail.columns.field"), render: (f) => <Box><Text fontWeight="semibold">{f.name}</Text><Text fontSize="xs" color="fg.muted">{f.acres} ac · {f.soil_type || "soil ?"}</Text></Box> },
                          {
                            key: "crop",
                            header: t("detail.columns.crop"),
                            render: (f) => {
                              const a = byField.get(f.id);
                              if (!a) return <Text color="fg.muted" fontSize="sm">{t("detail.unallocated")}</Text>;
                              return (
                                <Flex direction="column" gap={1}>
                                  <CropChip name={a.crop_name ?? "Fallow"} color={a.crop_color} detail={a.variety_name} />
                                  {a.components?.length ? (
                                    <Flex gap={1} wrap="wrap">
                                      {a.components.map((c, i) => (
                                        <Badge key={i} variant="outline" fontSize="10px" textTransform="none">+ {crops.find((x) => x.id === c.crop)?.name ?? "?"} {c.share_pct}%</Badge>
                                      ))}
                                    </Flex>
                                  ) : null}
                                </Flex>
                              );
                            },
                          },
                          { key: "system", header: t("detail.columns.system"), render: (f) => { const a = byField.get(f.id); return a ? <Badge colorScheme={a.planting_system === "monoculture" ? "gray" : "brand"}>{labels.plantingSystem(a.planting_system)}</Badge> : null; } },
                          { key: "date", header: t("detail.columns.plant"), render: (f) => { const a = byField.get(f.id); return a ? formatDate(a.planting_date) : null; } },
                          { key: "fit", header: t("detail.columns.window"), render: (f) => { const r = fieldResult(f.id); return r?.fit ? <Badge colorScheme={fitScheme(r.fit)}>{labels.fit(r.fit)}</Badge> : null; } },
                          { key: "rot", header: t("detail.columns.rotation"), render: (f) => { const r = fieldResult(f.id); return r?.rotation_score != null ? r.rotation_score : null; } },
                          { key: "margin", header: t("detail.columns.margin"), render: (f) => { const r = fieldResult(f.id); return r ? `${formatCurrency(r.margin)} · ${formatCurrency(r.margin_per_acre)}/ac` : null; } },
                        ]}
                      />
                    </Stack>
                  ),
                },
                {
                  id: "assumptions",
                  label: t("detail.assumptionsTab"),
                  render: () => (
                    <Card variant="surface">
                      <CardBody>
                        <Text color="fg.muted" fontSize="sm" mb={4}>
                          {t("detail.assumptionsIntro")}
                        </Text>
                        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={6}>
                          {([
                            [t("detail.priceMultiplier"), price, setPrice],
                            [t("detail.yieldMultiplier"), yld, setYld],
                            [t("detail.costMultiplier"), cost, setCost],
                          ] as Array<[string, number, (n: number) => void]>).map(([label, val, setter]) => (
                            <Box key={label}>
                              <Flex justify="space-between" mb={1}>
                                <Text fontSize="sm" fontWeight="semibold">{label}</Text>
                                <Text fontSize="sm" color={val === 1 ? "fg.muted" : val > 1 ? "green.600" : "red.500"}>×{val.toFixed(2)}</Text>
                              </Flex>
                              <Slider min={0.5} max={1.5} step={0.05} value={val} onChange={setter} colorScheme="brand" aria-label={label}>
                                <SliderTrack><SliderFilledTrack /></SliderTrack>
                                <SliderThumb />
                              </Slider>
                            </Box>
                          ))}
                        </SimpleGrid>
                        <FormField label={t("strategies.rainfallScenario")} htmlFor="st-rain">
                          <Select id="st-rain" maxW="360px" value={rain} onChange={(e) => setRain(e.target.value as "dry" | "normal" | "wet")}>
                            {RAINFALL_OPTIONS.map((k) => (
                              <option key={k} value={k}>
                                {labels.rainfall(k)} — {labels.rainfallHint(k)}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                        {patchAssumptions.isPending ? <Text fontSize="xs" color="fg.muted">{t("detail.reevaluating")}</Text> : null}
                        {s.description ? <Text color="fg.muted" fontSize="sm" mt={4}>{s.description}</Text> : null}
                      </CardBody>
                    </Card>
                  ),
                },
                {
                  id: "results",
                  label: t("detail.resultsTab"),
                  render: () =>
                    ev ? (
                      <Stack spacing={4}>
                        <MetricGrid totals={ev.totals} columns={{ base: 2, md: 4 }} />
                        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                          <StatCard label={t("detail.production")} value={formatNumber(ev.totals.production, 0)} hint={t("detail.productionHint")} />
                          <StatCard label={t("detail.inWindow")} value={`${ev.planting_fit.optimal} / ${ev.fields.length}`} hint={t("detail.fitBreakdown", { late: ev.planting_fit.late, early: ev.planting_fit.early, outside: ev.planting_fit.outside })} />
                          <StatCard label={t("detail.softExceeded")} value={ev.soft_exceeded} />
                          <StatCard label={t("detail.evaluated")} value={s.evaluated_at ? formatDate(s.evaluated_at) : "—"} />
                        </SimpleGrid>
                        <DataTable
                          rows={ev.fields}
                          rowKey={(r) => r.allocation_id}
                          emptyTitle={t("detail.unallocated")}
                          emptyBody={t("detail.allocateFirst")}
                          columns={[
                            { key: "field_name", header: t("detail.columns.field") },
                            { key: "crop_name", header: t("detail.columns.crop"), render: (r) => `${r.crop_name}${r.variety_name ? ` · ${r.variety_name}` : ""}${r.components.length ? ` + ${r.components.map((c) => `${c.crop_name} ${c.share_pct}%`).join(", ")}` : ""}` },
                            { key: "acres", header: t("detail.columns.acres"), render: (r) => formatNumber(r.acres, 0) },
                            { key: "revenue", header: t("detail.columns.revenue"), render: (r) => formatCurrency(r.revenue) },
                            { key: "total_cost", header: t("detail.columns.cost"), render: (r) => formatCurrency(r.total_cost) },
                            { key: "margin", header: t("detail.columns.margin"), render: (r) => formatCurrency(r.margin) },
                            { key: "water", header: t("detail.columns.water"), render: (r) => `${formatNumber(r.water_acre_inches, 0)} ac-in` },
                            { key: "labor", header: t("detail.columns.labor"), render: (r) => `${formatNumber(r.labor_hours, 0)} h` },
                            { key: "n", header: t("detail.columns.nitrogen"), render: (r) => `${r.nitrogen_balance_lb >= 0 ? "+" : ""}${formatNumber(r.nitrogen_balance_lb, 0)}` },
                          ]}
                        />
                      </Stack>
                    ) : (
                      <Alert status="info" borderRadius="md"><AlertIcon />{t("detail.allocateFirst")}</Alert>
                    ),
                },
              ]
            : []
        }
      />

      {s ? (
        <AllocationDrawer open={!!editField} onClose={() => setEditField(null)} field={editField} initial={editField ? byField.get(editField.id) ?? null : null} strategyId={id} season={s.season} onSaved={invalidate} />
      ) : null}

      <ConfirmDialog
        open={adoptOpen}
        title={ev && !ev.feasible ? t("detail.adoptForceTitle") : t("detail.adoptTitle")}
        body={
          ev && !ev.feasible
            ? t("detail.adoptForceBody", { count: ev.hard_violations })
            : t("detail.adoptBody")
        }
        confirmLabel={ev && !ev.feasible ? t("detail.adoptAnyway") : t("detail.adoptConfirm")}
        danger={!!ev && !ev.feasible}
        onClose={() => setAdoptOpen(false)}
        onConfirm={() => {
          if (ev && !ev.feasible) setForceAdopt(true);
          adopt.mutate();
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={t("detail.deleteStrategyTitle")}
        body={t("detail.deleteStrategyBody")}
        confirmLabel={t("actions.delete", { ns: "common" })}
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
