import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { CROP_CATEGORIES, fmtMoney } from "@/lib/planning";
import { formatNumber } from "@/lib/utils";
import type { Crop } from "@/types";

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
          Agronomic profile and default economics per crop. Strategies and the variety recommender read these.
        </Text>
        <Button colorScheme="brand" size="sm" onClick={openNew}>
          Add crop
        </Button>
      </Flex>
      <ErrorBanner message={cropsQ.error ? getApiError(cropsQ.error) : null} />
      <DataTable
        rows={crops}
        rowKey={(c) => c.id}
        onRowClick={openEdit}
        emptyTitle="No crops in the catalog"
        emptyBody="Add corn, soybean, or wheat to start planning."
        emptyAction={
          <Button colorScheme="brand" onClick={openNew}>
            Add crop
          </Button>
        }
        columns={[
          { key: "name", header: "Crop", render: (c) => <CropChip name={c.name} color={c.color_hex} detail={c.family || null} /> },
          { key: "category", header: "Category", render: (c) => CROP_CATEGORIES.find(([k]) => k === c.category)?.[1] ?? c.category },
          { key: "typical_days", header: "Days", render: (c) => `${c.typical_days}d` },
          { key: "water", header: "Water", render: (c) => `${c.water_need} · ${formatNumber(c.effective_water_inches, 0)} in` },
          { key: "n", header: "N lb/ac", render: (c) => (c.nitrogen_fixing ? "fixes N" : formatNumber(c.nitrogen_lb_per_acre, 0)) },
          { key: "yield", header: "Yield/ac", render: (c) => `${formatNumber(c.expected_yield_per_acre, 0)} ${c.yield_unit}` },
          { key: "price", header: "Price", render: (c) => fmtMoney(c.expected_price_per_unit, 2) },
          { key: "margin", header: "Margin/ac", render: (c) => fmtMoney(marginPerAcre(c)) },
          { key: "varieties", header: "Varieties", render: (c) => c.variety_count ?? 0 },
        ]}
      />

      <Drawer open={open} title={editing ? `Edit ${editing.name}` : "Add crop"} onClose={() => setOpen(false)} wide>
        <ErrorBanner message={error} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={4}>
            <FormField label="Name" htmlFor="c-name">
              <Input id="c-name" isRequired value={form.name} onChange={set("name")} />
            </FormField>
            <FormField label="Category" htmlFor="c-cat">
              <Select id="c-cat" value={form.category} onChange={set("category")}>
                {CROP_CATEGORIES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Botanical family" htmlFor="c-fam" hint="Drives rotation rules, e.g. Poaceae, Fabaceae, Solanaceae">
              <Input id="c-fam" value={form.family} onChange={set("family")} />
            </FormField>
            <FormField label="Scientific name" htmlFor="c-sci">
              <Input id="c-sci" value={form.scientific_name} onChange={set("scientific_name")} />
            </FormField>
          </SimpleGrid>

          <Text fontSize="xs" textTransform="uppercase" letterSpacing="wider" color="fg.muted" mt={2} mb={2}>
            Agronomy
          </Text>
          <SimpleGrid columns={{ base: 2, md: 3 }} spacingX={4}>
            <FormField label="Typical days" htmlFor="c-days">
              <Input id="c-days" type="number" value={form.typical_days} onChange={set("typical_days")} />
            </FormField>
            <FormField label="Water need" htmlFor="c-water">
              <Select id="c-water" value={form.water_need} onChange={set("water_need")}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </FormField>
            <FormField label="Water (ac-in/season)" htmlFor="c-win" hint="Blank = derive from need">
              <Input id="c-win" type="number" step="0.5" value={form.water_acre_inches} onChange={set("water_acre_inches")} />
            </FormField>
            <FormField label="Root depth" htmlFor="c-root">
              <Select id="c-root" value={form.root_depth} onChange={set("root_depth")}>
                <option value="shallow">Shallow</option>
                <option value="medium">Medium</option>
                <option value="deep">Deep</option>
              </Select>
            </FormField>
            <FormField label="Labor h/acre" htmlFor="c-labor">
              <Input id="c-labor" type="number" step="0.1" value={form.labor_hours_per_acre} onChange={set("labor_hours_per_acre")} />
            </FormField>
            <FormField label="N demand lb/acre" htmlFor="c-n">
              <Input id="c-n" type="number" value={form.nitrogen_lb_per_acre} onChange={set("nitrogen_lb_per_acre")} isDisabled={nitrogenFixing} />
            </FormField>
          </SimpleGrid>
          <Flex align="center" gap={3} mb={4}>
            <Switch id="c-fix" isChecked={nitrogenFixing} onChange={(e) => setNitrogenFixing(e.target.checked)} colorScheme="brand" />
            <Text as="label" htmlFor="c-fix" fontSize="sm">
              Nitrogen-fixing legume (credits the following crop)
            </Text>
          </Flex>

          <Text fontSize="xs" textTransform="uppercase" letterSpacing="wider" color="fg.muted" mb={2}>
            Economics (defaults per acre)
          </Text>
          <SimpleGrid columns={{ base: 2, md: 3 }} spacingX={4}>
            <FormField label="Expected yield" htmlFor="c-yld">
              <Input id="c-yld" type="number" step="0.1" value={form.expected_yield_per_acre} onChange={set("expected_yield_per_acre")} />
            </FormField>
            <FormField label="Yield unit" htmlFor="c-unit">
              <Input id="c-unit" value={form.yield_unit} onChange={set("yield_unit")} />
            </FormField>
            <FormField label="Price per unit ($)" htmlFor="c-price">
              <Input id="c-price" type="number" step="0.01" value={form.expected_price_per_unit} onChange={set("expected_price_per_unit")} />
            </FormField>
            <FormField label="Seed cost ($/ac)" htmlFor="c-seed">
              <Input id="c-seed" type="number" step="0.01" value={form.seed_cost_per_acre} onChange={set("seed_cost_per_acre")} />
            </FormField>
            <FormField label="Other inputs ($/ac)" htmlFor="c-inputs" hint="Fertilizer, chemical, fuel">
              <Input id="c-inputs" type="number" step="0.01" value={form.input_cost_per_acre} onChange={set("input_cost_per_acre")} />
            </FormField>
            <FormField label="Map colour" htmlFor="c-color">
              <Input id="c-color" type="color" value={form.color_hex} onChange={set("color_hex")} p={1} h="40px" />
            </FormField>
          </SimpleGrid>

          {crops.filter((c) => c.id !== editing?.id).length ? (
            <FormField label="Compatible intercrops" hint="Highlighted when building a mixed-cropping plan">
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
              {save.isPending ? "Saving…" : editing ? "Save changes" : "Add crop"}
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
        body="Varieties and planting windows for this crop are removed too. Crops referenced by plans cannot be deleted."
        confirmLabel="Delete crop"
        danger
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove.mutate(confirmDelete.id)}
      />
    </Box>
  );
}
