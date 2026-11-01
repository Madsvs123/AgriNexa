import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
            label="Crop"
            allLabel="All crops"
            options={crops.map((c) => [c.id, c.name] as [string, string])}
          />
        </FilterBar>
        <Button colorScheme="brand" size="sm" onClick={openNew} isDisabled={!crops.length}>
          Add variety
        </Button>
      </Flex>
      <ErrorBanner message={varsQ.error ? getApiError(varsQ.error) : null} />
      <DataTable
        rows={varsQ.data?.results ?? []}
        rowKey={(v) => v.id}
        onRowClick={openEdit}
        emptyTitle="No varieties"
        emptyBody="Add hybrids with maturity, drought tolerance, and soil suitability so the recommender can rank them."
        columns={[
          {
            key: "name",
            header: "Variety",
            render: (v) => (
              <Flex align="center" gap={2}>
                <CropChip name={v.name} color={cropOf(v.crop)?.color_hex} detail={v.crop_name} />
                {!v.is_active ? <Badge colorScheme="gray">inactive</Badge> : null}
              </Flex>
            ),
          },
          { key: "maturity", header: "Maturity", render: (v) => `${v.days_to_maturity}d${v.maturity_group ? ` · ${v.maturity_group}` : ""}` },
          { key: "yield", header: "Yield/ac", render: (v) => `${formatNumber(v.expected_yield_per_acre, 0)} ${v.yield_unit}` },
          { key: "drought", header: "Drought", render: (v) => "●".repeat(v.drought_tolerance) + "○".repeat(5 - v.drought_tolerance) },
          { key: "soils", header: "Soils", render: (v) => (v.suitable_soils?.length ? v.suitable_soils.join(", ") : "any") },
          { key: "disease", header: "Resists", render: (v) => (v.disease_resistance?.length ? v.disease_resistance.join(", ") : "—") },
          { key: "seed", header: "Seed $/ac", render: (v) => formatCurrency(v.effective_seed_cost) },
        ]}
      />

      <Drawer open={open} title={editing ? `Edit ${editing.name}` : "Add variety"} onClose={() => setOpen(false)} wide>
        <ErrorBanner message={error} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={4}>
            <FormField label="Crop" htmlFor="v-crop">
              <Select id="v-crop" value={form.crop} onChange={set("crop")} isRequired>
                <option value="">Select crop</option>
                {crops.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Name" htmlFor="v-name">
              <Input id="v-name" isRequired value={form.name} onChange={set("name")} placeholder="DKC 62-08" />
            </FormField>
          </SimpleGrid>
          <SimpleGrid columns={{ base: 2, md: 3 }} spacingX={4}>
            <FormField label="Days to maturity" htmlFor="v-dtm">
              <Input id="v-dtm" type="number" value={form.days_to_maturity} onChange={set("days_to_maturity")} />
            </FormField>
            <FormField label="Maturity group" htmlFor="v-mg" hint="RM 112, MG 3.6">
              <Input id="v-mg" value={form.maturity_group} onChange={set("maturity_group")} />
            </FormField>
            <FormField label="GDD to maturity" htmlFor="v-gdd">
              <Input id="v-gdd" type="number" value={form.gdd_to_maturity} onChange={set("gdd_to_maturity")} />
            </FormField>
            <FormField label="Expected yield" htmlFor="v-yld">
              <Input id="v-yld" type="number" step="0.1" value={form.expected_yield_per_acre} onChange={set("expected_yield_per_acre")} />
            </FormField>
            <FormField label="Yield unit" htmlFor="v-unit">
              <Input id="v-unit" value={form.yield_unit} onChange={set("yield_unit")} />
            </FormField>
            <FormField label="Seed rate / acre" htmlFor="v-rate">
              <Input id="v-rate" type="number" value={form.seed_rate_per_acre} onChange={set("seed_rate_per_acre")} />
            </FormField>
            <FormField label="Seed cost $/ac" htmlFor="v-seed" hint="Blank = crop default">
              <Input id="v-seed" type="number" step="0.01" value={form.seed_cost_per_acre} onChange={set("seed_cost_per_acre")} />
            </FormField>
            <FormField label="Drought tolerance" htmlFor="v-dt">
              <Select id="v-dt" value={form.drought_tolerance} onChange={set("drought_tolerance")}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} — {["poor", "below average", "average", "good", "excellent"][n - 1]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Min soil temp °C" htmlFor="v-soilt">
              <Input id="v-soilt" type="number" step="0.5" value={form.min_soil_temp_c} onChange={set("min_soil_temp_c")} />
            </FormField>
          </SimpleGrid>
          <FormField label="Disease resistance" htmlFor="v-dis" hint="Comma-separated">
            <Input id="v-dis" value={form.disease_resistance} onChange={set("disease_resistance")} placeholder="gray leaf spot, SCN" />
          </FormField>
          <FormField label="Traits" htmlFor="v-traits" hint="Comma-separated">
            <Input id="v-traits" value={form.traits} onChange={set("traits")} placeholder="VT2P, drought-tolerant" />
          </FormField>
          <FormField label="Suitable soils" hint="Leave empty if the variety suits any soil">
            <Wrap spacing={2}>
              {soils.map(([k, l]) => (
                <WrapItem key={k}>
                  <Checkbox
                    size="sm"
                    colorScheme="brand"
                    isChecked={soilsSel.includes(k)}
                    onChange={(e) => setSoilsSel((cur) => (e.target.checked ? [...cur, k] : cur.filter((x) => x !== k)))}
                  >
                    {l}
                  </Checkbox>
                </WrapItem>
              ))}
            </Wrap>
          </FormField>
          <Flex align="center" gap={3} mb={4}>
            <Switch id="v-active" isChecked={active} onChange={(e) => setActive(e.target.checked)} colorScheme="brand" />
            <Text as="label" htmlFor="v-active" fontSize="sm">
              Active (offered by the recommender)
            </Text>
          </Flex>
          <Flex gap={2}>
            <Button type="submit" colorScheme="brand" isDisabled={save.isPending || !form.name || !form.crop}>
              {save.isPending ? "Saving…" : editing ? "Save changes" : "Add variety"}
            </Button>
            {editing ? (
              <Button variant="ghost" colorScheme="red" onClick={() => setConfirmDelete(editing)}>
                Delete
              </Button>
            ) : null}
          </Flex>
        </form>
      </Drawer>
      <ConfirmDialog
        open={!!confirmDelete}
        title={`Delete ${confirmDelete?.name}?`}
        body="Plans that reference this variety keep their crop but lose the variety."
        confirmLabel="Delete variety"
        danger
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove.mutate(confirmDelete.id)}
      />
    </Box>
  );
}
