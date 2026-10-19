import { Link } from "react-router-dom";
import { Leaf } from "lucide-react";
import type { ReactNode } from "react";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="auth-shell">
      <section className="auth-brand">
        <div>
          <div className="row">
            <span className="sidebar-mark">
              <Leaf size={18} />
            </span>
            <strong style={{ fontFamily: "var(--display)", fontSize: 22 }}>AgriNexa</strong>
          </div>
          <h1>Precision farming, unified.</h1>
          <p>
            Fields, moisture, irrigation, and yield in one operations center — built for growers who run North Ridge
            and Willow Creek like a fleet.
          </p>
        </div>
        <p className="muted" style={{ color: "#c5d4cb" }}>
          Satellite layers · live sensors · seasonal plans
        </p>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-form">
          <h2>{title}</h2>
          <p>{subtitle}</p>
          {children}
          {footer ? <div style={{ marginTop: 18 }}>{footer}</div> : null}
          <p className="muted" style={{ marginTop: 24, fontSize: 13 }}>
            <Link to="/signin">Sign in</Link> · <Link to="/signup">Create organization</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
