import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";
import { farmsApi, getApiError, weatherApi } from "@/api/client";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { ChartCard } from "@/components/ui/StatCard";

export default function WeatherPage() {
  const farmsQ = useQuery({ queryKey: ["farms"], queryFn: () => farmsApi.list() });
  const [farm, setFarm] = useState("");
  const farmId = farm || farmsQ.data?.results[0]?.id;
  const currentQ = useQuery({ queryKey: ["weather-current", farmId], queryFn: () => weatherApi.current(farmId), enabled: !!farmId });
  const forecastQ = useQuery({ queryKey: ["weather-forecast", farmId], queryFn: () => weatherApi.forecast(farmId), enabled: !!farmId });
  const historyQ = useQuery({ queryKey: ["weather-history", farmId], queryFn: () => weatherApi.history({ farm: farmId }), enabled: !!farmId });
  const alertsQ = useQuery({ queryKey: ["weather-alerts", farmId], queryFn: () => weatherApi.alerts(farmId), enabled: !!farmId });
  const recQ = useQuery({ queryKey: ["weather-recs", farmId], queryFn: () => weatherApi.recommendations(farmId), enabled: !!farmId });
  const stationsQ = useQuery({ queryKey: ["weather-stations"], queryFn: () => weatherApi.stations() });

  const frost = (alertsQ.data ?? []).filter((a) => a.alert_type === "frost");
  const heat = (alertsQ.data ?? []).filter((a) => a.alert_type === "heat");
  const current = currentQ.data;
  const forecast = forecastQ.data ?? [];
  const history = historyQ.data ?? [];

  const tempLine = useMemo(
    () => history.map((h) => ({ date: h.date, high: h.temp_high, low: h.temp_low })),
    [history],
  );

  return (
    <div className="page">
      <PageHeader
        title="Weather"
        subtitle="Conditions, forecast, and agronomic recommendations."
        actions={
          <select className="select" aria-label="Farm" value={farmId ?? ""} onChange={(e) => setFarm(e.target.value)}>
            {(farmsQ.data?.results ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        }
      />
      <ErrorBanner message={currentQ.error ? getApiError(currentQ.error) : null} />
      {frost.map((a) => (
        <div key={a.id} className="notice-frost" style={{ marginBottom: 10 }}>
          <strong>{a.title}</strong> — {a.message}
        </div>
      ))}
      {heat.map((a) => (
        <div key={a.id} className="notice-heat" style={{ marginBottom: 10 }}>
          <strong>{a.title}</strong> — {a.message}
        </div>
      ))}
      <section className="card weather-hero" style={{ marginBottom: 16 }}>
        <div>
          <div className="muted">Now at {farmsQ.data?.results.find((f) => f.id === farmId)?.name}</div>
          <div className="temp">{current ? `${Math.round(current.temperature_f)}°` : "—"}</div>
          <div>
            {current?.conditions ?? "No station feed"} · Feels {current?.feels_like ?? "—"}°
          </div>
        </div>
        <div>
          <div>Humidity {current?.humidity ?? "—"}%</div>
          <div>Wind {current?.wind_mph ?? "—"} mph</div>
          <div>Rain today {current?.rainfall_in ?? "—"} in</div>
        </div>
      </section>
      <div className="forecast-strip" style={{ marginBottom: 16 }}>
        {forecast.map((d) => (
          <article key={d.date} className="card forecast-day">
            <div className="muted">{safeDay(d.date)}</div>
            <strong>
              {Math.round(d.high)}° / {Math.round(d.low)}°
            </strong>
            <div>{d.conditions}</div>
            <div className="muted">{d.precip_chance}% · {d.rainfall_in} in</div>
          </article>
        ))}
      </div>
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <ChartCard title="Rainfall history">
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
                <XAxis dataKey="date" hide />
                <YAxis />
                <Tooltip />
                <Bar dataKey="rainfall_in" fill="#3D7EA6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Temperature trend">
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={tempLine}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
                <XAxis dataKey="date" hide />
                <YAxis />
                <Tooltip />
                <Line dataKey="high" stroke="#B54708" dot={false} />
                <Line dataKey="low" stroke="#175CD3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
      <div className="grid grid-3">
        {(recQ.data ?? []).map((r) => (
          <article key={r.id} className="card card-pad">
            <div className="chip">{r.category}</div>
            <h3>{r.title}</h3>
            <p>{r.body}</p>
          </article>
        ))}
        {!recQ.data?.length ? (
          <article className="card card-pad">
            <h3>Recommendations</h3>
            <p className="muted">Spray windows and planting advice appear when a forecast is available.</p>
          </article>
        ) : null}
      </div>
      <p className="muted" style={{ marginTop: 16 }}>
        {stationsQ.data?.count ?? 0} weather stations registered.
      </p>
    </div>
  );
}

function safeDay(iso: string) {
  try {
    return format(parseISO(iso), "EEE");
  } catch {
    return iso;
  }
}
