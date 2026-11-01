import { Link as RouterLink } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Card, CardBody, Flex, SimpleGrid, Spacer, Text } from "@chakra-ui/react";
import { equipmentApi, getApiError } from "@/api/client";
import { formatNumber, formatPct } from "@/lib/utils";
import { StatusBadge, EmptyState } from "@/components/ui/StatCard";
import { FilterBar, FilterSelect } from "@/components/ui/FilterBar";
import { ListPage } from "@/components/templates/ListPage";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { useDebounced } from "@/hooks/useDebounced";
import { useScope } from "@/hooks/useScope";

const STATUS_OPTIONS: Array<[string, string]> = [
  ["operational", "Operational"],
  ["maintenance", "Maintenance"],
  ["broken", "Broken"],
  ["retired", "Retired"],
];

const TYPE_OPTIONS: Array<[string, string]> = [
  ["tractor", "Tractor"],
  ["harvester", "Harvester"],
  ["sprayer", "Sprayer"],
  ["planter", "Planter"],
  ["irrigation_system", "Irrigation system"],
  ["drone", "Drone"],
  ["truck", "Truck"],
  ["other", "Other"],
];

const DEFAULTS = { q: "", status: "", type: "" };

export default function EquipmentPage() {
  const { params: scopeParams } = useScope();
  const { values, setValue, reset, activeCount, apiParams } = useUrlFilters(DEFAULTS);
  const debouncedQ = useDebounced(values.q, 250);

  const listQ = useQuery({
    queryKey: ["equipment", { ...apiParams, q: debouncedQ }, scopeParams],
    queryFn: () =>
      equipmentApi.list({
        ...scopeParams,
        search: debouncedQ || undefined,
        status: values.status || undefined,
        equipment_type: values.type || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const rows = listQ.data?.results ?? [];

  return (
    <ListPage
      title="Equipment"
      subtitle="Fleet hours, fuel, and readiness."
      error={listQ.error ? getApiError(listQ.error) : null}
      loading={listQ.isLoading}
      filters={
        <FilterBar
          search={values.q}
          onSearchChange={(v) => setValue("q", v)}
          searchPlaceholder="Search Planter 12, serial…"
          searchLabel="Search equipment"
          activeCount={activeCount}
          onReset={reset}
        >
          <FilterSelect
            value={values.status}
            onChange={(v) => setValue("status", v)}
            label="Status"
            allLabel="All statuses"
            options={STATUS_OPTIONS}
          />
          <FilterSelect
            value={values.type}
            onChange={(v) => setValue("type", v)}
            label="Equipment type"
            allLabel="All types"
            options={TYPE_OPTIONS}
          />
        </FilterBar>
      }
    >
      {rows.length === 0 ? (
        <Card variant="surface">
          <EmptyState
            title={activeCount ? "No machines match these filters" : "No machines yet"}
            body={
              activeCount
                ? "Clear the filters to see the whole fleet."
                : "Add Planter 12, the 8R, or the tender truck to track hours and fuel."
            }
          />
        </Card>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4}>
          {rows.map((e) => (
            <Card
              key={e.id}
              as={RouterLink}
              to={`/equipment/${e.id}`}
              variant="surface"
              _hover={{ borderColor: "brand.300", textDecoration: "none" }}
              transition="border-color 0.15s"
            >
              <CardBody>
                <Flex align="center" gap={2}>
                  <Text as="strong">{e.name}</Text>
                  <Spacer />
                  <StatusBadge status={e.status} />
                </Flex>
                <Text color="fg.muted" fontSize="sm">
                  {e.year ?? ""} {e.make} {e.model} · {e.farm_name}
                </Text>
                <Text mt={2}>{formatNumber(e.hours)} hours</Text>
                <Text color="fg.muted" fontSize="sm">
                  Fuel {formatPct(e.fuel_level)}
                </Text>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </ListPage>
  );
}
