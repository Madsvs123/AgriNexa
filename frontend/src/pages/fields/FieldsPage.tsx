import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Button, Text } from "@chakra-ui/react";
import { farmsApi, getApiError } from "@/api/client";
import { formatAcres } from "@/lib/utils";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatCard";
import { FilterBar, FilterSelect } from "@/components/ui/FilterBar";
import { ListPage } from "@/components/templates/ListPage";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { useDebounced } from "@/hooks/useDebounced";
import { useScope } from "@/hooks/useScope";

const SOIL_OPTIONS: Array<[string, string]> = [
  ["loam", "Loam"],
  ["clay_loam", "Clay loam"],
  ["sandy_loam", "Sandy loam"],
  ["silt_loam", "Silt loam"],
];

const DEFAULTS = { q: "", soil: "" };

export default function FieldsPage() {
  const navigate = useNavigate();
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
      title="Fields"
      subtitle="Soil, crop, acres, and moisture for every managed boundary."
      error={fieldsQ.error ? getApiError(fieldsQ.error) : null}
      loading={fieldsQ.isLoading}
      actions={
        <Button as={RouterLink} to="/fields/new" colorScheme="brand">
          Add field
        </Button>
      }
      filters={
        <FilterBar
          search={values.q}
          onSearchChange={(v) => setValue("q", v)}
          searchPlaceholder="Search South Bottom, NR-12…"
          searchLabel="Search fields"
          activeCount={activeCount}
          onReset={reset}
        >
          <FilterSelect
            value={values.soil}
            onChange={(v) => setValue("soil", v)}
            label="Soil type"
            allLabel="All soils"
            options={SOIL_OPTIONS}
          />
        </FilterBar>
      }
    >
      <DataTable
        rows={fieldsQ.data?.results ?? []}
        rowKey={(f) => f.id}
        onRowClick={(f) => navigate(`/fields/${f.id}`)}
        emptyTitle="No fields mapped"
        emptyBody="Draw a boundary on North 80 or import a shapefile via the field form."
        emptyAction={
          <Button as={RouterLink} to="/fields/new" colorScheme="brand">
            Add field
          </Button>
        }
        columns={[
          {
            key: "name",
            header: "Field",
            render: (f) => (
              <Text as="span" fontWeight="semibold">
                {f.name}
              </Text>
            ),
          },
          { key: "farm_name", header: "Farm", render: (f) => f.farm_name ?? "—" },
          { key: "soil_type", header: "Soil", render: (f) => f.soil_type || "—" },
          { key: "crop_name", header: "Crop", render: (f) => f.crop_name ?? "Fallow" },
          { key: "acres", header: "Acres", render: (f) => formatAcres(f.acres) },
          { key: "moisture", header: "Moisture", render: (f) => (f.moisture != null ? `${f.moisture}%` : "—") },
          { key: "health_status", header: "Health", render: (f) => <StatusBadge status={f.health_status} /> },
        ]}
      />
    </ListPage>
  );
}
