import { Link as RouterLink, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, Card, CardBody, Heading, SimpleGrid, Text } from "@chakra-ui/react";
import { farmsApi, getApiError, sensorsApi } from "@/api/client";
import { formatAcres, formatDate } from "@/lib/utils";
import { StatusBadge, StatCard } from "@/components/ui/StatCard";
import { MapView } from "@/components/ui/MapView";
import { DetailPage } from "@/components/templates/DetailPage";
import { PlotsTab } from "./tabs/PlotsTab";
import { SoilTab } from "./tabs/SoilTab";
import { AgronomyTab } from "./tabs/AgronomyTab";
import { NotesTab } from "./tabs/NotesTab";
import { useTranslation } from "react-i18next";
import { usePlanningLabels } from "@/lib/usePlanningLabels";

function OverviewTab({ fieldId }: { fieldId: string }) {
  const { t } = useTranslation("land");
  const labels = usePlanningLabels();
  const fieldQ = useQuery({ queryKey: ["field", fieldId], queryFn: () => farmsApi.getField(fieldId) });
  const sensorsQ = useQuery({
    queryKey: ["sensors", { field: fieldId }],
    queryFn: () => sensorsApi.list({ field: fieldId }),
  });
  const plotsQ = useQuery({ queryKey: ["plots", { field: fieldId }], queryFn: () => farmsApi.plots({ field: fieldId }) });
  const soilQ = useQuery({
    queryKey: ["soil-layers", { field: fieldId }],
    queryFn: () => farmsApi.soilLayers({ field: fieldId }),
  });
  const field = fieldQ.data;
  if (!field) return null;

  return (
    <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
      <Box
        bg="bg.surface"
        borderWidth="1px"
        borderColor="border.default"
        borderRadius="xl"
        minH="320px"
        overflow="hidden"
      >
        <MapView
          height="320px"
          fields={[field]}
          sensors={sensorsQ.data?.results ?? []}
          plots={plotsQ.data?.results ?? []}
          soilLayers={soilQ.data?.results ?? []}
          showSoil
        />
      </Box>
      <Card variant="surface">
        <CardBody>
          <Heading size="sm" mb={2}>
            {t("fieldDetail.plantingWindow")}
          </Heading>
          <Text>{t("fieldDetail.planted", { date: formatDate(field.planting_date) })}</Text>
          <Text>{t("fieldDetail.expectedHarvest", { date: formatDate(field.harvest_date) })}</Text>
          <Text color="fg.muted" mt={2}>
            {t("fieldDetail.cropPlanHint")}
          </Text>
          <Heading size="sm" mt={5} mb={2}>
            {t("labels.soil", { ns: "common" })}
          </Heading>
          <Text color="fg.muted">{field.soil_type ? labels.soil(field.soil_type) : t("fieldDetail.soilUnknown")}</Text>
        </CardBody>
      </Card>
    </SimpleGrid>
  );
}

/**
 * Field record.
 *
 * Was a 522-line page that fired eight queries on mount and stacked every
 * section in one scroll. Each concern is now a lazily-mounted tab, so opening a
 * field loads the map and planting window rather than plots, soil layers, an
 * elevation estimate, history, zones, sensors, and notes all at once.
 */
export default function FieldDetailPage() {
  const { t } = useTranslation("land");
  const labels = usePlanningLabels();
  const { id = "" } = useParams();
  const fieldQ = useQuery({
    queryKey: ["field", id],
    queryFn: () => farmsApi.getField(id),
    enabled: !!id,
  });
  const field = fieldQ.data;

  return (
    <DetailPage
      loading={fieldQ.isLoading}
      error={fieldQ.error ? getApiError(fieldQ.error) : !field && !fieldQ.isLoading ? t("fieldDetail.notFound") : null}
      title={field?.name ?? "Field"}
      subtitle={field ? `${field.farm_name ?? ""} · ${field.soil_type ? labels.soil(field.soil_type) : t("fieldDetail.soilUnknown")}` : undefined}
      actions={
        field ? (
          <>
            <Button as={RouterLink} to={`/fields/${field.id}/edit`} variant="ghost" colorScheme="gray" size="sm">
              {t("fieldDetail.editField")}
            </Button>
            <Button as={RouterLink} to={`/farms/${field.farm}`} variant="outline" colorScheme="gray" size="sm">
              {t("fieldDetail.openFarm")}
            </Button>
          </>
        ) : null
      }
      kpis={
        field
          ? [
              <StatCard key="acres" label={t("labels.acres", { ns: "common" })} value={formatAcres(field.acres)} />,
              <StatCard key="crop" label={t("labels.crop", { ns: "common" })} value={field.crop_name ?? "Fallow"} />,
              <StatCard
                key="moisture"
                label={t("fieldDetail.moisture")}
                value={field.moisture != null ? `${field.moisture}%` : "—"}
              />,
              <StatCard key="health" label={t("fieldDetail.health")} value={<StatusBadge status={field.health_status} />} />,
            ]
          : undefined
      }
      tabs={
        field
          ? [
              { id: "overview", label: t("fieldDetail.tabs.overview"), render: () => <OverviewTab fieldId={field.id} /> },
              { id: "plots", label: t("fieldDetail.tabs.plots"), render: () => <PlotsTab field={field} /> },
              { id: "soil", label: t("fieldDetail.tabs.soil"), render: () => <SoilTab field={field} /> },
              { id: "agronomy", label: t("fieldDetail.tabs.agronomy"), render: () => <AgronomyTab fieldId={field.id} /> },
              { id: "notes", label: t("fieldDetail.tabs.notes"), render: () => <NotesTab fieldId={field.id} /> },
            ]
          : []
      }
    />
  );
}
