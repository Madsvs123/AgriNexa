import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Box, Button, Card, CardBody, Flex, Input, Select, SimpleGrid, Stack, Text, Textarea } from "@chakra-ui/react";
import { cropsApi, farmsApi, getApiError } from "@/api/client";
import { Drawer } from "@/components/ui/Modal";
import { ErrorBanner, FormField } from "@/components/ui/FormField";
import { AssessmentPanel } from "@/components/planning/AssessmentPanel";
import { ComponentsEditor } from "@/components/planning/ComponentsEditor";
import { useDebounced } from "@/hooks/useDebounced";
import { PLANTING_SYSTEMS, fmtMoney } from "@/lib/planning";
import { formatDate } from "@/lib/utils";
import type { PlantingSystem, StrategyComponent } from "@/types";

/**
 * Create a crop plan with live window/rotation assessment, variety
 * recommendations for the chosen field and date, and optional mixed-cropping
 * components.
 */
export function PlanComposer({
  open,
  onClose,
  defaultSeason,
  defaultFarm,
}: {
  open: boolean;
  onClose: () => void;
  defaultSeason?: string | null;
  defaultFarm?: string | null;
}) {
  const qc = useQueryClient();
  const seasonsQ = useQuery({ queryKey: ["seasons"], queryFn: () => cropsApi.seasons() });
  const fieldsQ = useQuery({
    queryKey: ["fields", { farm: defaultFarm }],
    queryFn: () => farmsApi.fields(defaultFarm ? { farm: defaultFarm } : undefined),
  });
  const cropsQ = useQuery({ queryKey: ["crops"], queryFn: () => cropsApi.crops() });
  const varsQ = useQuery({ queryKey: ["varieties"], queryFn: () => cropsApi.varieties() });

  const [season, setSeason] = useState(defaultSeason ?? "");
  const [field, setField] = useState("");
  const [crop, setCrop] = useState("");
  const [variety, setVariety] = useState("");
  const [system, setSystem] = useState<PlantingSystem>("monoculture");
  const [plantingDate, setPlantingDate] = useState("");
  const [acres, setAcres] = useState("");
  const [notes, setNotes] = useState("");
  const [components, setComponents] = useState<StrategyComponent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSeason(defaultSeason ?? seasonsQ.data?.results.find((s) => s.is_active)?.id ?? "");
      setField("");
      setCrop("");
      setVariety("");
      setSystem("monoculture");
      setPlantingDate("");
      setAcres("");
      setNotes("");
      setComponents([]);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const crops = cropsQ.data?.results ?? [];
  const varieties = varsQ.data?.results ?? [];
  const fields = fieldsQ.data?.results ?? [];
  const selectedField = fields.find((f) => f.id === field);
  const cropVarieties = varieties.filter((v) => v.crop === crop && v.is_active);
  const debouncedDate = useDebounced(plantingDate, 300);

  const assessQ = useQuery({
    queryKey: ["assess", field, crop, variety, debouncedDate, season],
    queryFn: () => cropsApi.assess({ field, crop, season, variety: variety || undefined, planting_date: debouncedDate || undefined }),
    enabled: open && !!field && !!crop && !!season,
    placeholderData: (prev) => prev,
  });
  const recQ = useQuery({
    queryKey: ["recommend", field, crop, debouncedDate, season],
    queryFn: () => cropsApi.recommendVarieties({ field, crop, season, planting_date: debouncedDate || undefined }),
    enabled: open && !!field && !!crop && !!season && cropVarieties.length > 0,
  });

  const projectedHarvest = useMemo(() => assessQ.data?.projected_harvest ?? null, [assessQ.data]);

  const create = useMutation({
    mutationFn: async () => {
      const plan = await cropsApi.createPlan({
        season,
        field,
        crop,
        variety: variety || null,
        planting_system: system,
        planting_date: plantingDate || null,
        expected_harvest_date: projectedHarvest,
        acres: acres ? Number(acres) : null,
        notes,
        target_yield: (() => {
          const v = cropVarieties.find((x) => x.id === variety);
          const c = crops.find((x) => x.id === crop);
          return v?.expected_yield_per_acre || c?.expected_yield_per_acre || null;
        })(),
        yield_unit: cropVarieties.find((x) => x.id === variety)?.yield_unit || crops.find((x) => x.id === crop)?.yield_unit || "bu",
      });
      await Promise.all(
        components.map((c, i) =>
          cropsApi.createPlanComponent({
            crop_plan: plan.id,
            crop: c.crop,
            variety: c.variety ?? null,
            role: (c.role as "intercrop" | "relay" | "cover") ?? "intercrop",
            share_pct: c.share_pct,
            row_arrangement: c.row_arrangement ?? "",
            order: i + 1,
          }),
        ),
      );
      return plan;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crop-plans"] });
      onClose();
    },
    onError: (e) => setError(getApiError(e)),
  });

  const selectedCrop = crops.find((c) => c.id === crop);
  const mixed = system !== "monoculture" && system !== "cover";

  return (
    <Drawer open={open} title="New crop plan" onClose={onClose} wide>
      <ErrorBanner message={error} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={4}>
          <FormField label="Season" htmlFor="p-season">
            <Select id="p-season" value={season} onChange={(e) => setSeason(e.target.value)} isRequired>
              <option value="">Select season</option>
              {(seasonsQ.data?.results ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Field" htmlFor="p-field">
            <Select id="p-field" value={field} onChange={(e) => setField(e.target.value)} isRequired>
              <option value="">Select field</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} · {f.acres} ac{f.farm_name ? ` · ${f.farm_name}` : ""}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Crop" htmlFor="p-crop">
            <Select
              id="p-crop"
              value={crop}
              onChange={(e) => {
                setCrop(e.target.value);
                setVariety("");
                setComponents([]);
              }}
              isRequired
            >
              <option value="">Select crop</option>
              {crops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Planting system" htmlFor="p-sys">
            <Select id="p-sys" value={system} onChange={(e) => setSystem(e.target.value as PlantingSystem)}>
              {PLANTING_SYSTEMS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Planting date" htmlFor="p-date">
            <Input id="p-date" type="date" value={plantingDate} onChange={(e) => setPlantingDate(e.target.value)} />
          </FormField>
          <FormField label="Acres" htmlFor="p-acres" hint={selectedField ? `Field is ${selectedField.acres} ac; blank = whole field` : undefined}>
            <Input id="p-acres" type="number" step="0.1" value={acres} onChange={(e) => setAcres(e.target.value)} />
          </FormField>
        </SimpleGrid>

        <Text fontSize="xs" color="fg.muted" mb={2}>
          {PLANTING_SYSTEMS.find(([v]) => v === system)?.[2]}
        </Text>

        {/* Variety: recommendations ranked for this field + date */}
        <FormField label="Variety" htmlFor="p-var" hint={cropVarieties.length ? "Ranked for this field and planting date" : "No varieties defined for this crop"}>
          <Select id="p-var" value={variety} onChange={(e) => setVariety(e.target.value)} isDisabled={!cropVarieties.length}>
            <option value="">{cropVarieties.length ? "Decide later" : "None"}</option>
            {cropVarieties.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} · {v.days_to_maturity}d
              </option>
            ))}
          </Select>
        </FormField>
        {recQ.data?.results.length ? (
          <Stack spacing={2} mb={4}>
            {recQ.data.results.slice(0, 3).map((r, i) => (
              <Card
                key={r.variety_id}
                variant={variety === r.variety_id ? "inset" : "surface"}
                as="button"
                type="button"
                textAlign="start"
                onClick={() => setVariety(r.variety_id)}
                _hover={{ borderColor: "brand.300" }}
              >
                <CardBody py={2.5}>
                  <Flex align="center" gap={2} wrap="wrap">
                    <Badge colorScheme={i === 0 ? "brand" : "gray"}>{i === 0 ? "Best fit" : `#${i + 1}`}</Badge>
                    <Text fontWeight="semibold">{r.name}</Text>
                    <Text fontSize="sm" color="fg.muted">
                      {r.days_to_maturity}d · harvest {formatDate(r.projected_harvest)} · {fmtMoney(r.projected_margin_per_acre)}/ac
                    </Text>
                    <Box flex="1" />
                    <Text fontSize="sm" fontWeight="semibold">
                      {r.score}
                    </Text>
                  </Flex>
                  <Text fontSize="xs" color="fg.muted" mt={1}>
                    {r.reasons.join(" ")}
                  </Text>
                </CardBody>
              </Card>
            ))}
          </Stack>
        ) : null}

        {mixed ? (
          <FormField label="Mixed-cropping components" hint="Secondary crops and their share of the field">
            <ComponentsEditor
              value={components}
              onChange={setComponents}
              crops={crops}
              varieties={varieties}
              primaryCropId={crop}
              primaryCropName={selectedCrop?.name}
            />
          </FormField>
        ) : null}

        <Card variant="inset" mb={4}>
          <CardBody>
            <Text fontSize="xs" textTransform="uppercase" letterSpacing="wider" color="fg.muted" mb={2}>
              Assessment
            </Text>
            <AssessmentPanel data={assessQ.data} loading={assessQ.isFetching} compact />
          </CardBody>
        </Card>

        <FormField label="Notes" htmlFor="p-notes">
          <Textarea id="p-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </FormField>

        <Button type="submit" colorScheme="brand" isDisabled={create.isPending || !season || !field || !crop}>
          {create.isPending ? "Creating…" : "Create plan"}
        </Button>
      </form>
    </Drawer>
  );
}
