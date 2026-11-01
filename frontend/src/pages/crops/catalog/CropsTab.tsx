import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePlanningLabels } from "@/lib/usePlanningLabels";
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
} from "@chakra-ui/react";
import { cropsApi, getApiError } from "@/api/client";
import { DataTable } from "@/components/ui/DataTable";
import { Drawer, ConfirmDialog } from "@/components/ui/Modal";
import { ErrorBanner, FormField } from "@/components/ui/FormField";
import { CropChip } from "@/components/planning/CropChip";
import { CROP_CATEGORIES } from "@/lib/planning";
import { formatNumber } from "@/lib/utils";
import type { Crop } from "@/types";
import { formatCurrency } from "@/i18n/format";

type Form = Record<string, string>;

const EMPTY: Form = {
  name: "",
  category: "grain",
  family: "",
  scientific_name: "",
  typical_days: "120",
  water_need: "medium",
  root_depth: "medium",
  color_hex: "#4CAF50",
  water_acre_inches: "",
  labor_hours_per_acre: "2.5",
  nitrogen_lb_per_acre: "0",
  expected_yield_per_acre: "0",
  yield_unit: "bu",
  expected_price_per_unit: "0",
  seed_cost_per_acre: "0",
  input_cost_per_acre: "0",
};

function toForm(c: Crop): Form {
  return {
    name: c.name,
    category: c.category,
    family: c.family ?? "",
    scientific_name: c.scientific_name ?? "",
    typical_days: String(c.typical_days),
    water_need: c.water_need,
    root_depth: c.root_depth,
    color_hex: c.color_hex,
    water_acre_inches: c.water_acre_inches == null ? "" : String(c.water_acre_inches),
    labor_hours_per_acre: String(c.labor_hours_per_acre),
    nitrogen_lb_per_acre: String(c.nitrogen_lb_per_acre),
    expected_yield_per_acre: String(c.expected_yield_per_acre),
    yield_unit: c.yield_unit,
    expected_price_per_unit: String(c.expected_price_per_unit),
    seed_cost_per_acre: String(c.seed_cost_per_acre),
    input_cost_per_acre: String(c.input_cost_per_acre),
  };
}

const num = (v: string) => (v === "" ? null : Number(v));

