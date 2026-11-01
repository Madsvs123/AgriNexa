import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePlanningLabels } from "@/lib/usePlanningLabels";
import { Badge, Box, Button, Checkbox, Flex, Input, Select, SimpleGrid, Switch, Text, Wrap, WrapItem } from "@chakra-ui/react";
import { cropsApi, getApiError } from "@/api/client";
import { DataTable } from "@/components/ui/DataTable";
import { Drawer, ConfirmDialog } from "@/components/ui/Modal";
import { ErrorBanner, FormField } from "@/components/ui/FormField";
import { FilterBar, FilterSelect } from "@/components/ui/FilterBar";
import { CropChip } from "@/components/planning/CropChip";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { SOIL_OPTIONS } from "@/lib/planning";
import { formatNumber } from "@/lib/utils";
import type { Variety } from "@/types";
import { formatCurrency } from "@/i18n/format";

type Form = Record<string, string>;
const EMPTY: Form = {
  crop: "",
  name: "",
  days_to_maturity: "110",
  maturity_group: "",
  seed_rate_per_acre: "0",
  expected_yield_per_acre: "0",
  yield_unit: "bu",
  drought_tolerance: "3",
  disease_resistance: "",
  traits: "",
  seed_cost_per_acre: "",
  min_soil_temp_c: "",
  gdd_to_maturity: "",
};
const DEFAULTS = { crop: "" };
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export function VarietiesTab() {
  const qc = useQueryClient();
  const { t } = useTranslation("grow");
  const labels = usePlanningLabels();
  const { values, setValue, reset, activeCount } = useUrlFilters(DEFAULTS);
  const cropsQ = useQuery({ queryKey: ["crops"], queryFn: () => cropsApi.crops() });
  const varsQ = useQuery({
    queryKey: ["varieties", values.crop],
    queryFn: () => cropsApi.varieties(values.crop ? { crop: values.crop } : undefined),
  });
  const crops = cropsQ.data?.results ?? [];
  const soils = useMemo(() => SOIL_OPTIONS.filter(([k]) => !k.includes(" ") || true), []);

  const [editing, setEditing] = useState<Variety | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [soilsSel, setSoilsSel] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Variety | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY, crop: values.crop || crops[0]?.id || "" });
    setSoilsSel([]);
    setActive(true);
    setError(null);
    setOpen(true);
  };
  const openEdit = (v: Variety) => {
    setEditing(v);
    setForm({
      crop: v.crop,
      name: v.name,
      days_to_maturity: String(v.days_to_maturity),
      maturity_group: v.maturity_group ?? "",
      seed_rate_per_acre: String(v.seed_rate_per_acre),
      expected_yield_per_acre: String(v.expected_yield_per_acre),
      yield_unit: v.yield_unit,
      drought_tolerance: String(v.drought_tolerance),
      disease_resistance: (v.disease_resistance ?? []).join(", "),
      traits: (v.traits ?? []).join(", "),
      seed_cost_per_acre: v.seed_cost_per_acre == null ? "" : String(v.seed_cost_per_acre),
      min_soil_temp_c: v.min_soil_temp_c == null ? "" : String(v.min_soil_temp_c),
      gdd_to_maturity: v.gdd_to_maturity == null ? "" : String(v.gdd_to_maturity),
    });
    setSoilsSel(v.suitable_soils ?? []);
    setActive(v.is_active);
    setError(null);
    setOpen(true);
  };

  const payload = (): Partial<Variety> => ({
    crop: form.crop,
    name: form.name,
    days_to_maturity: Number(form.days_to_maturity) || 0,
    maturity_group: form.maturity_group,
    seed_rate_per_acre: Number(form.seed_rate_per_acre) || 0,
    expected_yield_per_acre: Number(form.expected_yield_per_acre) || 0,
    yield_unit: form.yield_unit,
    drought_tolerance: Number(form.drought_tolerance) || 3,
    disease_resistance: list(form.disease_resistance),
    traits: list(form.traits),
    suitable_soils: soilsSel,
    seed_cost_per_acre: form.seed_cost_per_acre === "" ? null : Number(form.seed_cost_per_acre),
    min_soil_temp_c: form.min_soil_temp_c === "" ? null : Number(form.min_soil_temp_c),
    gdd_to_maturity: form.gdd_to_maturity === "" ? null : Number(form.gdd_to_maturity),
    is_active: active,
  });

  const save = useMutation({
    mutationFn: () => (editing ? cropsApi.patchVariety(editing.id, payload()) : cropsApi.createVariety(payload())),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["varieties"] });
      qc.invalidateQueries({ queryKey: ["crops"] });
      setOpen(false);
    },
    onError: (e) => setError(getApiError(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => cropsApi.deleteVariety(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["varieties"] });
      setConfirmDelete(null);
      setOpen(false);
    },
    onError: (e) => setError(getApiError(e)),
  });

  const cropOf = (id: string) => crops.find((c) => c.id === id);

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={3} gap={3} wrap="wrap">
        <FilterBar activeCount={activeCount} onReset={reset}>
          <FilterSelect
            value={values.crop}
            onChange={(v) => setValue("crop", v)}
            label={t("labels.crop", { ns: "common" })}
            allLabel={t("plans.allCrops")}
            options={crops.map((c) => [c.id, c.name] as [string, string])}
          />
        </FilterBar>
        <Button colorScheme="brand" size="sm" onClick={openNew} isDisabled={!crops.length}>
          {t("catalog.addVariety")}
        </Button>
      </Flex>
      <ErrorBanner message={varsQ.error ? getApiError(varsQ.error) : null} />
      <DataTable
        rows={varsQ.data?.results ?? []}
        rowKey={(v) => v.id}
        onRowClick={openEdit}
        emptyTitle={t("catalog.varietiesEmptyTitle")}
        emptyBody={t("catalog.varietiesEmptyBody")}
        columns={[
          {
            key: "name",
            header: t("catalog.columns.variety"),
            render: (v) => (
              <Flex align="center" gap={2}>
                <CropChip name={v.name} color={cropOf(v.crop)?.color_hex} detail={v.crop_name} />
                {!v.is_active ? <Badge colorScheme="gray">{t("catalog.inactive")}</Badge> : null}
              </Flex>
            ),
          },
          { key: "maturity", header: t("catalog.columns.maturity"), render: (v) => `${v.days_to_maturity}d${v.maturity_group ? ` · ${v.maturity_group}` : ""}` },
          { key: "yield", header: t("catalog.columns.yield"), render: (v) => `${formatNumber(v.expected_yield_per_acre, 0)} ${v.yield_unit}` },
          { key: "drought", header: t("catalog.columns.drought"), render: (v) => "●".repeat(v.drought_tolerance) + "○".repeat(5 - v.drought_tolerance) },
          { key: "soils", header: t("catalog.columns.soils"), render: (v) => (v.suitable_soils?.length ? v.suitable_soils.map(labels.soil).join(", ") : t("catalog.anySoil")) },
          { key: "disease", header: t("catalog.columns.resists"), render: (v) => (v.disease_resistance?.length ? v.disease_resistance.join(", ") : "—") },
          { key: "seed", header: t("catalog.columns.seedCost"), render: (v) => formatCurrency(v.effective_seed_cost) },
        ]}
      />

      <Drawer open={open} title={editing ? t("catalog.editVariety", { name: editing.name }) : t("catalog.addVariety")} onClose={() => setOpen(false)} wide>
        <ErrorBanner message={error} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={4}>
            <FormField label={t("labels.crop", { ns: "common" })} htmlFor="v-crop">
              <Select id="v-crop" value={form.crop} onChange={set("crop")} isRequired>
                <option value="">{t("catalog.fields.selectCrop")}</option>
                {crops.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={t("labels.name", { ns: "common" })} htmlFor="v-name">
              <Input id="v-name" isRequired value={form.name} onChange={set("name")} placeholder={t("catalog.varietyPlaceholder")} />
            </FormField>
          </SimpleGrid>
          <SimpleGrid columns={{ base: 2, md: 3 }} spacingX={4}>
            <FormField label={t("catalog.fields.daysToMaturity")} htmlFor="v-dtm">
              <Input id="v-dtm" type="number" value={form.days_to_maturity} onChange={set("days_to_maturity")} />
            </FormField>
            <FormField label={t("catalog.fields.maturityGroup")} htmlFor="v-mg" hint={t("catalog.fields.maturityGroupHint")}>
              <Input id="v-mg" value={form.maturity_group} onChange={set("maturity_group")} />
            </FormField>
            <FormField label={t("catalog.fields.gdd")} htmlFor="v-gdd">
              <Input id="v-gdd" type="number" value={form.gdd_to_maturity} onChange={set("gdd_to_maturity")} />
            </FormField>
            <FormField label={t("catalog.fields.expectedYield")} htmlFor="v-yld">
              <Input id="v-yld" type="number" step="0.1" value={form.expected_yield_per_acre} onChange={set("expected_yield_per_acre")} />
            </FormField>
            <FormField label={t("catalog.fields.yieldUnit")} htmlFor="v-unit">
              <Input id="v-unit" value={form.yield_unit} onChange={set("yield_unit")} />
            </FormField>
            <FormField label={t("catalog.fields.seedRate")} htmlFor="v-rate">
              <Input id="v-rate" type="number" value={form.seed_rate_per_acre} onChange={set("seed_rate_per_acre")} />
            </FormField>
            <FormField label={t("catalog.fields.seedCostOverride")} htmlFor="v-seed" hint={t("catalog.fields.seedCostHint")}>
              <Input id="v-seed" type="number" step="0.01" value={form.seed_cost_per_acre} onChange={set("seed_cost_per_acre")} />
            </FormField>
            <FormField label={t("catalog.fields.droughtTolerance")} htmlFor="v-dt">
              <Select id="v-dt" value={form.drought_tolerance} onChange={set("drought_tolerance")}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} — {t(`catalog.drought.${n}`)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={t("catalog.fields.minSoilTemp")} htmlFor="v-soilt">
              <Input id="v-soilt" type="number" step="0.5" value={form.min_soil_temp_c} onChange={set("min_soil_temp_c")} />
            </FormField>
          </SimpleGrid>
          <FormField label={t("catalog.fields.diseaseResistance")} htmlFor="v-dis" hint={t("catalog.fields.commaSeparated")}>
            <Input id="v-dis" value={form.disease_resistance} onChange={set("disease_resistance")} placeholder={t("catalog.diseasePlaceholder")} />
          </FormField>
          <FormField label={t("catalog.fields.traits")} htmlFor="v-traits" hint={t("catalog.fields.commaSeparated")}>
            <Input id="v-traits" value={form.traits} onChange={set("traits")} placeholder={t("catalog.traitsPlaceholder")} />
          </FormField>
          <FormField label={t("catalog.fields.suitableSoils")} hint={t("catalog.fields.soilsHint")}>
            <Wrap spacing={2}>
              {soils.map(([k, l]) => (
                <WrapItem key={k}>
                  <Checkbox
                    size="sm"
                    colorScheme="brand"
                    isChecked={soilsSel.includes(k)}
                    onChange={(e) => setSoilsSel((cur) => (e.target.checked ? [...cur, k] : cur.filter((x) => x !== k)))}
                  >
                    {labels.soil(k)}
                  </Checkbox>
                </WrapItem>
              ))}
            </Wrap>
          </FormField>
          <Flex align="center" gap={3} mb={4}>
            <Switch id="v-active" isChecked={active} onChange={(e) => setActive(e.target.checked)} colorScheme="brand" />
            <Text as="label" htmlFor="v-active" fontSize="sm">
              {t("catalog.fields.activeVariety")}
            </Text>
          </Flex>
          <Flex gap={2}>
            <Button type="submit" colorScheme="brand" isDisabled={save.isPending || !form.name || !form.crop}>
              {save.isPending ? t("actions.saving", { ns: "common" }) : editing ? t("actions.saveChanges", { ns: "common" }) : t("catalog.addVariety")}
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
        title={t("catalog.deleteVariety") + ` — ${confirmDelete?.name}`}
        body={t("catalog.deleteVarietyBody")}
        confirmLabel={t("catalog.deleteVariety")}
        danger
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove.mutate(confirmDelete.id)}
      />
    </Box>
  );
}
