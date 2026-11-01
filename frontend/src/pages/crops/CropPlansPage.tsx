import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePlanningLabels } from "@/lib/usePlanningLabels";
import { Badge, Button, Flex, Text } from "@chakra-ui/react";
import { cropsApi, getApiError } from "@/api/client";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatCard";
import { FilterBar, FilterSelect } from "@/components/ui/FilterBar";
import { ListPage } from "@/components/templates/ListPage";
import { CropChip } from "@/components/planning/CropChip";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { useScope } from "@/hooks/useScope";
import { PLANTING_SYSTEMS } from "@/lib/planning";
import { formatAcres, formatDate } from "@/lib/utils";
import { PlanComposer } from "./plans/PlanComposer";

const STATUS = ["planned", "planted", "growing", "harvested", "cancelled"] as const;
const DEFAULTS = { status: "", system: "", crop: "" };

export default function CropPlansPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("grow");
  const labels = usePlanningLabels();
  const { params: scopeParams, farmId, seasonId } = useScope();
  const { values, setValue, reset, activeCount, apiParams } = useUrlFilters(DEFAULTS);
  const [composer, setComposer] = useState(false);

  const plansQ = useQuery({
    queryKey: ["crop-plans", apiParams, scopeParams],
    queryFn: () =>
      cropsApi.plans({
        ...(scopeParams.farm ? { farm: scopeParams.farm } : {}),
        ...(scopeParams.season_id ? { season: scopeParams.season_id } : {}),
        status: values.status || undefined,
        planting_system: values.system || undefined,
        crop: values.crop || undefined,
      }),
    placeholderData: keepPreviousData,
  });
  const cropsQ = useQuery({ queryKey: ["crops"], queryFn: () => cropsApi.crops() });

  return (
    <ListPage
      title={t("plans.title")}
      subtitle={t("plans.subtitle")}
      error={plansQ.error ? getApiError(plansQ.error) : null}
      loading={plansQ.isLoading}
      actions={
        <Button colorScheme="brand" onClick={() => setComposer(true)}>
          {t("plans.newPlan")}
        </Button>
      }
      filters={
        <FilterBar activeCount={activeCount} onReset={reset}>
          <FilterSelect value={values.status} onChange={(v) => setValue("status", v)} label={t("plans.status")} allLabel={t("plans.allStatuses")} options={STATUS.map((v) => [v, labels.planStatus(v)] as [string, string])} />
          <FilterSelect
            value={values.system}
            onChange={(v) => setValue("system", v)}
            label={t("plans.plantingSystem")}
            allLabel={t("plans.allSystems")}
            options={PLANTING_SYSTEMS.map((v) => [v, labels.plantingSystem(v)] as [string, string])}
          />
          <FilterSelect
            value={values.crop}
            onChange={(v) => setValue("crop", v)}
            label={t("plans.crop")}
            allLabel={t("plans.allCrops")}
            options={(cropsQ.data?.results ?? []).map((c) => [c.id, c.name] as [string, string])}
          />
        </FilterBar>
      }
    >
      <DataTable
        rows={plansQ.data?.results ?? []}
        rowKey={(p) => p.id}
        onRowClick={(p) => navigate(`/crops/plans/${p.id}`)}
        emptyTitle={t("plans.emptyTitle")}
        emptyBody={t("plans.emptyBody")}
        emptyAction={
          <Button colorScheme="brand" onClick={() => setComposer(true)}>
            {t("plans.newPlan")}
          </Button>
        }
        columns={[
          {
            key: "crop",
            header: t("plans.columns.crop"),
            render: (p) => (
              <Flex direction="column" gap={1}>
                <CropChip name={p.crop_name ?? "Crop"} color={p.crop_color} detail={p.variety_name} />
                {p.components?.length ? (
                  <Flex gap={1} wrap="wrap">
                    {p.components.map((c) => (
                      <Badge key={c.id} variant="outline" colorScheme="gray" fontSize="10px" textTransform="none">
                        + {c.crop_name} {c.share_pct}%
                      </Badge>
                    ))}
                  </Flex>
                ) : null}
              </Flex>
            ),
          },
          { key: "field_name", header: t("plans.columns.field"), render: (p) => `${p.field_name ?? "—"}${p.farm_name ? ` · ${p.farm_name}` : ""}` },
          { key: "season_name", header: t("plans.columns.season"), render: (p) => p.season_name ?? "—" },
          {
            key: "planting_system",
            header: t("plans.columns.system"),
            render: (p) => (
              <Badge variant="subtle" colorScheme={p.planting_system === "monoculture" ? "gray" : "brand"}>
                {labels.plantingSystem(p.planting_system)}
              </Badge>
            ),
          },
          { key: "acres", header: t("plans.columns.acres"), render: (p) => formatAcres(p.effective_acres) },
          { key: "planting_date", header: t("plans.columns.plant"), render: (p) => formatDate(p.planting_date) },
          { key: "expected_harvest_date", header: t("plans.columns.harvest"), render: (p) => formatDate(p.expected_harvest_date) },
          {
            key: "status",
            header: t("plans.columns.status"),
            render: (p) => (
              <Flex align="center" gap={2}>
                <StatusBadge status={p.status} />
                {p.strategy_name ? (
                  <Text as="span" fontSize="xs" color="fg.muted" noOfLines={1}>
                    {t("plans.viaStrategy", { name: p.strategy_name })}
                  </Text>
                ) : null}
              </Flex>
            ),
          },
        ]}
      />
      <PlanComposer open={composer} onClose={() => setComposer(false)} defaultSeason={seasonId} defaultFarm={farmId} />
    </ListPage>
  );
}
