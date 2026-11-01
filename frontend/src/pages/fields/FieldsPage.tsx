import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, Text } from "@chakra-ui/react";
import { farmsApi, getApiError } from "@/api/client";
import { formatAcres } from "@/lib/utils";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatCard";
import { FilterBar, FilterSelect } from "@/components/ui/FilterBar";
import { SOIL_OPTIONS } from "@/lib/planning";
import { usePlanningLabels } from "@/lib/usePlanningLabels";
import { ListPage } from "@/components/templates/ListPage";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { useDebounced } from "@/hooks/useDebounced";
import { useScope } from "@/hooks/useScope";

const DEFAULTS = { q: "", soil: "" };

export default function FieldsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("land");
  const labels = usePlanningLabels();
  const { params: scopeParams } = useScope();
  const { values, setValue, reset, activeCount, apiParams } = useUrlFilters(DEFAULTS);
  const debouncedQ = useDebounced(values.q, 250);

  const fieldsQ = useQuery({
    queryKey: ["fields", { ...apiParams, q: debouncedQ }, scopeParams],
    queryFn: () =>
      farmsApi.fields({
        ...scopeParams,
        search: debouncedQ || undefined,
        soil_type: values.soil || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <ListPage
      title={t("fields.title")}
      subtitle={t("fields.subtitle")}
      error={fieldsQ.error ? getApiError(fieldsQ.error) : null}
      loading={fieldsQ.isLoading}
      actions={
        <Button as={RouterLink} to="/fields/new" colorScheme="brand">
          {t("fields.addField")}
        </Button>
      }
      filters={
        <FilterBar
          search={values.q}
          onSearchChange={(v) => setValue("q", v)}
          searchPlaceholder={t("fields.searchPlaceholder")}
          searchLabel={t("fields.searchLabel")}
          activeCount={activeCount}
          onReset={reset}
        >
          <FilterSelect
            value={values.soil}
            onChange={(v) => setValue("soil", v)}
            label={t("fields.soilType")}
            allLabel={t("fields.allSoils")}
            options={SOIL_OPTIONS.map((v) => [v, labels.soil(v)] as [string, string])}
          />
        </FilterBar>
      }
    >
      <DataTable
        rows={fieldsQ.data?.results ?? []}
        rowKey={(f) => f.id}
        onRowClick={(f) => navigate(`/fields/${f.id}`)}
        emptyTitle={t("fields.emptyTitle")}
        emptyBody={t("fields.emptyBody")}
        emptyAction={
          <Button as={RouterLink} to="/fields/new" colorScheme="brand">
            {t("fields.addField")}
          </Button>
        }
        columns={[
          {
            key: "name",
            header: t("fields.columns.field"),
            render: (f) => (
              <Text as="span" fontWeight="semibold">
                {f.name}
              </Text>
            ),
          },
          { key: "farm_name", header: t("fields.columns.farm"), render: (f) => f.farm_name ?? "—" },
          { key: "soil_type", header: t("fields.columns.soil"), render: (f) => (f.soil_type ? labels.soil(f.soil_type) : "—") },
          { key: "crop_name", header: t("fields.columns.crop"), render: (f) => f.crop_name ?? t("fields.fallow") },
          { key: "acres", header: t("fields.columns.acres"), render: (f) => formatAcres(f.acres) },
          { key: "moisture", header: t("fields.columns.moisture"), render: (f) => (f.moisture != null ? `${f.moisture}%` : "—") },
          { key: "health_status", header: t("fields.columns.health"), render: (f) => <StatusBadge status={f.health_status} /> },
        ]}
      />
    </ListPage>
  );
}
