import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Box, Button, Divider, Flex, Select, Stack, Text } from "@chakra-ui/react";
import { equipmentApi, farmsApi, irrigationApi, platformApi, sensorsApi } from "@/api/client";
import { formatAcres } from "@/lib/utils";
import { LayerToggle } from "@/components/ui/SensorSparkline";
import { MapView } from "@/components/ui/MapView";
import { StatusBadge } from "@/components/ui/StatCard";
import { WorkspacePage } from "@/components/templates/WorkspacePage";
import { ContextPanel } from "@/components/layout/ContextPanel";
import { useScope } from "@/hooks/useScope";
import { useSensorSocket } from "@/hooks/useSensorSocket";
import type { Field } from "@/types";

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box px={3} py={3}>
      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wider" color="fg.muted" mb={2}>
        {title}
      </Text>
      {children}
    </Box>
  );
}

/**
 * Farm map.
 *
 * Layers, legend, and summaries moved off the canvas into a docked tool panel —
 * they previously stacked as up to five floating cards over the map, and used a
 * raw z-index that painted them over the sticky header. The clicked-field
 * inspector is a docked context panel on wide screens so the map stays visible.
 */
export default function MapPage() {
  const { t } = useTranslation("land");
  const { farmId, setFarmId } = useScope();
  const farmsQ = useQuery({ queryKey: ["farms"], queryFn: () => farmsApi.list() });

  // Fall back to the first farm until the user picks one, and write that back
  // to global scope so other pages inherit the same context.
  const selectedFarm = farmId || farmsQ.data?.results[0]?.id || "";
  useSensorSocket(selectedFarm);

  const farmParam = selectedFarm || undefined;
  const fieldsQ = useQuery({
    queryKey: ["fields", { farm: selectedFarm }],
    queryFn: () => farmsApi.fields({ farm: farmParam }),
  });
  const sensorsQ = useQuery({
    queryKey: ["sensors", { farm: selectedFarm }],
    queryFn: () => sensorsApi.list({ farm: farmParam }),
  });
  const zonesQ = useQuery({
    queryKey: ["irrigation-zones", { farm: selectedFarm }],
    queryFn: () => irrigationApi.zones({ farm: farmParam }),
  });
  const equipQ = useQuery({
    queryKey: ["equipment", { farm: selectedFarm }],
    queryFn: () => equipmentApi.list({ farm: farmParam }),
  });
  const alertsQ = useQuery({ queryKey: ["notifications"], queryFn: () => platformApi.notifications() });
  const plotsQ = useQuery({
    queryKey: ["plots", { farm: selectedFarm }],
    queryFn: () => farmsApi.plots({ farm: farmParam }),
  });
  const soilQ = useQuery({
    queryKey: ["soil-layers", { farm: selectedFarm }],
    queryFn: () => farmsApi.soilLayers({ farm: farmParam }),
  });

  const [layers, setLayers] = useState({
    fields: true,
    sensors: true,
    irrigation: true,
    equipment: true,
    plots: true,
    soil: false,
    alerts: true,
    history: false,
  });
  const [picked, setPicked] = useState<Field | null>(null);
  const farm = farmsQ.data?.results.find((f) => f.id === selectedFarm);

  const alertSensors = useMemo(
    () => (sensorsQ.data?.results ?? []).filter((s) => s.status === "warning" || s.status === "critical"),
    [sensorsQ.data],
  );

  const tools = (
    <Stack spacing={0} divider={<Divider />}>
      <PanelSection title={t("map.farm")}>
        <Select
          size="sm"
          aria-label={t("map.farm")}
          value={selectedFarm}
          onChange={(e) => setFarmId(e.target.value || null)}
        >
          {(farmsQ.data?.results ?? []).map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
        {farm ? (
          <Text fontSize="sm" color="fg.muted" mt={2}>
            {t("map.farmSummary", {
              acres: formatAcres(farm.total_acres),
              count: fieldsQ.data?.count ?? 0,
            })}
          </Text>
        ) : null}
      </PanelSection>

      <PanelSection title={t("map.layers")}>
        <LayerToggle
          layers={[
            { key: "fields", label: t("map.layerNames.fields"), on: layers.fields },
            { key: "sensors", label: t("map.layerNames.sensors"), on: layers.sensors },
            { key: "irrigation", label: t("map.layerNames.irrigation"), on: layers.irrigation },
            { key: "plots", label: t("map.layerNames.plots"), on: layers.plots },
            { key: "soil", label: t("map.layerNames.soil"), on: layers.soil },
            { key: "equipment", label: t("map.layerNames.equipment"), on: layers.equipment },
            { key: "alerts", label: t("map.layerNames.alerts"), on: layers.alerts },
            { key: "history", label: t("map.layerNames.history"), on: layers.history },
          ]}
          onChange={(key, on) => setLayers((l) => ({ ...l, [key]: on }))}
        />
      </PanelSection>

      <PanelSection title={t("map.legend")}>
        <Stack spacing={1.5} fontSize="sm">
          <Flex align="center" gap={2}>
            <Box boxSize="10px" borderRadius="sm" bg="#7CB518" />{t("map.healthy")}</Flex>
          <Flex align="center" gap={2}>
            <Box boxSize="10px" borderRadius="sm" bg="#D4A017" />{t("map.warning")}</Flex>
          <Flex align="center" gap={2}>
            <Box boxSize="10px" borderRadius="sm" bg="#B42318" />{t("map.critical")}</Flex>
        </Stack>
      </PanelSection>

      {layers.irrigation && (zonesQ.data?.results ?? []).length ? (
        <PanelSection title={t("map.zones")}>
          <Stack spacing={1.5}>
            {(zonesQ.data?.results ?? []).slice(0, 6).map((z) => (
              <Flex key={z.id} align="center" gap={2} fontSize="sm">
                <StatusBadge status={z.status} />
                <Text as="span" noOfLines={1}>
                  {z.name}
                </Text>
              </Flex>
            ))}
          </Stack>
        </PanelSection>
      ) : null}

      {layers.alerts ? (
        <PanelSection title={t("map.alerts")}>
          <Stack spacing={1.5} fontSize="sm" color="fg.muted">
            {alertSensors.slice(0, 4).map((s) => (
              <Text key={s.id} noOfLines={1}>
                {s.name} · {s.status}
              </Text>
            ))}
            {(alertsQ.data?.results ?? []).slice(0, 3).map((n) => (
              <Text key={n.id} noOfLines={1}>
                {n.title}
              </Text>
            ))}
            {!alertSensors.length && !(alertsQ.data?.results ?? []).length ? (
              <Text>{t("map.nothingFlagged")}</Text>
            ) : null}
          </Stack>
        </PanelSection>
      ) : null}
    </Stack>
  );

  const inspector = (
    <ContextPanel open={!!picked} title={picked?.name ?? "Field"} onClose={() => setPicked(null)}>
      {picked ? (
        <Stack spacing={3} align="flex-start">
          <Text color="fg.muted">
            {picked.crop_name ?? t("map.fallow")} · {formatAcres(picked.acres)}
          </Text>
          <Flex align="center" gap={2}>
            <StatusBadge status={picked.health_status} />
            <Text as="span">
              {picked.moisture != null ? t("map.moisture", { value: picked.moisture }) : t("map.noProbe")}
            </Text>
          </Flex>
          <Text fontSize="sm" color="fg.muted">
            {picked.soil_type || t("map.soilUnknown")} · {picked.farm_name ?? farm?.name}
          </Text>
          <Button as={RouterLink} to={`/fields/${picked.id}`} colorScheme="brand" size="sm">
            {t("map.openFieldRecord")}
          </Button>
        </Stack>
      ) : null}
    </ContextPanel>
  );

  return (
    <WorkspacePage title={t("map.title")} tools={tools} inspector={inspector}>
      <MapView
        height="100%"
        fields={layers.fields || layers.history ? fieldsQ.data?.results ?? [] : []}
        sensors={layers.sensors ? sensorsQ.data?.results ?? [] : []}
        equipment={layers.equipment ? equipQ.data?.results ?? [] : []}
        zones={layers.irrigation ? zonesQ.data?.results ?? [] : []}
        plots={layers.plots ? plotsQ.data?.results ?? [] : []}
        soilLayers={layers.soil ? soilQ.data?.results ?? [] : []}
        showFields={layers.fields}
        showSensors={layers.sensors}
        showEquipment={layers.equipment}
        showZones={layers.irrigation}
        showPlots={layers.plots}
        showSoil={layers.soil}
        onFieldClick={setPicked}
        center={farm?.lat && farm?.lng ? [Number(farm.lat), Number(farm.lng)] : undefined}
      />
    </WorkspacePage>
  );
}
