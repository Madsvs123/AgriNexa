import { useMemo } from "react";
import { GeoJSON, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Equipment, Field, GeoJSONPolygon, IrrigationZone, Sensor, StatusLevel } from "@/types";
import { healthColor, statusTone } from "@/lib/utils";
import { useEffect } from "react";

function divIcon(color: string, size = 14) {
  return L.divIcon({
    className: "",
    html: `<span class="marker-dot" style="background:${color};width:${size}px;height:${size}px;display:block"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FitBounds({
  fields,
  points,
}: {
  fields: Field[];
  points: { lat: number; lng: number }[];
}) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds([]);
    let any = false;
    for (const f of fields) {
      const coords = f.boundary?.coordinates?.[0];
      if (!coords) continue;
      for (const [lng, lat] of coords) {
        bounds.extend([lat, lng]);
        any = true;
      }
    }
    for (const p of points) {
      bounds.extend([p.lat, p.lng]);
      any = true;
    }
    if (any) map.fitBounds(bounds.pad(0.12));
  }, [fields, points, map]);
  return null;
}

export function MapView({
  height = "100%",
  fields = [],
  sensors = [],
  equipment = [],
  zones = [],
  showFields = true,
  showSensors = true,
  showEquipment = true,
  showZones = false,
  onFieldClick,
  satellite = true,
  center,
  zoom = 13,
}: {
  height?: string;
  fields?: Field[];
  sensors?: Sensor[];
  equipment?: Equipment[];
  zones?: IrrigationZone[];
  showFields?: boolean;
  showSensors?: boolean;
  showEquipment?: boolean;
  showZones?: boolean;
  onFieldClick?: (field: Field) => void;
  satellite?: boolean;
  center?: [number, number];
  zoom?: number;
}) {
  const points = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [];
    for (const s of sensors) if (s.lat != null && s.lng != null) pts.push({ lat: s.lat, lng: s.lng });
    for (const e of equipment) if (e.lat != null && e.lng != null) pts.push({ lat: e.lat, lng: e.lng });
    return pts;
  }, [sensors, equipment]);

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
    <div style={{ height, width: "100%", minHeight: 220, borderRadius: 12, overflow: "hidden" }}>
      <MapContainer center={start} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
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
        <FitBounds fields={fields} points={points} />
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
    </div>
  );
}
