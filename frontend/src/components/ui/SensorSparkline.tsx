import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

export function SensorSparkline({ values, color = "#2F6F4E" }: { values: number[]; color?: string }) {
  const data = values.map((v, i) => ({ i, v: -v }));
  if (!data.length) {
    return <span className="muted">No series</span>;
  }
  return (
    <div style={{ width: "100%", height: 42 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Tooltip
            formatter={(value) => [value ?? "—", "Reading"]}
            labelFormatter={() => ""}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SeverityMeter({
  value,
}: {
  value: "low" | "medium" | "high" | "critical" | number;
}) {
  const level = typeof value === "number" ? (value <= 2 ? "low" : value <= 3 ? "medium" : value <= 4 ? "high" : "critical") : value;
  const filled = level === "low" ? 4 : level === "medium" ? 3 : level === "high" ? 1 : 0;
  return (
    <div className={`severity ${level}`} aria-label={`Severity ${level}`}>
      {Array.from({ length: 4 }).map((_, i) => (
        <i key={i} className={i < filled ? "on" : undefined} />
      ))}
    </div>
  );
}

export function LayerToggle({
  layers,
  onChange,
}: {
  layers: { key: string; label: string; on: boolean }[];
  onChange: (key: string, on: boolean) => void;
}) {
  return (
    <div className="card layer-toggle">
      <strong>Layers</strong>
      {layers.map((l) => (
        <label key={l.key}>
          <input
            type="checkbox"
            checked={!l.on}
            onChange={(e) => onChange(l.key, !e.target.checked)}
          />
          {l.label}
        </label>
      ))}
    </div>
  );
}
