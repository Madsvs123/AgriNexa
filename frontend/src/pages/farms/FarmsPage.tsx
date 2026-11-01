import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
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
      title="Farms"
      subtitle="Every operated unit — codes, acres, and map position."
      error={farmsQ.error ? getApiError(farmsQ.error) : null}
      loading={farmsQ.isLoading}
      actions={
        <Button as={RouterLink} to="/farms/new" colorScheme="brand">
          Add farm
        </Button>
      }
      filters={
        <FilterBar
          search={values.q}
          onSearchChange={(v) => setValue("q", v)}
          searchPlaceholder="Search North Ridge, WR-02…"
          searchLabel="Search farms"
          activeCount={activeCount}
          onReset={reset}
        >
          <FilterSelect
            value={values.region}
            onChange={(v) => setValue("region", v)}
            label="Filter by region"
            allLabel="All regions"
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
          emptyTitle="No farms yet"
          emptyBody="Create North Ridge or Willow Creek to start mapping fields and sensors."
          emptyAction={
            <Button as={RouterLink} to="/farms/new" colorScheme="brand">
              Add farm
            </Button>
          }
          columns={[
            {
              key: "name",
              header: "Farm",
              render: (f) => (
                <Text as="span" fontWeight="semibold">
                  {f.name}
                </Text>
              ),
            },
            { key: "code", header: "Code" },
            { key: "total_acres", header: "Acres", render: (f) => formatAcres(f.total_acres) },
            { key: "field_count", header: "Fields", render: (f) => formatNumber(f.field_count) },
            { key: "address", header: "Address", render: (f) => f.address || "—" },
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
