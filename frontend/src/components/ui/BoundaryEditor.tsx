import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, ScaleControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import { Badge, Box, Button, Flex, HStack, Text } from "@chakra-ui/react";
import type { GeoJSONPolygon } from "@/types";
import { useTranslation } from "react-i18next";

const EARTH_RADIUS_M = 6371008.8;
const SQ_M_PER_ACRE = 4046.8564224;

export function polygonAcres(polygon: GeoJSONPolygon | null | undefined): number {
  const ring = polygon?.coordinates?.[0];
  if (!ring || ring.length < 4) return 0;
  const meanLat = ring.slice(0, -1).reduce((s, p) => s + p[1], 0) / (ring.length - 1);
  const k = (Math.PI / 180) * EARTH_RADIUS_M;
  const kx = k * Math.cos((meanLat * Math.PI) / 180);
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    total += x1 * kx * (y2 * k) - x2 * kx * (y1 * k);
  }
  return Math.abs(total / 2) / SQ_M_PER_ACRE;
}

export interface ContextShape {
  polygon: GeoJSONPolygon;
  color?: string;
  label?: string;
}

function closeRing(geometry: GeoJSONPolygon): GeoJSONPolygon {
  const rings = geometry.coordinates.map((ring) => {
    const [fx, fy] = ring[0];
    const [lx, ly] = ring[ring.length - 1];
    return fx === lx && fy === ly ? ring : [...ring, [fx, fy]];
  });
  return { type: "Polygon", coordinates: rings };
}

function EditorController({
  value,
  onChange,
  context,
}: {
  value: GeoJSONPolygon | null;
  onChange: (polygon: GeoJSONPolygon | null) => void;
  context: ContextShape[];
}) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    map.pm.addControls({
      position: "topleft",
      drawPolygon: true,
      drawRectangle: true,
      drawMarker: false,
      drawCircleMarker: false,
      drawCircle: false,
      drawPolyline: false,
      drawText: false,
      editMode: true,
      dragMode: false,
      cutPolygon: false,
      rotateMode: false,
      removalMode: true,
    });
    map.pm.setPathOptions({ color: "#2F6F4E", fillColor: "#2F6F4E", fillOpacity: 0.25 });

    const handleCreate = (e: { layer: L.Layer }) => {
      const gj = (e.layer as L.Polygon).toGeoJSON();
      e.layer.remove();
      if (gj.geometry.type === "Polygon") {
        onChangeRef.current(closeRing(gj.geometry as GeoJSONPolygon));
      }
    };
    map.on("pm:create", handleCreate);
    return () => {
      map.off("pm:create", handleCreate);
      map.pm.removeControls();
    };
  }, [map]);

  // Keep a single editable layer in sync with `value`.
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.remove();
      layerRef.current = null;
    }
    if (!value?.coordinates?.length) return;
    const layer = L.geoJSON(
      { type: "Feature", geometry: value, properties: {} } as GeoJSON.Feature,
      { style: { color: "#2F6F4E", fillColor: "#2F6F4E", fillOpacity: 0.25, weight: 2 } },
    );
    layer.addTo(map);
    layerRef.current = layer;
    const emit = () => {
      const polyLayer = layer.getLayers()[0] as L.Polygon | undefined;
      const gj = polyLayer?.toGeoJSON();
      if (gj && gj.geometry.type === "Polygon") {
        onChangeRef.current(closeRing(gj.geometry as GeoJSONPolygon));
      }
    };
    layer.on("pm:edit", emit);
    layer.on("pm:update", emit);
    layer.on("pm:remove", () => onChangeRef.current(null));
    const bounds = layer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.25));
    return () => {
      layer.remove();
      layerRef.current = null;
    };
  }, [map, value]);

  // Fit to the context shape when there is nothing drawn yet.
  const fittedRef = useRef(false);
  useEffect(() => {
    if (fittedRef.current || value?.coordinates?.length || !context.length) return;
    const bounds = L.geoJSON(
      context.map((c) => ({ type: "Feature" as const, geometry: c.polygon, properties: {} })),
    ).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2));
      fittedRef.current = true;
    }
  }, [map, value, context]);

  return null;
}

export function BoundaryEditor({
  value,
  onChange,
  context = [],
  center = [41.6, -93.6],
  height = "380px",
}: {
  value: GeoJSONPolygon | null;
  onChange: (polygon: GeoJSONPolygon | null) => void;
  context?: ContextShape[];
  center?: [number, number];
  height?: string;
}) {
  const [satellite, setSatellite] = useState(false);
  const acres = useMemo(() => polygonAcres(value), [value]);
  const { t } = useTranslation("land");

  return (
    <Box>
      {/* Geoman's drawing toolbar is physically positioned; keep it LTR. */}
      <Box
        dir="ltr"
        position="relative"
        h={height}
        borderWidth="1px"
        borderColor="border.default"
        borderRadius="xl"
        overflow="hidden"
      >
        <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          {satellite ? (
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
          {context.map((shape, i) => (
            <GeoJSON
              key={`ctx-${i}-${JSON.stringify(shape.polygon.coordinates[0]?.[0] ?? [])}`}
              data={shape.polygon}
              style={() => ({
                color: shape.color ?? "#5C6B63",
                weight: 2,
                dashArray: "6 4",
                fillColor: shape.color ?? "#5C6B63",
                fillOpacity: 0.08,
                interactive: false,
              })}
            />
          ))}
          <EditorController value={value} onChange={onChange} context={context} />
        </MapContainer>
        <Button
          size="xs"
          position="absolute"
          top={2}
          right={2}
          zIndex={1000}
          colorScheme="gray"
          variant="solid"
          onClick={() => setSatellite((v) => !v)}
        >
          {satellite ? "Street" : "Satellite"}
        </Button>
      </Box>
      <Flex align="center" mt={2} gap={3} wrap="wrap">
        <HStack spacing={2}>
          <Badge colorScheme={value ? "green" : "gray"}>{value ? "Boundary set" : "No boundary"}</Badge>
          {value ? <Text fontSize="sm" color="fg.muted">≈ {acres.toFixed(1)} acres</Text> : null}
        </HStack>
        <Text fontSize="sm" color="fg.muted">{t("boundary.hint")}</Text>
        {value ? (
          <Button size="xs" variant="ghost" colorScheme="red" onClick={() => onChange(null)}>{t("boundary.clear")}</Button>
        ) : null}
      </Flex>
    </Box>
  );
}
