import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Badge, Box, Button, Checkbox, Flex, Input, Select, SimpleGrid, Text, Textarea, Tooltip } from "@chakra-ui/react";
import { Star } from "lucide-react";
import { cropsApi, farmsApi, getApiError } from "@/api/client";
import { ListPage } from "@/components/templates/ListPage";
import { DataTable } from "@/components/ui/DataTable";
import { FilterBar, FilterSelect } from "@/components/ui/FilterBar";
import { Drawer } from "@/components/ui/Modal";
import { ErrorBanner, FormField } from "@/components/ui/FormField";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { useScope } from "@/hooks/useScope";
import { RAINFALL_OPTIONS, fmtMoney, riskScheme } from "@/lib/planning";
import { formatNumber } from "@/lib/utils";
import type { Strategy } from "@/types";

const STATUS: Array<[string, string]> = [
  ["draft", "Draft"],
  ["candidate", "Candidate"],
  ["adopted", "Adopted"],
  ["archived", "Archived"],
];
const STATUS_SCHEME: Record<string, string> = { draft: "gray", candidate: "blue", adopted: "green", archived: "gray" };
const DEFAULTS = { status: "" };

export default function StrategiesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { params: scopeParams, farmId, seasonId } = useScope();
  const { values, setValue, reset, activeCount, apiParams } = useUrlFilters(DEFAULTS);
  const listQ = useQuery({
    queryKey: ["strategies", apiParams, scopeParams],
    queryFn: () =>
      cropsApi.strategies({
        ...(scopeParams.farm ? { farm: scopeParams.farm } : {}),
        ...(scopeParams.season_id ? { season: scopeParams.season_id } : {}),
        status: values.status || undefined,
      }),
    placeholderData: keepPreviousData,
  });
  const farmsQ = useQuery({ queryKey: ["farms"], queryFn: () => farmsApi.list() });
  const seasonsQ = useQuery({ queryKey: ["seasons"], queryFn: () => cropsApi.seasons() });

  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [farm, setFarm] = useState("");
  const [season, setSeason] = useState("");
  const [rainfall, setRainfall] = useState<"dry" | "normal" | "wet">("normal");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => cropsApi.createStrategy({ name, description, farm, season, rainfall_scenario: rainfall, status: "draft" }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["strategies"] });
      setOpen(false);
      navigate(`/crops/strategies/${s.id}`);
    },
    onError: (e) => setError(getApiError(e)),
  });
  const setBaseline = useMutation({
    mutationFn: (id: string) => cropsApi.patchStrategy(id, { is_baseline: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategies"] }),
  });
  const clone = useMutation({
    mutationFn: (id: string) => cropsApi.cloneStrategy(id),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["strategies"] });
      navigate(`/crops/strategies/${s.id}`);
    },
  });

  const rows = listQ.data?.results ?? [];
  const toggle = (id: string, on: boolean) => setSelected((cur) => (on ? [...cur, id] : cur.filter((x) => x !== id)));

  return (
    <ListPage
      title="Farming strategies"
      subtitle="Alternative plans for a farm-season, scored on margin, resources, rotation, and risk. Compare, then adopt one."
      error={listQ.error ? getApiError(listQ.error) : null}
      loading={listQ.isLoading}
      actions={
        <>
          <Button
            variant="outline"
            colorScheme="gray"
            isDisabled={selected.length < 2}
            onClick={() => navigate(`/crops/strategies/compare?ids=${selected.join(",")}`)}
          >
            Compare {selected.length ? `(${selected.length})` : ""}
          </Button>
          <Button
            colorScheme="brand"
            onClick={() => {
              setName("");
              setDescription("");
              setFarm(farmId ?? farmsQ.data?.results[0]?.id ?? "");
              setSeason(seasonId ?? seasonsQ.data?.results.find((s) => s.is_active)?.id ?? "");
              setRainfall("normal");
              setError(null);
              setOpen(true);
            }}
          >
            New strategy
          </Button>
        </>
      }
      filters={
        <FilterBar activeCount={activeCount} onReset={reset}>
          <FilterSelect value={values.status} onChange={(v) => setValue("status", v)} label="Status" allLabel="All statuses" options={STATUS} />
          {selected.length ? (
            <Text fontSize="sm" color="fg.muted">
              {selected.length} selected ·{" "}
              <Box as="button" color="brand.500" onClick={() => setSelected([])}>
                clear
              </Box>
            </Text>
          ) : null}
        </FilterBar>
      }
    >
      <DataTable
        rows={rows}
        rowKey={(s) => s.id}
        onRowClick={(s) => navigate(`/crops/strategies/${s.id}`)}
        emptyTitle="No strategies yet"
        emptyBody="Create one from scratch, or open a rotation and generate next season's allocations from it."
        columns={[
          {
            key: "select",
            header: "",
            render: (s) => (
              <Box onClick={(e) => e.stopPropagation()}>
                <Checkbox colorScheme="brand" isChecked={selected.includes(s.id)} onChange={(e) => toggle(s.id, e.target.checked)} aria-label={`Select ${s.name}`} />
              </Box>
            ),
          },
          {
            key: "name",
            header: "Strategy",
            render: (s) => (
              <Flex align="center" gap={2}>
                {s.is_baseline ? (
                  <Tooltip label="Baseline — comparisons show deltas against this">
                    <Box color="wheat.500"><Star size={14} fill="currentColor" /></Box>
                  </Tooltip>
                ) : null}
                <Box>
                  <Text fontWeight="semibold">{s.name}</Text>
                  <Text fontSize="xs" color="fg.muted">
                    {s.farm_name} · {s.season_name}
                    {s.rotation_name ? ` · from ${s.rotation_name}` : ""}
                  </Text>
                </Box>
              </Flex>
            ),
          },
          { key: "status", header: "Status", render: (s) => <Badge colorScheme={STATUS_SCHEME[s.status] ?? "gray"} textTransform="capitalize">{s.status}</Badge> },
          { key: "scenario", header: "Scenario", render: (s) => `${RAINFALL_OPTIONS.find(([k]) => k === s.rainfall_scenario)?.[1] ?? s.rainfall_scenario} · ×${Number(s.price_multiplier).toFixed(2)} price` },
          { key: "acres", header: "Acres", render: (s) => (s.summary?.acres != null ? formatNumber(s.summary.acres, 0) : "—") },
          { key: "margin", header: "Margin", render: (s) => (s.summary?.margin != null ? `${fmtMoney(s.summary.margin)} · ${fmtMoney(s.summary.margin_per_acre)}/ac` : "—") },
          {
            key: "risk",
            header: "Risk",
            render: (s) => (s.summary?.risk_score != null ? <Badge colorScheme={riskScheme(s.summary.risk_score)}>{s.summary.risk_score}</Badge> : "—"),
          },
          {
            key: "feasible",
            header: "Feasible",
            render: (s) =>
              s.summary?.feasible == null ? "—" : s.summary.feasible ? <Badge colorScheme="green">Yes</Badge> : <Badge colorScheme="red">{s.summary.hard_violations} violation{s.summary.hard_violations === 1 ? "" : "s"}</Badge>,
          },
          {
            key: "actions",
            header: "",
            render: (s) => (
              <Flex gap={1} onClick={(e) => e.stopPropagation()}>
                {!s.is_baseline ? (
                  <Button size="xs" variant="ghost" onClick={() => setBaseline.mutate(s.id)}>Set baseline</Button>
                ) : null}
                <Button size="xs" variant="ghost" onClick={() => clone.mutate(s.id)}>Clone</Button>
              </Flex>
            ),
          },
        ]}
      />

      <Drawer open={open} title="New strategy" onClose={() => setOpen(false)}>
        <ErrorBanner message={error} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <FormField label="Name" htmlFor="st-name">
            <Input id="st-name" isRequired value={name} onChange={(e) => setName(e.target.value)} placeholder="More soy, dry year" />
          </FormField>
          <SimpleGrid columns={2} spacingX={4}>
            <FormField label="Farm" htmlFor="st-farm">
              <Select id="st-farm" value={farm} onChange={(e) => setFarm(e.target.value)} isRequired>
                <option value="">Select farm</option>
                {(farmsQ.data?.results ?? []).map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Season" htmlFor="st-season">
              <Select id="st-season" value={season} onChange={(e) => setSeason(e.target.value)} isRequired>
                <option value="">Select season</option>
                {(seasonsQ.data?.results ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </FormField>
          </SimpleGrid>
          <FormField label="Rainfall scenario" htmlFor="st-rain">
            <Select id="st-rain" value={rainfall} onChange={(e) => setRainfall(e.target.value as "dry" | "normal" | "wet")}>
              {RAINFALL_OPTIONS.map(([k, l, d]) => (
                <option key={k} value={k}>{l} — {d}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Description" htmlFor="st-desc">
            <Textarea id="st-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </FormField>
          <Button type="submit" colorScheme="brand" isDisabled={create.isPending || !name || !farm || !season}>
            {create.isPending ? "Creating…" : "Create and allocate fields"}
          </Button>
        </form>
      </Drawer>
    </ListPage>
  );
}
