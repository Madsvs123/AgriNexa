import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, CardBody, Flex, Heading, Input, Select, SimpleGrid, Switch, Text, Textarea } from "@chakra-ui/react";
import { cropsApi, farmsApi, getApiError } from "@/api/client";
import { ListPage } from "@/components/templates/ListPage";
import { DataTable } from "@/components/ui/DataTable";
import { ConfirmDialog, Drawer } from "@/components/ui/Modal";
import { ErrorBanner, FormField } from "@/components/ui/FormField";
import { ConstraintBars } from "@/components/planning/ConstraintBars";
import { MetricGrid } from "@/components/planning/MetricGrid";
import { useScope } from "@/hooks/useScope";
import { RESOURCE_OPTIONS } from "@/lib/planning";
import { formatNumber } from "@/lib/utils";
import type { ResourceConstraint, ResourceKey } from "@/types";
import { formatCurrency } from "@/i18n/format";
import { usePlanningLabels } from "@/lib/usePlanningLabels";

export default function ConstraintsPage() {
  const qc = useQueryClient();
  const { farmId, seasonId } = useScope();
  const labels = usePlanningLabels();
  const listQ = useQuery({ queryKey: ["resource-constraints"], queryFn: () => cropsApi.constraints() });
  const farmsQ = useQuery({ queryKey: ["farms"], queryFn: () => farmsApi.list() });
  const seasonsQ = useQuery({ queryKey: ["seasons"], queryFn: () => cropsApi.seasons() });
  const usageQ = useQuery({
    queryKey: ["season-usage", seasonId, farmId],
    queryFn: () => cropsApi.seasonUsage({ season: seasonId!, farm: farmId || undefined }),
    enabled: !!seasonId,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ResourceConstraint | null>(null);
  const [resource, setResource] = useState<ResourceKey>("water_acre_inches");
  const [farm, setFarm] = useState("");
  const [season, setSeason] = useState("");
  const [limit, setLimit] = useState("");
  const [unit, setUnit] = useState("ac-in");
  const [hard, setHard] = useState(true);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ResourceConstraint | null>(null);

  const openNew = () => {
    setEditing(null);
    setResource("water_acre_inches");
    setFarm(farmId ?? "");
    setSeason(seasonId ?? "");
    setLimit("");
    setUnit("ac-in");
    setHard(true);
    setNotes("");
    setError(null);
    setOpen(true);
  };
  const openEdit = (c: ResourceConstraint) => {
    setEditing(c);
    setResource(c.resource);
    setFarm(c.farm ?? "");
    setSeason(c.season ?? "");
    setLimit(String(c.limit_value));
    setUnit(c.unit);
    setHard(c.is_hard);
    setNotes(c.notes);
    setError(null);
    setOpen(true);
  };
  const payload = (): Partial<ResourceConstraint> => ({
    resource,
    farm: farm || null,
    season: season || null,
    limit_value: Number(limit),
    unit,
    is_hard: hard,
    notes,
  });
  const save = useMutation({
    mutationFn: () => (editing ? cropsApi.patchConstraint(editing.id, payload()) : cropsApi.createConstraint(payload())),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resource-constraints"] });
      qc.invalidateQueries({ queryKey: ["season-usage"] });
      qc.invalidateQueries({ queryKey: ["strategies"] });
      setOpen(false);
    },
    onError: (e) => setError(getApiError(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => cropsApi.deleteConstraint(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resource-constraints"] });
      qc.invalidateQueries({ queryKey: ["season-usage"] });
      setConfirmDelete(null);
      setOpen(false);
    },
  });

  const fmtLimit = (c: ResourceConstraint) => (c.unit === "USD" ? formatCurrency(c.limit_value) : `${formatNumber(c.limit_value, 0)} ${c.unit}`);

  return (
    <ListPage
      title="Resource constraints"
      subtitle="Water, labor, nitrogen, budget, and acreage limits that plans and strategies are checked against."
      error={listQ.error ? getApiError(listQ.error) : null}
      loading={listQ.isLoading}
      actions={
        <Button colorScheme="brand" onClick={openNew}>
          Add constraint
        </Button>
      }
      stats={
        <Card variant="surface">
          <CardBody>
            <Flex align="center" gap={2} mb={3} wrap="wrap">
              <Heading size="sm">Committed plans vs limits</Heading>
              <Text color="fg.muted" fontSize="sm">
                {usageQ.data ? `${usageQ.data.season}${usageQ.data.farm ? ` · ${usageQ.data.farm}` : " · all farms"} · ${usageQ.data.plan_count} plans` : seasonId ? "Loading…" : "Pick a season in the scope control to see utilisation."}
              </Text>
            </Flex>
            {usageQ.data && !farmId && !usageQ.data.constraints.length ? (
              <Text fontSize="sm" color="fg.muted" mb={3}>
                Only organization-wide limits apply across all farms. Pick a farm in the scope control to check farm-specific constraints.
              </Text>
            ) : null}
            {usageQ.data ? (
              <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={6}>
                <ConstraintBars results={usageQ.data.constraints} />
                <MetricGrid totals={usageQ.data.metrics} columns={{ base: 2, md: 3 }} />
              </SimpleGrid>
            ) : null}
          </CardBody>
        </Card>
      }
    >
      <DataTable
        rows={listQ.data?.results ?? []}
        rowKey={(c) => c.id}
        onRowClick={openEdit}
        emptyTitle="No constraints yet"
        emptyBody="Add an irrigation allocation, a labor ceiling, or a season budget. Hard limits block adoption; soft ones warn."
        columns={[
          { key: "label", header: "Resource", render: (c) => c.label ?? c.resource },
          { key: "limit", header: "Limit", render: fmtLimit },
          {
            key: "scope",
            header: "Applies to",
            render: (c) => [c.farm_name ?? "All farms", c.season_name ?? "All seasons"].join(" · "),
          },
          { key: "kind", header: "Kind", render: (c) => <Badge colorScheme={c.is_hard ? "red" : "yellow"} variant="subtle">{c.is_hard ? "Hard" : "Soft"}</Badge> },
          { key: "notes", header: "Notes", render: (c) => c.notes || "—" },
        ]}
      />

      <Drawer open={open} title={editing ? "Edit constraint" : "Add constraint"} onClose={() => setOpen(false)}>
        <ErrorBanner message={error} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <FormField label="Resource" htmlFor="k-res">
            <Select
              id="k-res"
              value={resource}
              onChange={(e) => {
                const r = e.target.value as ResourceKey;
                setResource(r);
                setUnit(RESOURCE_OPTIONS.find(([k]) => k === r)?.[1] ?? "");
              }}
            >
              {RESOURCE_OPTIONS.map(([k, u]) => (
                <option key={k} value={k}>
                  {labels.resource(k)} ({u})
                </option>
              ))}
            </Select>
          </FormField>
          <SimpleGrid columns={2} spacingX={4}>
            <FormField label="Limit" htmlFor="k-limit">
              <Input id="k-limit" type="number" step="0.01" isRequired value={limit} onChange={(e) => setLimit(e.target.value)} />
            </FormField>
            <FormField label="Unit" htmlFor="k-unit">
              <Input id="k-unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </FormField>
            <FormField label="Farm" htmlFor="k-farm" hint="Blank = organization-wide">
              <Select id="k-farm" value={farm} onChange={(e) => setFarm(e.target.value)}>
                <option value="">All farms</option>
                {(farmsQ.data?.results ?? []).map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Season" htmlFor="k-season" hint="Blank = every season">
              <Select id="k-season" value={season} onChange={(e) => setSeason(e.target.value)}>
                <option value="">All seasons</option>
                {(seasonsQ.data?.results ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </FormField>
          </SimpleGrid>
          <Flex align="center" gap={3} mb={4}>
            <Switch id="k-hard" isChecked={hard} onChange={(e) => setHard(e.target.checked)} colorScheme="red" />
            <Text as="label" htmlFor="k-hard" fontSize="sm">
              Hard limit — strategies that exceed it are infeasible and cannot be adopted without override
            </Text>
          </Flex>
          <FormField label="Notes" htmlFor="k-notes">
            <Textarea id="k-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </FormField>
          <Flex gap={2}>
            <Button type="submit" colorScheme="brand" isDisabled={save.isPending || !limit}>
              {save.isPending ? "Saving…" : editing ? "Save changes" : "Add constraint"}
            </Button>
            {editing ? (
              <Button variant="ghost" colorScheme="red" onClick={() => setConfirmDelete(editing)}>Delete</Button>
            ) : null}
          </Flex>
        </form>
      </Drawer>
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete constraint?"
        body="Strategies will be re-evaluated without it the next time they are opened."
        confirmLabel="Delete"
        danger
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove.mutate(confirmDelete.id)}
      />
    </ListPage>
  );
}
