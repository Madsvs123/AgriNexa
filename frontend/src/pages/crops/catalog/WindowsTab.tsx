import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Flex, Input, Select, SimpleGrid, Text, Textarea } from "@chakra-ui/react";
import { cropsApi, farmsApi, getApiError } from "@/api/client";
import { DataTable } from "@/components/ui/DataTable";
import { Drawer, ConfirmDialog } from "@/components/ui/Modal";
import { ErrorBanner, FormField } from "@/components/ui/FormField";
import { CropChip } from "@/components/planning/CropChip";
import { MONTHS, monthDay } from "@/lib/planning";
import type { PlantingWindow } from "@/types";

type MD = { month: string; day: string };
const md = (m: number | null | undefined, d: number | null | undefined): MD => ({
  month: m ? String(m) : "",
  day: d ? String(d) : "",
});

function MonthDayPicker({ label, value, onChange, required, hint }: { label: string; value: MD; onChange: (v: MD) => void; required?: boolean; hint?: string }) {
  return (
    <FormField label={label} hint={hint}>
      <Flex gap={2}>
        <Select
          size="sm"
          value={value.month}
          onChange={(e) => onChange({ ...value, month: e.target.value })}
          isRequired={required}
          aria-label={`${label} month`}
        >
          <option value="">{required ? "Month" : "— none —"}</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </Select>
        <Input
          size="sm"
          type="number"
          min={1}
          max={31}
          w="80px"
          value={value.day}
          onChange={(e) => onChange({ ...value, day: e.target.value })}
          isRequired={required}
          aria-label={`${label} day`}
          placeholder="Day"
        />
      </Flex>
    </FormField>
  );
}

