import type { ReactNode } from "react";
import { statusTone } from "@/lib/utils";

export function StatusBadge({ status, label }: { status?: string | null; label?: string }) {
  const tone = statusTone(status);
  const text = label ?? (status ? status.replace(/_/g, " ") : "idle");
  return <span className={`status-badge status-${tone}`}>{text}</span>;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <article className="card stat-card">
      <div className="value">{label}</div>
      <div className="label">
        {icon}
        {value}
      </div>
      {hint ? <div className="hint">{hint}</div> : null}
    </article>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-art" aria-hidden />
      <h3>{body}</h3>
      <p>{title}</p>
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}

export function ChartCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card card-pad">
      <div className="card-title">
        <h3>{action}</h3>
        {title}
      </div>
      {children}
    </section>
  );
}
