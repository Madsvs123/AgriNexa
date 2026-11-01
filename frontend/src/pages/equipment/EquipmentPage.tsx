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
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("operate");
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
      title={t("equipment.title")}
      subtitle={t("equipment.subtitle")}
      error={listQ.error ? getApiError(listQ.error) : null}
      loading={listQ.isLoading}
      filters={
        <FilterBar
          search={values.q}
          onSearchChange={(v) => setValue("q", v)}
          searchPlaceholder={t("equipment.searchPlaceholder")}
          searchLabel={t("equipment.searchLabel")}
          activeCount={activeCount}
          onReset={reset}
        >
          <FilterSelect
            value={values.status}
            onChange={(v) => setValue("status", v)}
            label={t("labels.status", { ns: "common" })}
            allLabel={t("equipment.allStatuses")}
            options={STATUS_OPTIONS}
          />
          <FilterSelect
            value={values.type}
            onChange={(v) => setValue("type", v)}
            label={t("equipment.equipmentType")}
            allLabel={t("equipment.allTypes")}
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
