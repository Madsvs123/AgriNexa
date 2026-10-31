import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { equipmentApi, farmsApi, irrigationApi, platformApi, sensorsApi } from "@/api/client";
import { formatAcres } from "@/lib/utils";
import { Drawer } from "@/components/ui/Modal";
import { LayerToggle } from "@/components/ui/SensorSparkline";
import { MapView } from "@/components/ui/MapView";
import { StatusBadge } from "@/components/ui/StatCard";
import { useSensorSocket } from "@/hooks/useSensorSocket";
import type { Field } from "@/types";

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
    <div className="page page--flush">
      <div className="map-page">
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
        <div className="map-toolbar">
          <div className="card card-pad">
            <label htmlFor="map-farm">Farm</label>
            <select
              id="map-farm"
              className="select"
              value={selectedFarm}
              onChange={(e) => setFarmId(e.target.value)}
            >
              {(farmsQ.data?.results ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
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
          <div className="card card-pad map-legend">
            <span>
              <i className="swatch" style={{ background: "#7CB518" }} /> Healthy
            </span>
            <span>
              <i className="swatch" style={{ background: "#D4A017" }} /> Warning
            </span>
            <span>
              <i className="swatch" style={{ background: "#B42318" }} /> Critical
            </span>
          </div>
          {layers.irrigation ? (
            <div className="card card-pad">
              <strong>Zones</strong>
              {(zonesQ.data?.results ?? []).slice(0, 6).map((z) => (
                <div key={z.id} className="row" style={{ marginTop: 6 }}>
                  <StatusBadge status={z.status} />
                  <span>{z.name}</span>
                </div>
              ))}
            </div>
          ) : null}
          {layers.alerts ? (
            <div className="card card-pad">
              <strong>Alerts</strong>
              {alertSensors.slice(0, 4).map((s) => (
                <div key={s.id} className="muted" style={{ marginTop: 6 }}>
                  {s.name} · {s.status}
                </div>
              ))}
              {(alertsQ.data?.results ?? []).slice(0, 3).map((n) => (
                <div key={n.id} className="muted" style={{ marginTop: 6 }}>
                  {n.title}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <Drawer open={!!picked} title={picked?.name ?? "Field"} onClose={() => setPicked(null)}>
        {picked ? (
          <>
            <p className="muted">
              {picked.crop_name ?? "Fallow"} · {formatAcres(picked.acres)}
            </p>
            <div className="row" style={{ margin: "12px 0" }}>
              <StatusBadge status={picked.health_status} />
              <span>{picked.moisture != null ? `${picked.moisture}% moisture` : "No probe"}</span>
            </div>
            <Link to={`/fields/${picked.id}`} className="btn btn-primary">
              Open field record
            </Link>
          </>
        ) : null}
      </Drawer>
    </div>
  );
}
