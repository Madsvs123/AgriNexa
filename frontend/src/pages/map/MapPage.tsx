import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, Flex, Select, Stack, Text } from "@chakra-ui/react";
import { equipmentApi, farmsApi, irrigationApi, platformApi, sensorsApi } from "@/api/client";
import { formatAcres } from "@/lib/utils";
import { Drawer } from "@/components/ui/Modal";
import { LayerToggle } from "@/components/ui/SensorSparkline";
import { MapView } from "@/components/ui/MapView";
import { StatusBadge } from "@/components/ui/StatCard";
import { useSensorSocket } from "@/hooks/useSensorSocket";
import type { Field } from "@/types";

const panelProps = {
  bg: "bg.surface",
  borderWidth: "1px",
  borderColor: "border.default",
  borderRadius: "lg",
  boxShadow: "md",
  p: 3,
} as const;

export default function MapPage() {
  const farmsQ = useQuery({ queryKey: ["farms"], queryFn: () => farmsApi.list() });
  const [farmId, setFarmId] = useState<string>("");
  const selectedFarm = farmId || farmsQ.data?.results[0]?.id || "";
  useSensorSocket(selectedFarm);
  const fieldsQ = useQuery({
    queryKey: ["fields", { farm: selectedFarm }],
    queryFn: () => farmsApi.fields({ farm: selectedFarm || undefined }),
  });
  const sensorsQ = useQuery({ queryKey: ["sensors", { farm: selectedFarm }], queryFn: () => sensorsApi.list({ farm: selectedFarm || undefined }) });
  const zonesQ = useQuery({ queryKey: ["irrigation-zones", { farm: selectedFarm }], queryFn: () => irrigationApi.zones({ farm: selectedFarm || undefined }) });
  const equipQ = useQuery({ queryKey: ["equipment", { farm: selectedFarm }], queryFn: () => equipmentApi.list({ farm: selectedFarm || undefined }) });
  const alertsQ = useQuery({ queryKey: ["notifications"], queryFn: () => platformApi.notifications() });
  const [layers, setLayers] = useState({
    fields: true,
    sensors: true,
    irrigation: true,
    equipment: true,
    alerts: true,
    history: false,
  });
  const [picked, setPicked] = useState<Field | null>(null);
  const farm = farmsQ.data?.results.find((f) => f.id === selectedFarm);

  const alertSensors = useMemo(
    () => (sensorsQ.data?.results ?? []).filter((s) => s.status === "warning" || s.status === "critical"),
    [sensorsQ.data],
  );

  return (
    <Box>
      <Box
        position="relative"
        h={{ base: "calc(100vh - 120px)", md: "calc(100vh - 140px)" }}
        minH="420px"
        borderWidth="1px"
        borderColor="border.default"
        borderRadius="xl"
        overflow="hidden"
      >
        <MapView
          height="100%"
          fields={layers.fields || layers.history ? fieldsQ.data?.results ?? [] : []}
          sensors={layers.sensors ? sensorsQ.data?.results ?? [] : []}
          equipment={layers.equipment ? equipQ.data?.results ?? [] : []}
          zones={layers.irrigation ? zonesQ.data?.results ?? [] : []}
          showFields={layers.fields}
          showSensors={layers.sensors}
          showEquipment={layers.equipment}
          showZones={layers.irrigation}
          onFieldClick={setPicked}
          center={farm?.lat && farm?.lng ? [Number(farm.lat), Number(farm.lng)] : undefined}
        />
        <Stack
          position="absolute"
          top={3}
          right={3}
          zIndex={1000}
          spacing={3}
          w="260px"
          maxH="calc(100% - 24px)"
          overflowY="auto"
        >
          <Box {...panelProps}>
            <Text as="label" htmlFor="map-farm" fontWeight="semibold" fontSize="sm" display="block" mb={1}>
              Farm
            </Text>
            <Select id="map-farm" value={selectedFarm} onChange={(e) => setFarmId(e.target.value)}>
              {(farmsQ.data?.results ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Box>
          <LayerToggle
            layers={[
              { key: "fields", label: "Field boundaries", on: layers.fields },
              { key: "sensors", label: "Sensors", on: layers.sensors },
              { key: "irrigation", label: "Irrigation zones", on: layers.irrigation },
              { key: "equipment", label: "Equipment", on: layers.equipment },
              { key: "alerts", label: "Alerts", on: layers.alerts },
              { key: "history", label: "Historical activity", on: layers.history },
            ]}
            onChange={(key, on) => setLayers((l) => ({ ...l, [key]: on }))}
          />
          <Flex {...panelProps} gap={3} wrap="wrap" fontSize="sm">
            <Flex align="center" gap={1.5}>
              <Box boxSize="10px" borderRadius="sm" bg="#7CB518" /> Healthy
            </Flex>
            <Flex align="center" gap={1.5}>
              <Box boxSize="10px" borderRadius="sm" bg="#D4A017" /> Warning
            </Flex>
            <Flex align="center" gap={1.5}>
              <Box boxSize="10px" borderRadius="sm" bg="#B42318" /> Critical
            </Flex>
          </Flex>
          {layers.irrigation ? (
            <Box {...panelProps}>
              <Text as="span" fontWeight="semibold">
                Zones
              </Text>
              {(zonesQ.data?.results ?? []).slice(0, 6).map((z) => (
                <Flex key={z.id} align="center" gap={2} mt={1.5}>
                  <StatusBadge status={z.status} />
                  <Text as="span">{z.name}</Text>
                </Flex>
              ))}
            </Box>
          ) : null}
          {layers.alerts ? (
            <Box {...panelProps}>
              <Text as="span" fontWeight="semibold">
                Alerts
              </Text>
              {alertSensors.slice(0, 4).map((s) => (
                <Text key={s.id} color="fg.muted" mt={1.5}>
                  {s.name} · {s.status}
                </Text>
              ))}
              {(alertsQ.data?.results ?? []).slice(0, 3).map((n) => (
                <Text key={n.id} color="fg.muted" mt={1.5}>
                  {n.title}
                </Text>
              ))}
            </Box>
          ) : null}
        </Stack>
      </Box>
      <Drawer open={!!picked} title={picked?.name ?? "Field"} onClose={() => setPicked(null)}>
        {picked ? (
          <>
            <Text color="fg.muted">
              {picked.crop_name ?? "Fallow"} · {formatAcres(picked.acres)}
            </Text>
            <Flex align="center" gap={2} my={3}>
              <StatusBadge status={picked.health_status} />
              <Text as="span">{picked.moisture != null ? `${picked.moisture}% moisture` : "No probe"}</Text>
            </Flex>
            <Button as={RouterLink} to={`/fields/${picked.id}`} colorScheme="brand">
              Open field record
            </Button>
          </>
        ) : null}
      </Drawer>
    </Box>
  );
}