export function CropsTab() {
  const qc = useQueryClient();
  const { t } = useTranslation("grow");
  const labels = usePlanningLabels();
  const cropsQ = useQuery({ queryKey: ["crops"], queryFn: () => cropsApi.crops() });
  const crops = cropsQ.data?.results ?? [];

  const [editing, setEditing] = useState<Crop | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [nitrogenFixing, setNitrogenFixing] = useState(false);
  const [intercrops, setIntercrops] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Crop | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setNitrogenFixing(false);
    setIntercrops([]);
    setError(null);
    setOpen(true);
  };
  const openEdit = (c: Crop) => {
    setEditing(c);
    setForm(toForm(c));
    setNitrogenFixing(c.nitrogen_fixing);
    setIntercrops(c.compatible_intercrops ?? []);
    setError(null);
    setOpen(true);
  };

  const payload = (): Partial<Crop> => ({
    name: form.name,
    category: form.category as Crop["category"],
    family: form.family,
    scientific_name: form.scientific_name,
    typical_days: Number(form.typical_days) || 0,
    water_need: form.water_need as Crop["water_need"],
    root_depth: form.root_depth as Crop["root_depth"],
    color_hex: form.color_hex,
    nitrogen_fixing: nitrogenFixing,
    water_acre_inches: num(form.water_acre_inches),
    labor_hours_per_acre: Number(form.labor_hours_per_acre) || 0,
    nitrogen_lb_per_acre: Number(form.nitrogen_lb_per_acre) || 0,
    expected_yield_per_acre: Number(form.expected_yield_per_acre) || 0,
    yield_unit: form.yield_unit,
    expected_price_per_unit: Number(form.expected_price_per_unit) || 0,
    seed_cost_per_acre: Number(form.seed_cost_per_acre) || 0,
    input_cost_per_acre: Number(form.input_cost_per_acre) || 0,
    compatible_intercrops: intercrops,
  });

  const save = useMutation({
    mutationFn: () => (editing ? cropsApi.patchCrop(editing.id, payload()) : cropsApi.createCrop(payload())),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crops"] });
      setOpen(false);
    },
    onError: (e) => setError(getApiError(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => cropsApi.deleteCrop(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crops"] });
      setConfirmDelete(null);
      setOpen(false);
    },
    onError: (e) => setError(getApiError(e)),
  });

  const marginPerAcre = (c: Crop) =>
    c.expected_yield_per_acre * c.expected_price_per_unit - c.seed_cost_per_acre - c.input_cost_per_acre;

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={3} gap={3} wrap="wrap">
        <Text color="fg.muted" fontSize="sm">
          {t("catalog.intro")}
        </Text>
        <Button colorScheme="brand" size="sm" onClick={openNew}>
          {t("catalog.addCrop")}
        </Button>
      </Flex>
      <ErrorBanner message={cropsQ.error ? getApiError(cropsQ.error) : null} />
      <DataTable
        rows={crops}
        rowKey={(c) => c.id}
        onRowClick={openEdit}
        emptyTitle={t("catalog.emptyTitle")}
        emptyBody={t("catalog.emptyBody")}
        emptyAction={
          <Button colorScheme="brand" onClick={openNew}>
            {t("catalog.addCrop")}
          </Button>
        }
        columns={[
          { key: "name", header: t("catalog.columns.crop"), render: (c) => <CropChip name={c.name} color={c.color_hex} detail={c.family || null} /> },
          { key: "category", header: t("catalog.columns.category"), render: (c) => labels.cropCategory(c.category) },
          { key: "typical_days", header: t("catalog.columns.days"), render: (c) => `${c.typical_days}d` },
          { key: "water", header: t("catalog.columns.water"), render: (c) => `${labels.waterNeed(c.water_need)} · ${formatNumber(c.effective_water_inches, 0)} in` },
          { key: "n", header: t("catalog.columns.nitrogen"), render: (c) => (c.nitrogen_fixing ? t("catalog.fixesNitrogen") : formatNumber(c.nitrogen_lb_per_acre, 0)) },
          { key: "yield", header: t("catalog.columns.yield"), render: (c) => `${formatNumber(c.expected_yield_per_acre, 0)} ${c.yield_unit}` },
          { key: "price", header: t("catalog.columns.price"), render: (c) => formatCurrency(c.expected_price_per_unit, "USD", 2) },
          { key: "margin", header: t("catalog.columns.margin"), render: (c) => formatCurrency(marginPerAcre(c)) },
          { key: "varieties", header: t("catalog.columns.varieties"), render: (c) => c.variety_count ?? 0 },
        ]}
      />

      <Drawer open={open} title={editing ? t("catalog.editCrop", { name: editing.name }) : t("catalog.addCrop")} onClose={() => setOpen(false)} wide>
        <ErrorBanner message={error} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={4}>
            <FormField label={t("labels.name", { ns: "common" })} htmlFor="c-name">
              <Input id="c-name" isRequired value={form.name} onChange={set("name")} />
            </FormField>
            <FormField label={t("labels.category", { ns: "common" })} htmlFor="c-cat">
              <Select id="c-cat" value={form.category} onChange={set("category")}>
                {CROP_CATEGORIES.map((v) => (
                  <option key={v} value={v}>
                    {labels.cropCategory(v)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={t("catalog.fields.botanicalFamily")} htmlFor="c-fam" hint={t("catalog.fields.familyHint")}>
              <Input id="c-fam" value={form.family} onChange={set("family")} />
            </FormField>
            <FormField label={t("catalog.fields.scientificName")} htmlFor="c-sci">
              <Input id="c-sci" value={form.scientific_name} onChange={set("scientific_name")} />
            </FormField>
          </SimpleGrid>

          <Text fontSize="xs" textTransform="uppercase" letterSpacing="wider" color="fg.muted" mt={2} mb={2}>
            {t("catalog.sections.agronomy")}
          </Text>
          <SimpleGrid columns={{ base: 2, md: 3 }} spacingX={4}>
            <FormField label={t("catalog.fields.typicalDays")} htmlFor="c-days">
              <Input id="c-days" type="number" value={form.typical_days} onChange={set("typical_days")} />
            </FormField>
            <FormField label={t("catalog.fields.waterNeed")} htmlFor="c-water">
              <Select id="c-water" value={form.water_need} onChange={set("water_need")}>
                {(["low", "medium", "high"] as const).map((v) => (
                  <option key={v} value={v}>
                    {labels.waterNeed(v)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={t("catalog.fields.waterSeason")} htmlFor="c-win" hint={t("catalog.fields.waterHint")}>
              <Input id="c-win" type="number" step="0.5" value={form.water_acre_inches} onChange={set("water_acre_inches")} />
            </FormField>
            <FormField label={t("catalog.fields.rootDepth")} htmlFor="c-root">
              <Select id="c-root" value={form.root_depth} onChange={set("root_depth")}>
                {(["shallow", "medium", "deep"] as const).map((v) => (
                  <option key={v} value={v}>
                    {labels.rootDepth(v)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={t("catalog.fields.laborPerAcre")} htmlFor="c-labor">
              <Input id="c-labor" type="number" step="0.1" value={form.labor_hours_per_acre} onChange={set("labor_hours_per_acre")} />
            </FormField>
            <FormField label={t("catalog.fields.nitrogenDemand")} htmlFor="c-n">
              <Input id="c-n" type="number" value={form.nitrogen_lb_per_acre} onChange={set("nitrogen_lb_per_acre")} isDisabled={nitrogenFixing} />
            </FormField>
          </SimpleGrid>
          <Flex align="center" gap={3} mb={4}>
            <Switch id="c-fix" isChecked={nitrogenFixing} onChange={(e) => setNitrogenFixing(e.target.checked)} colorScheme="brand" />
            <Text as="label" htmlFor="c-fix" fontSize="sm">
              {t("catalog.fields.nitrogenFixing")}
            </Text>
          </Flex>

          <Text fontSize="xs" textTransform="uppercase" letterSpacing="wider" color="fg.muted" mb={2}>
            {t("catalog.sections.economics")}
          </Text>
          <SimpleGrid columns={{ base: 2, md: 3 }} spacingX={4}>
            <FormField label={t("catalog.fields.expectedYield")} htmlFor="c-yld">
              <Input id="c-yld" type="number" step="0.1" value={form.expected_yield_per_acre} onChange={set("expected_yield_per_acre")} />
            </FormField>
            <FormField label={t("catalog.fields.yieldUnit")} htmlFor="c-unit">
              <Input id="c-unit" value={form.yield_unit} onChange={set("yield_unit")} />
            </FormField>
            <FormField label={t("catalog.fields.pricePerUnit")} htmlFor="c-price">
              <Input id="c-price" type="number" step="0.01" value={form.expected_price_per_unit} onChange={set("expected_price_per_unit")} />
            </FormField>
            <FormField label={t("catalog.fields.seedCost")} htmlFor="c-seed">
              <Input id="c-seed" type="number" step="0.01" value={form.seed_cost_per_acre} onChange={set("seed_cost_per_acre")} />
            </FormField>
            <FormField label={t("catalog.fields.otherInputs")} htmlFor="c-inputs" hint={t("catalog.fields.inputsHint")}>
              <Input id="c-inputs" type="number" step="0.01" value={form.input_cost_per_acre} onChange={set("input_cost_per_acre")} />
            </FormField>
            <FormField label={t("catalog.fields.mapColour")} htmlFor="c-color">
              <Input id="c-color" type="color" value={form.color_hex} onChange={set("color_hex")} p={1} h="40px" />
            </FormField>
          </SimpleGrid>

          {crops.filter((c) => c.id !== editing?.id).length ? (
            <FormField label={t("catalog.fields.compatibleIntercrops")} hint={t("catalog.fields.intercropsHint")}>
              <Stack spacing={1} maxH="160px" overflowY="auto" p={2} borderWidth="1px" borderColor="border.default" borderRadius="md">
                {crops
                  .filter((c) => c.id !== editing?.id)
                  .map((c) => (
                    <Checkbox
                      key={c.id}
                      size="sm"
                      colorScheme="brand"
                      isChecked={intercrops.includes(c.id)}
                      onChange={(e) =>
                        setIntercrops((cur) => (e.target.checked ? [...cur, c.id] : cur.filter((x) => x !== c.id)))
                      }
                    >
                      {c.name}
                    </Checkbox>
                  ))}
              </Stack>
            </FormField>
          ) : null}

          <Flex gap={2} mt={2}>
            <Button type="submit" colorScheme="brand" isDisabled={save.isPending || !form.name}>
              {save.isPending ? t("actions.saving", { ns: "common" }) : editing ? t("actions.saveChanges", { ns: "common" }) : t("catalog.addCrop")}
            </Button>
            {editing ? (
              <Button variant="ghost" colorScheme="red" onClick={() => setConfirmDelete(editing)}>
                {t("actions.delete", { ns: "common" })}
              </Button>
            ) : null}
          </Flex>
        </form>
      </Drawer>

      <ConfirmDialog
        open={!!confirmDelete}
        title={t("catalog.deleteCrop") + ` — ${confirmDelete?.name}`}
        body={t("catalog.deleteCropBody")}
        confirmLabel={t("catalog.deleteCrop")}
        danger
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove.mutate(confirmDelete.id)}
      />
    </Box>
  );
}
