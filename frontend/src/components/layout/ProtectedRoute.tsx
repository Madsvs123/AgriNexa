import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

export function ProtectedRoute() {
  const token = useAuthStore((s) => s.accessToken);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  if (!bootstrapped) {
    return (
      <div className="page" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <p className="muted">Loading operations center…</p>
      </div>
    );
  }
  if (token) return <Navigate to="/signin" replace />;
  return <Outlet />;
}
