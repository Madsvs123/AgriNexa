import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Checkbox,
  Flex,
  Heading,
  IconButton,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { cropsApi, farmsApi, getApiError } from "@/api/client";
import { DetailPage } from "@/components/templates/DetailPage";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/ui/DataTable";
import { ConfirmDialog, Drawer } from "@/components/ui/Modal";
import { ErrorBanner, FormField } from "@/components/ui/FormField";
import { CropChip } from "@/components/planning/CropChip";
import { usePlanningMessage } from "@/components/planning/PlanningMessage";
import { useScope } from "@/hooks/useScope";
import { formatDate } from "@/lib/utils";
import type { RotationStep } from "@/types";

const ROLES: Array<[RotationStep["role"], string]> = [
  ["main", "Main crop"],
  ["cover", "Cover crop"],
  ["intercrop", "Intercrop"],
  ["fallow", "Fallow"],
];

export default function RotationDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { seasonId } = useScope();
  const renderMessage = usePlanningMessage();
  const { t: tGrow } = useTranslation("grow");
  const rotQ = useQuery({ queryKey: ["rotation", id], queryFn: () => cropsApi.getRotation(id), enabled: !!id });
  const validQ = useQuery({ queryKey: ["rotation-validate", id], queryFn: () => cropsApi.validateRotation(id), enabled: !!id });
  const cropsQ = useQuery({ queryKey: ["crops"], queryFn: () => cropsApi.crops() });
  const varsQ = useQuery({ queryKey: ["varieties"], queryFn: () => cropsApi.varieties() });
  const seasonsQ = useQuery({ queryKey: ["seasons"], queryFn: () => cropsApi.seasons() });
  const rotation = rotQ.data;
  const fieldsQ = useQuery({
    queryKey: ["fields", { farm: rotation?.farm }],
    queryFn: () => farmsApi.fields({ farm: rotation?.farm }),
    enabled: !!rotation?.farm,
  });

  const crops = cropsQ.data?.results ?? [];
  const varieties = varsQ.data?.results ?? [];
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["rotation", id] });
    qc.invalidateQueries({ queryKey: ["rotations"] });
    qc.invalidateQueries({ queryKey: ["rotation-validate", id] });
    qc.invalidateQueries({ queryKey: ["rotation-preview", id] });
  };

  // ── Step editor ──────────────────────────────────────────────────────
  const [stepOpen, setStepOpen] = useState(false);
  const [editing, setEditing] = useState<RotationStep | null>(null);
  const [yearOffset, setYearOffset] = useState("0");
  const [order, setOrder] = useState("0");
  const [crop, setCrop] = useState("");
  const [variety, setVariety] = useState("");
  const [role, setRole] = useState<RotationStep["role"]>("main");
  const [companions, setCompanions] = useState<string[]>([]);
  const [label, setLabel] = useState("");
  const [stepError, setStepError] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState<RotationStep | null>(null);

  const openStep = (s: RotationStep | null, defaults?: { year?: number }) => {
    setEditing(s);
    setYearOffset(String(s?.year_offset ?? defaults?.year ?? 0));
    setOrder(String(s?.order ?? (rotation?.steps.filter((x) => x.year_offset === (defaults?.year ?? 0)).length ?? 0)));
    setCrop(s?.crop ?? crops[0]?.id ?? "");
    setVariety(s?.variety ?? "");
    setRole(s?.role ?? "main");
    setCompanions(s?.companion_crops ?? []);
    setLabel(s?.season_label ?? "");
    setStepError(null);
    setStepOpen(true);
  };
  const saveStep = useMutation({
    mutationFn: () => {
      const body: Partial<RotationStep> = {
        rotation: id,
        year_offset: Number(yearOffset) || 0,
        order: Number(order) || 0,
        crop: role === "fallow" ? null : crop || null,
        variety: role === "fallow" ? null : variety || null,
        role,
        companion_crops: role === "fallow" ? [] : companions,
        season_label: label,
      };
      return editing ? cropsApi.patchRotationStep(editing.id, body) : cropsApi.createRotationStep(body);
    },
    onSuccess: () => {
      invalidate();
      setStepOpen(false);
    },
    onError: (e) => setStepError(getApiError(e)),
  });
  const deleteStep = useMutation({
    mutationFn: (sid: string) => cropsApi.deleteRotationStep(sid),
    onSuccess: () => {
      invalidate();
      setConfirmStep(null);
      setStepOpen(false);
    },
  });

  // ── Fields & phases ──────────────────────────────────────────────────
  const [fieldSel, setFieldSel] = useState<string[]>([]);
  const [phases, setPhases] = useState<Record<string, number>>({});
  useEffect(() => {
    if (rotation) {
      setFieldSel(rotation.fields);
      setPhases(Object.fromEntries((rotation.phases ?? []).map((p) => [p.field, p.phase_offset])));
    }
  }, [rotation]);
  const saveFields = useMutation({
    mutationFn: async () => {
      await cropsApi.patchRotation(id, { fields: fieldSel });
      await cropsApi.setRotationPhases(
        id,
        fieldSel.map((f) => ({ field: f, phase_offset: phases[f] ?? 0 })),
      );
    },
    onSuccess: invalidate,
  });

  // ── Preview → strategy ───────────────────────────────────────────────
  const [previewSeason, setPreviewSeason] = useState("");
  useEffect(() => {
    if (!previewSeason) setPreviewSeason(seasonId ?? seasonsQ.data?.results.find((s) => s.is_active)?.id ?? "");
  }, [seasonId, seasonsQ.data, previewSeason]);
  const previewQ = useQuery({
    queryKey: ["rotation-preview", id, previewSeason],
    queryFn: () => cropsApi.previewRotation(id, previewSeason),
    enabled: !!id && !!previewSeason,
  });
  const toStrategy = useMutation({
    mutationFn: () => cropsApi.rotationToStrategy(id, { season: previewSeason }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["strategies"] });
      navigate(`/crops/strategies/${s.id}`);
    },
  });

  const cycle = Math.max(rotation?.cycle_years ?? 0, 1);
  const years = Array.from({ length: cycle + 1 }, (_, i) => i);
  const cropVarieties = varieties.filter((v) => v.crop === crop);
  const validation = validQ.data;

  return (
    <>
      <DetailPage
        loading={rotQ.isLoading}
        error={rotQ.error ? getApiError(rotQ.error) : !rotation && !rotQ.isLoading ? "Rotation not found." : null}
        title={rotation?.name ?? "Rotation"}
        subtitle={rotation ? `${rotation.farm_name} · ${rotation.cycle_years}-year cycle${rotation.start_year ? ` from ${rotation.start_year}` : ""}` : undefined}
        actions={
          rotation ? (
            <Badge colorScheme={validation?.ok === false ? "red" : validation?.issues.some((i) => i.level === "warning") ? "yellow" : "green"} px={2} py={1}>
              {validation ? (validation.ok ? (validation.issues.length ? `${validation.issues.length} note${validation.issues.length === 1 ? "" : "s"}` : "Valid") : "Invalid") : "…"}
            </Badge>
          ) : null
        }
        kpis={
          rotation
            ? [
                <StatCard key="cycle" label="Cycle" value={`${rotation.cycle_years} yr`} />,
                <StatCard key="steps" label="Steps" value={rotation.steps.length} />,
                <StatCard key="fields" label="Fields" value={rotation.fields.length} />,
                <StatCard key="div" label="Diversity" value={validation?.diversity != null ? `${Math.round(validation.diversity * 100)}%` : "—"} hint="Distinct families / main crops" />,
              ]
            : undefined
        }
        tabs={
          rotation
            ? [
                {
                  id: "steps",
                  label: "Sequence",
                  render: () => (
                    <Stack spacing={4}>
                      {(validation?.issues ?? []).map((i, idx) => (
                        <Alert key={idx} status={i.level === "error" ? "error" : i.level === "warning" ? "warning" : "info"} variant="left-accent" borderRadius="md" py={2} fontSize="sm">
                          <AlertIcon boxSize={4} />
                          {i.year_offset != null ? `${tGrow("rotation.yearPrefix", { year: i.year_offset + 1 })} ` : ""}
                          {renderMessage(i)}
                        </Alert>
                      ))}
                      <SimpleGrid columns={{ base: 1, md: 2, xl: Math.min(years.length, 4) }} spacing={3}>
                        {years.map((y) => {
                          const steps = rotation.steps.filter((s) => s.year_offset === y);
                          const isNew = y >= cycle;
                          return (
                            <Card key={y} variant={isNew ? "inset" : "surface"}>
                              <CardBody>
                                <Flex align="center" mb={2}>
                                  <Heading size="xs">
                                    Year {y + 1}
                                    {rotation.start_year ? <Text as="span" color="fg.muted" fontWeight="normal"> · {rotation.start_year + y}</Text> : null}
                                  </Heading>
                                  <Box flex="1" />
                                  <IconButton aria-label={`Add step to year ${y + 1}`} icon={<Plus size={14} />} size="xs" variant="ghost" onClick={() => openStep(null, { year: y })} />
                                </Flex>
                                <Stack spacing={2}>
                                  {steps.map((s) => (
                                    <Flex key={s.id} align="center" gap={2} p={2} borderWidth="1px" borderColor="border.default" borderRadius="md" bg="bg.surface">
                                      <Box flex="1" minW={0}>
                                        <CropChip name={s.crop_name ?? "Fallow"} color={s.crop_color} detail={s.variety_name ?? s.season_label ?? null} />
                                        <Flex gap={1} mt={1} wrap="wrap">
                                          {s.role !== "main" ? <Badge fontSize="9px" textTransform="capitalize" colorScheme="gray">{s.role}</Badge> : null}
                                          {(s.companion_names ?? []).map((c) => (
                                            <Badge key={c} fontSize="9px" variant="outline" textTransform="none">+ {c}</Badge>
                                          ))}
                                        </Flex>
                                      </Box>
                                      <IconButton aria-label="Edit step" icon={<Pencil size={13} />} size="xs" variant="ghost" onClick={() => openStep(s)} />
                                      <IconButton aria-label="Delete step" icon={<Trash2 size={13} />} size="xs" variant="ghost" colorScheme="red" onClick={() => setConfirmStep(s)} />
                                    </Flex>
                                  ))}
                                  {!steps.length ? (
                                    <Text fontSize="sm" color="fg.muted">
                                      {isNew ? "Add a step to extend the cycle." : "No step this year."}
                                    </Text>
                                  ) : null}
                                </Stack>
                              </CardBody>
                            </Card>
                          );
                        })}
                      </SimpleGrid>
                    </Stack>
                  ),
                },
                {
                  id: "fields",
                  label: "Fields & phases",
                  render: () => (
                    <Card variant="surface">
                      <CardBody>
                        <Text color="fg.muted" fontSize="sm" mb={3}>
                          Assign fields on {rotation.farm_name}. A phase offset shifts a field forward in the cycle so not every field grows the same crop in the same year.
                        </Text>
                        <Stack spacing={2}>
                          {(fieldsQ.data?.results ?? []).map((f) => {
                            const on = fieldSel.includes(f.id);
                            return (
                              <Flex key={f.id} align="center" gap={3} p={2.5} borderWidth="1px" borderColor="border.default" borderRadius="md">
                                <Checkbox
                                  colorScheme="brand"
                                  isChecked={on}
                                  onChange={(e) => setFieldSel((cur) => (e.target.checked ? [...cur, f.id] : cur.filter((x) => x !== f.id)))}
                                >
                                  <Text as="span" fontWeight="semibold">{f.name}</Text>{" "}
                                  <Text as="span" color="fg.muted" fontSize="sm">{f.acres} ac · {f.soil_type || "soil ?"}</Text>
                                </Checkbox>
                                <Box flex="1" />
                                <Text fontSize="sm" color="fg.muted">Phase</Text>
                                <Select size="sm" w="90px" value={phases[f.id] ?? 0} isDisabled={!on} onChange={(e) => setPhases((p) => ({ ...p, [f.id]: Number(e.target.value) }))}>
                                  {Array.from({ length: cycle }, (_, i) => (
                                    <option key={i} value={i}>+{i} yr</option>
                                  ))}
                                </Select>
                              </Flex>
                            );
                          })}
                        </Stack>
                        <Button mt={4} colorScheme="brand" size="sm" onClick={() => saveFields.mutate()} isDisabled={saveFields.isPending}>
                          {saveFields.isPending ? "Saving…" : "Save assignments"}
                        </Button>
                      </CardBody>
                    </Card>
                  ),
                },
                {
                  id: "preview",
                  label: "Next season",
                  render: () => (
                    <Card variant="surface">
                      <CardBody>
                        <Flex align="center" gap={3} mb={3} wrap="wrap">
                          <Select size="sm" w="220px" value={previewSeason} onChange={(e) => setPreviewSeason(e.target.value)} aria-label="Season to preview">
                            {(seasonsQ.data?.results ?? []).map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </Select>
                          <Text color="fg.muted" fontSize="sm">
                            What each assigned field grows under this rotation{previewQ.data ? ` in ${previewQ.data.year}` : ""}.
                          </Text>
                          <Box flex="1" />
                          <Button size="sm" colorScheme="brand" onClick={() => toStrategy.mutate()} isDisabled={!previewSeason || toStrategy.isPending || !rotation.fields.length}>
                            {toStrategy.isPending ? "Creating…" : "Create strategy from this"}
                          </Button>
                        </Flex>
                        <DataTable
                          rows={previewQ.data?.fields ?? []}
                          rowKey={(r) => r.field_id}
                          emptyTitle="No fields assigned"
                          emptyBody="Assign fields on the Fields & phases tab to preview the sequence."
                          columns={[
                            { key: "field_name", header: "Field", render: (r) => `${r.field_name} · ${r.acres} ac` },
                            { key: "year", header: "Cycle year", render: (r) => (r.year_offset != null ? `Year ${r.year_offset + 1}` : "—") },
                            { key: "crop", header: "Crop", render: (r) => (r.crop_name ? <CropChip name={r.crop_name} color={crops.find((c) => c.id === r.crop_id)?.color_hex} detail={r.variety_name} /> : "—") },
                            { key: "companions", header: "Companions", render: (r) => (r.companions.length ? r.companions.map((c) => c.name).join(", ") : "—") },
                            { key: "plant", header: "Window opens", render: (r) => formatDate(r.suggested_planting) },
                          ]}
                        />
                      </CardBody>
                    </Card>
                  ),
                },
              ]
            : []
        }
      />

      <Drawer open={stepOpen} title={editing ? "Edit step" : "Add step"} onClose={() => setStepOpen(false)}>
        <ErrorBanner message={stepError} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveStep.mutate();
          }}
        >
          <SimpleGrid columns={2} spacingX={4}>
            <FormField label="Cycle year" htmlFor="s-year" hint="1 = first year">
              <Input id="s-year" type="number" min={1} value={Number(yearOffset) + 1} onChange={(e) => setYearOffset(String(Math.max(0, Number(e.target.value) - 1)))} />
            </FormField>
            <FormField label="Order within year" htmlFor="s-order" hint="0 = first; covers usually 1">
              <Input id="s-order" type="number" min={0} value={order} onChange={(e) => setOrder(e.target.value)} />
            </FormField>
          </SimpleGrid>
          <FormField label="Role" htmlFor="s-role">
            <Select id="s-role" value={role} onChange={(e) => setRole(e.target.value as RotationStep["role"])}>
              {ROLES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </FormField>
          {role !== "fallow" ? (
            <>
              <FormField label="Crop" htmlFor="s-crop">
                <Select id="s-crop" value={crop} onChange={(e) => { setCrop(e.target.value); setVariety(""); }} isRequired>
                  <option value="">Select crop</option>
                  {crops.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Preferred variety" htmlFor="s-var">
                <Select id="s-var" value={variety} onChange={(e) => setVariety(e.target.value)} isDisabled={!cropVarieties.length}>
                  <option value="">Decide per season</option>
                  {cropVarieties.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Companion crops" hint="Intercropped with the main crop in this step">
                <Wrap spacing={2}>
                  {crops.filter((c) => c.id !== crop).map((c) => (
                    <WrapItem key={c.id}>
                      <Checkbox size="sm" colorScheme="brand" isChecked={companions.includes(c.id)} onChange={(e) => setCompanions((cur) => (e.target.checked ? [...cur, c.id] : cur.filter((x) => x !== c.id)))}>
                        {c.name}
                      </Checkbox>
                    </WrapItem>
                  ))}
                </Wrap>
              </FormField>
            </>
          ) : null}
          <FormField label="Label" htmlFor="s-label" hint="Optional: Spring, Winter cover, …">
            <Input id="s-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </FormField>
          <Flex gap={2}>
            <Button type="submit" colorScheme="brand" isDisabled={saveStep.isPending || (role !== "fallow" && !crop)}>
              {saveStep.isPending ? "Saving…" : editing ? "Save step" : "Add step"}
            </Button>
            {editing ? (
              <Button variant="ghost" colorScheme="red" onClick={() => setConfirmStep(editing)}>Delete</Button>
            ) : null}
          </Flex>
        </form>
      </Drawer>
      <ConfirmDialog
        open={!!confirmStep}
        title="Remove this step?"
        body="Fields keep their assignment; the cycle shortens if this was the last step of a year."
        confirmLabel="Remove step"
        danger
        onClose={() => setConfirmStep(null)}
        onConfirm={() => confirmStep && deleteStep.mutate(confirmStep.id)}
      />
    </>
  );
}