export function WindowsTab() {
  const qc = useQueryClient();
  const cropsQ = useQuery({ queryKey: ["crops"], queryFn: () => cropsApi.crops() });
  const varsQ = useQuery({ queryKey: ["varieties"], queryFn: () => cropsApi.varieties() });
  const farmsQ = useQuery({ queryKey: ["farms"], queryFn: () => farmsApi.list() });
  const winQ = useQuery({ queryKey: ["planting-windows"], queryFn: () => cropsApi.plantingWindows() });
  const crops = cropsQ.data?.results ?? [];

  const [editing, setEditing] = useState<PlantingWindow | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PlantingWindow | null>(null);
  const [crop, setCrop] = useState("");
  const [variety, setVariety] = useState("");
  const [farm, setFarm] = useState("");
  const [start, setStart] = useState<MD>({ month: "", day: "" });
  const [end, setEnd] = useState<MD>({ month: "", day: "" });
  const [late, setLate] = useState<MD>({ month: "", day: "" });
  const [harvestBy, setHarvestBy] = useState<MD>({ month: "", day: "" });
  const [soilTemp, setSoilTemp] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");

  const openNew = () => {
    setEditing(null);
    setCrop(crops[0]?.id ?? "");
    setVariety("");
    setFarm("");
    setStart({ month: "", day: "" });
    setEnd({ month: "", day: "" });
    setLate({ month: "", day: "" });
    setHarvestBy({ month: "", day: "" });
    setSoilTemp("");
    setSource("");
    setNotes("");
    setError(null);
    setOpen(true);
  };
  const openEdit = (w: PlantingWindow) => {
    setEditing(w);
    setCrop(w.crop);
    setVariety(w.variety ?? "");
    setFarm(w.farm ?? "");
    setStart(md(w.start_month, w.start_day));
    setEnd(md(w.end_month, w.end_day));
    setLate(md(w.late_end_month, w.late_end_day));
    setHarvestBy(md(w.harvest_by_month, w.harvest_by_day));
    setSoilTemp(w.min_soil_temp_c == null ? "" : String(w.min_soil_temp_c));
    setSource(w.source ?? "");
    setNotes(w.notes ?? "");
    setError(null);
    setOpen(true);
  };

  const n = (v: string) => (v === "" ? null : Number(v));
  const payload = (): Partial<PlantingWindow> => ({
    crop,
    variety: variety || null,
    farm: farm || null,
    start_month: Number(start.month),
    start_day: Number(start.day),
    end_month: Number(end.month),
    end_day: Number(end.day),
    late_end_month: n(late.month),
    late_end_day: n(late.day),
    harvest_by_month: n(harvestBy.month),
    harvest_by_day: n(harvestBy.day),
    min_soil_temp_c: n(soilTemp),
    source,
    notes,
  });

  const save = useMutation({
    mutationFn: () => (editing ? cropsApi.patchPlantingWindow(editing.id, payload()) : cropsApi.createPlantingWindow(payload())),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planting-windows"] });
      setOpen(false);
    },
    onError: (e) => setError(getApiError(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => cropsApi.deletePlantingWindow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planting-windows"] });
      setConfirmDelete(null);
      setOpen(false);
    },
  });

  const cropOf = (id: string) => crops.find((c) => c.id === id);
  const cropVarieties = (varsQ.data?.results ?? []).filter((v) => v.crop === crop);

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={3} gap={3} wrap="wrap">
        <Text color="fg.muted" fontSize="sm">
          Optimal and late sowing dates plus a harvest-by deadline. Variety- or farm-specific rows override the crop-wide one.
        </Text>
        <Button colorScheme="brand" size="sm" onClick={openNew} isDisabled={!crops.length}>
          Add window
        </Button>
      </Flex>
      <ErrorBanner message={winQ.error ? getApiError(winQ.error) : null} />
      <DataTable
        rows={winQ.data?.results ?? []}
        rowKey={(w) => w.id}
        onRowClick={openEdit}
        emptyTitle="No planting windows"
        emptyBody="Without windows the planner falls back to generic dates by crop category."
        columns={[
          {
            key: "crop",
            header: "Applies to",
            render: (w) => (
              <CropChip
                name={w.crop_name ?? "Crop"}
                color={cropOf(w.crop)?.color_hex}
                detail={[w.variety_name, w.farm_name].filter(Boolean).join(" · ") || "all varieties, all farms"}
              />
            ),
          },
          { key: "window", header: "Optimal", render: (w) => `${monthDay(w.start_month, w.start_day)} – ${monthDay(w.end_month, w.end_day)}` },
          { key: "late", header: "Late until", render: (w) => monthDay(w.late_end_month, w.late_end_day) },
          { key: "harvest", header: "Harvest by", render: (w) => monthDay(w.harvest_by_month, w.harvest_by_day) },
          { key: "soil", header: "Min soil °C", render: (w) => (w.min_soil_temp_c == null ? "—" : `${w.min_soil_temp_c}°`) },
          { key: "source", header: "Source", render: (w) => w.source || "—" },
        ]}
      />

      <Drawer open={open} title={editing ? "Edit planting window" : "Add planting window"} onClose={() => setOpen(false)}>
        <ErrorBanner message={error} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <FormField label="Crop" htmlFor="w-crop">
            <Select
              id="w-crop"
              value={crop}
              onChange={(e) => {
                setCrop(e.target.value);
                setVariety("");
              }}
              isRequired
            >
              {crops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          <SimpleGrid columns={2} spacingX={4}>
            <FormField label="Variety" htmlFor="w-var" hint="Optional override">
              <Select id="w-var" value={variety} onChange={(e) => setVariety(e.target.value)} isDisabled={!cropVarieties.length}>
                <option value="">All varieties</option>
                {cropVarieties.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Farm" htmlFor="w-farm" hint="Optional override">
              <Select id="w-farm" value={farm} onChange={(e) => setFarm(e.target.value)}>
                <option value="">All farms</option>
                {(farmsQ.data?.results ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </SimpleGrid>
          <MonthDayPicker label="Optimal start" value={start} onChange={setStart} required />
          <MonthDayPicker label="Optimal end" value={end} onChange={setEnd} required />
          <MonthDayPicker label="Late planting until" value={late} onChange={setLate} hint="Yield penalty after optimal end" />
          <MonthDayPicker label="Harvest by" value={harvestBy} onChange={setHarvestBy} hint="First killing frost or contract date" />
          <SimpleGrid columns={2} spacingX={4}>
            <FormField label="Min soil temp °C" htmlFor="w-soil">
              <Input id="w-soil" type="number" step="0.5" value={soilTemp} onChange={(e) => setSoilTemp(e.target.value)} />
            </FormField>
            <FormField label="Source" htmlFor="w-src">
              <Input id="w-src" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Extension bulletin" />
            </FormField>
          </SimpleGrid>
          <FormField label="Notes" htmlFor="w-notes">
            <Textarea id="w-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </FormField>
          <Flex gap={2}>
            <Button type="submit" colorScheme="brand" isDisabled={save.isPending || !crop || !start.month || !end.month}>
              {save.isPending ? "Saving…" : editing ? "Save changes" : "Add window"}
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
        title="Delete planting window?"
        body="Assessments fall back to the next most specific window, or the category default."
        confirmLabel="Delete"
        danger
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove.mutate(confirmDelete.id)}
      />
    </Box>
  );
}
