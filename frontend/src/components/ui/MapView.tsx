import { useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, Marker, Popup, ScaleControl, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Box, Button, HStack, IconButton } from "@chakra-ui/react";
import { Crosshair } from "lucide-react";
import type { Equipment, Field, GeoJSONPolygon, IrrigationZone, Plot, Sensor, SoilLayer, StatusLevel } from "@/types";
import { healthColor } from "@/lib/utils";

export const SOIL_COLORS: Record<string, string> = {
  clay: "#8C5A3C",
  clay_loam: "#A66A3A",
  loam: "#B98A2F",
  silt_loam: "#C9A227",
  silt: "#D9C06B",
  sandy_loam: "#D9B380",
  sand: "#E8CFA0",
  peat: "#4E3B2B",
  chalk: "#CFCFC4",
};

function divIcon(color: string, size = 14) {
  return L.divIcon({
    className: "",
    html: `<span class="marker-dot" style="background:${color};width:${size}px;height:${size}px;display:block"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function collectBounds(
  fields: Field[],
  points: { lat: number; lng: number }[],
  extras: GeoJSONPolygon[],
): L.LatLngBounds {
  const bounds = L.latLngBounds([]);
  for (const f of fields) {
    const coords = f.boundary?.coordinates?.[0];
    if (!coords) continue;
    for (const [lng, lat] of coords) bounds.extend([lat, lng]);
  }
  for (const poly of extras) {
    for (const [lng, lat] of poly.coordinates?.[0] ?? []) bounds.extend([lat, lng]);
  }
  for (const p of points) bounds.extend([p.lat, p.lng]);
  return bounds;
}

function FitBounds({
  fields,
  points,
  extras,
  signal,
}: {
  fields: Field[];
  points: { lat: number; lng: number }[];
  extras: GeoJSONPolygon[];
  signal: number;
}) {
  const map = useMap();
  useEffect(() => {
    const bounds = collectBounds(fields, points, extras);
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.12));
    // `signal` lets the toolbar's recenter button re-trigger the fit.
  }, [fields, points, extras, signal, map]);
  return null;
}

export function MapView({
  height = "100%",
  fields = [],
  sensors = [],
  equipment = [],
  zones = [],
  plots = [],
  soilLayers = [],
  showFields = true,
  showSensors = true,
  showEquipment = true,
  showZones = false,
  showPlots = true,
  showSoil = false,
  onFieldClick,
  satellite = true,
  center,
  zoom = 13,
  controls = true,
}: {
  height?: string;
  fields?: Field[];
  sensors?: Sensor[];
  equipment?: Equipment[];
  zones?: IrrigationZone[];
  plots?: Plot[];
  soilLayers?: SoilLayer[];
  showFields?: boolean;
  showSensors?: boolean;
  showEquipment?: boolean;
  showZones?: boolean;
  showPlots?: boolean;
  showSoil?: boolean;
  onFieldClick?: (field: Field) => void;
  satellite?: boolean;
  center?: [number, number];
  zoom?: number;
  controls?: boolean;
}) {
  const [sat, setSat] = useState(satellite);
  const [fitSignal, setFitSignal] = useState(0);

  const points = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [];
    for (const s of sensors) if (s.lat != null && s.lng != null) pts.push({ lat: s.lat, lng: s.lng });
    for (const e of equipment) if (e.lat != null && e.lng != null) pts.push({ lat: e.lat, lng: e.lng });
    return pts;
  }, [sensors, equipment]);

  const extraPolys = useMemo(() => {
    const polys: GeoJSONPolygon[] = [];
    for (const z of zones) if (z.boundary?.type === "Polygon") polys.push(z.boundary);
    for (const p of plots) if (p.boundary?.type === "Polygon") polys.push(p.boundary);
    for (const s of soilLayers) if (s.boundary?.type === "Polygon") polys.push(s.boundary);
    return polys;
  }, [zones, plots, soilLayers]);

  const start: [number, number] = center ?? (points[0] ? [points[0].lat, points[0].lng] : [41.6, -93.6]);

  const styleFor = (field: Field) => {
    const color = healthColor(field.health_status);
    return {
      color,
      weight: 2,
      fillColor: color,
      fillOpacity: 0.35,
    };
  };

  return (
    // Leaflet positions its panes, zoom buttons, and attribution in physical
    // coordinates, so the canvas stays left-to-right even in an RTL page.
    <Box
      dir="ltr"
      position="relative"
      h={height}
      w="100%"
      minH="220px"
      borderRadius="xl"
      overflow="hidden"
    >
      <MapContainer center={start} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        {sat ? (
          <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        ) : (
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        <ScaleControl position="bottomleft" />
        <FitBounds fields={fields} points={points} extras={extraPolys} signal={fitSignal} />
        {showSoil &&
          soilLayers.map((s) =>
            s.boundary?.type === "Polygon" ? (
              <GeoJSON
                key={`soil-${s.id}`}
                data={s.boundary}
                style={() => ({
                  color: SOIL_COLORS[s.soil_type] ?? "#B98A2F",
                  weight: 1,
                  fillColor: SOIL_COLORS[s.soil_type] ?? "#B98A2F",
                  fillOpacity: 0.45,
                })}
              >
                <Popup>
                  <strong>{s.name}</strong>
                  <br />
                  {s.soil_type_display ?? s.soil_type} · {Number(s.acres).toFixed(1)} ac
                  {s.ph != null ? (
                    <>
                      <br />
                      pH {s.ph}
                    </>
                  ) : null}
                </Popup>
              </GeoJSON>
            ) : null,
          )}
        {showFields &&
          fields.map((f) =>
            f.boundary?.type === "Polygon" ? (
              <GeoJSON
                key={f.id}
                data={f.boundary as GeoJSONPolygon}
                style={() => styleFor(f)}
                eventHandlers={{
                  click: () => onFieldClick?.(f),
                }}
              />
            ) : null,
          )}
        {showPlots &&
          plots.map((p) =>
            p.boundary?.type === "Polygon" ? (
              <GeoJSON
                key={`plot-${p.id}`}
                data={p.boundary}
                style={() => ({
                  color: "#3D7EA6",
                  weight: 2,
                  dashArray: "2 4",
                  fillOpacity: 0,
                })}
              >
                <Popup>
                  <strong>{p.name}</strong>
                  <br />
                  {Number(p.acres).toFixed(1)} ac
                </Popup>
              </GeoJSON>
            ) : null,
          )}
        {showZones &&
          zones.map((z) =>
            z.boundary?.type === "Polygon" ? (
              <GeoJSON
                key={`zone-${z.id}`}
                data={z.boundary as GeoJSONPolygon}
                style={() => ({
                  color: "#3D7EA6",
                  weight: 2,
                  dashArray: "6 4",
                  fillColor: "#3D7EA6",
                  fillOpacity: 0.18,
                })}
              />
            ) : null,
          )}
        {showSensors &&
          sensors.map((s) =>
            s.lat != null && s.lng != null ? (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={divIcon(healthColor(s.status as StatusLevel), 12)}>
                <Popup>
                  <strong>{s.name}</strong>
                  <br />
                  {s.last_reading ?? "—"} {s.unit ?? s.sensor_type_name ?? ""}
                </Popup>
              </Marker>
            ) : null,
          )}
        {showEquipment &&
          equipment.map((e) =>
            e.lat != null && e.lng != null ? (
              <Marker key={e.id} position={[e.lat, e.lng]} icon={divIcon("#D4A017", 12)}>
                <Popup>
                  <strong>{e.name}</strong>
                  <br />
                  {e.make} {e.model}
                </Popup>
              </Marker>
            ) : null,
          )}
      </MapContainer>
      {controls ? (
        <HStack position="absolute" top={2} right={2} zIndex={1000} spacing={1}>
          <IconButton
            aria-label="Recenter map"
            icon={<Crosshair size={14} />}
            size="xs"
            colorScheme="gray"
            variant="solid"
            onClick={() => setFitSignal((n) => n + 1)}
          />
          <Button size="xs" colorScheme="gray" variant="solid" onClick={() => setSat((v) => !v)}>
            {sat ? "Street" : "Satellite"}
          </Button>
        </HStack>
      ) : null}
    </Box>
  );
}
