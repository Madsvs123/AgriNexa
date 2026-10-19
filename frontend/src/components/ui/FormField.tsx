import { useEffect, type ReactNode } from "react";

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="form-field">
      <label htmlFor={htmlFor}>{label}</label
      {children}
      {hint && !error ? <span className="hint">{hint}</span> : null}
      {error ? <span className="error">{error}</span> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
}: {
  title: string;
  subtitle?: string;
  crumbs?: ReactNode;
  actions?: ReactNode;
}) {
  useEffect(() => {
    document.title = title;
  }, [title]);
  return (
    <header className="page-header">
      <div>
        {crumbs ? <div className="crumbs">{crumbs}</div> : null}
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </header>
  );
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="error-banner">
      {message}
    </div>
  );
}

export function SkeletonBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card card-pad">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skeleton skel-row" style={{ width: `${88 - i * 8}%` }} />
      ))}
    </div>
  );
}

export function SkeletonKpis({ count = 6 }: { count?: number }) {
  return (
    <div className="kpi-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card skeleton skel-card" />
      ))}
    </div>
  );
}
