import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Box, Button, SimpleGrid, Text } from "@chakra-ui/react";
import { farmsApi, getApiError } from "@/api/client";
import { formatAcres, formatNumber } from "@/lib/utils";
import { DataTable } from "@/components/ui/DataTable";
import { FilterBar, FilterSelect } from "@/components/ui/FilterBar";
import { MapView } from "@/components/ui/MapView";
import { ListPage } from "@/components/templates/ListPage";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { useDebounced } from "@/hooks/useDebounced";

const DEFAULTS = { q: "", region: "" };

export default function FarmsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("land");
  const { values, setValue, reset, activeCount, apiParams } = useUrlFilters(DEFAULTS);
  const debouncedQ = useDebounced(values.q, 250);

  const farmsQ = useQuery({
    queryKey: ["farms", { ...apiParams, q: debouncedQ }],
    queryFn: () =>
      farmsApi.list({ search: debouncedQ || undefined, region: values.region || undefined }),
    placeholderData: keepPreviousData,
  });
  const regionsQ = useQuery({ queryKey: ["regions"], queryFn: () => farmsApi.regions() });
  const fieldsQ = useQuery({ queryKey: ["fields"], queryFn: () => farmsApi.fields() });
  const farms = farmsQ.data?.results ?? [];

  return (
    <ListPage
      title={t("farms.title")}
      subtitle={t("farms.subtitle")}
      error={farmsQ.error ? getApiError(farmsQ.error) : null}
      loading={farmsQ.isLoading}
      actions={
        <Button as={RouterLink} to="/farms/new" colorScheme="brand">
          {t("farms.addFarm")}
        </Button>
      }
      filters={
        <FilterBar
          search={values.q}
          onSearchChange={(v) => setValue("q", v)}
          searchPlaceholder={t("farms.searchPlaceholder")}
          searchLabel={t("farms.searchLabel")}
          activeCount={activeCount}
          onReset={reset}
        >
          <FilterSelect
            value={values.region}
            onChange={(v) => setValue("region", v)}
            label={t("farms.filterByRegion")}
            allLabel={t("farms.allRegions")}
            options={(regionsQ.data?.results ?? []).map((r) => [r.id, r.name] as [string, string])}
          />
        </FilterBar>
      }
    >
      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
        <DataTable
          rows={farms}
          rowKey={(f) => f.id}
          onRowClick={(f) => navigate(`/farms/${f.id}`)}
          emptyTitle={t("farms.emptyTitle")}
          emptyBody={t("farms.emptyBody")}
          emptyAction={
            <Button as={RouterLink} to="/farms/new" colorScheme="brand">
              {t("farms.addFarm")}
            </Button>
          }
          columns={[
            {
              key: "name",
              header: t("farms.columns.farm"),
              render: (f) => (
                <Text as="span" fontWeight="semibold">
                  {f.name}
                </Text>
              ),
            },
            { key: "code", header: t("farms.columns.code") },
            { key: "total_acres", header: t("farms.columns.acres"), render: (f) => formatAcres(f.total_acres) },
            { key: "field_count", header: t("farms.columns.fields"), render: (f) => formatNumber(f.field_count) },
            { key: "address", header: t("farms.columns.address"), render: (f) => f.address || "—" },
          ]}
        />
        <Box
          bg="bg.surface"
          borderWidth="1px"
          borderColor="border.default"
          borderRadius="xl"
          minH="360px"
          overflow="hidden"
          display={{ base: "none", xl: "block" }}
        >
          <MapView
            height="420px"
            fields={fieldsQ.data?.results ?? []}
            center={farms[0]?.lat && farms[0]?.lng ? [farms[0].lat, farms[0].lng] : undefined}
          />
        </Box>
      </SimpleGrid>
    </ListPage>
  );
}
