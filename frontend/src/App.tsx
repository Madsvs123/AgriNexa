import { useEffect, lazy, Suspense, type ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import axios from "axios";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { SkeletonBlock } from "@/components/ui/FormField";
import { authApi, tenancyApi } from "@/api/client";
import { ROUTES } from "@/navigation/manifest";
import { REFRESH_KEY, useAuthStore } from "@/stores/authStore";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import InvitePage from "@/pages/auth/InvitePage";
import NotFoundPage from "@/pages/NotFoundPage";

/**
 * Route id → page component.
 *
 * The paths themselves live in the navigation manifest; this map only supplies
 * the element. Keeping both in one place is what stopped the route table and
 * the sidebar from drifting apart, which had already left three pages routable
 * but unreachable from navigation.
 */
const PAGES: Record<string, ComponentType> = {
  dashboard: lazy(() => import("@/pages/dashboard/DashboardPage")),
  notifications: lazy(() => import("@/pages/notifications/NotificationsPage")),
  search: lazy(() => import("@/pages/search/SearchPage")),

  map: lazy(() => import("@/pages/map/MapPage")),
  farms: lazy(() => import("@/pages/farms/FarmsPage")),
  "farm-new": lazy(() => import("@/pages/farms/FarmFormPage")),
  "farm-detail": lazy(() => import("@/pages/farms/FarmDetailPage")),
  "farm-edit": lazy(() => import("@/pages/farms/FarmFormPage")),
  fields: lazy(() => import("@/pages/fields/FieldsPage")),
  "field-new": lazy(() => import("@/pages/fields/FieldFormPage")),
  "field-detail": lazy(() => import("@/pages/fields/FieldDetailPage")),
  "field-edit": lazy(() => import("@/pages/fields/FieldFormPage")),

  "crop-plans": lazy(() => import("@/pages/crops/CropPlansPage")),
  "crop-plan-detail": lazy(() => import("@/pages/crops/CropPlanDetailPage")),
  crops: lazy(() => import("@/pages/crops/CropsPage")),
  varieties: lazy(() => import("@/pages/crops/VarietiesPage")),
  seasons: lazy(() => import("@/pages/crops/SeasonsPage")),
  rotations: lazy(() => import("@/pages/crops/RotationsPage")),
  budget: lazy(() => import("@/pages/crops/BudgetPage")),

  irrigation: lazy(() => import("@/pages/irrigation/IrrigationPage")),
  "irrigation-zone": lazy(() => import("@/pages/irrigation/IrrigationZonePage")),
  sensors: lazy(() => import("@/pages/sensors/SensorsPage")),
  "sensor-detail": lazy(() => import("@/pages/sensors/SensorDetailPage")),
  weather: lazy(() => import("@/pages/weather/WeatherPage")),
  scouting: lazy(() => import("@/pages/scouting/ScoutingPage")),
  "scout-new": lazy(() => import("@/pages/scouting/ScoutReportNewPage")),
  treatments: lazy(() => import("@/pages/scouting/TreatmentsPage")),
  "scout-detail": lazy(() => import("@/pages/scouting/ScoutReportDetailPage")),
  equipment: lazy(() => import("@/pages/equipment/EquipmentPage")),
  "equipment-detail": lazy(() => import("@/pages/equipment/EquipmentDetailPage")),
  inventory: lazy(() => import("@/pages/inventory/InventoryPage")),
  "inventory-detail": lazy(() => import("@/pages/inventory/InventoryDetailPage")),
  tasks: lazy(() => import("@/pages/tasks/TasksPage")),

  analytics: lazy(() => import("@/pages/analytics/AnalyticsPage")),
  reports: lazy(() => import("@/pages/reports/ReportsPage")),
  documents: lazy(() => import("@/pages/documents/DocumentsPage")),

  settings: lazy(() => import("@/pages/settings/SettingsPage")),
  organization: lazy(() => import("@/pages/settings/OrganizationPage")),
  team: lazy(() => import("@/pages/settings/TeamPage")),
  roles: lazy(() => import("@/pages/settings/RolesPage")),
  invitations: lazy(() => import("@/pages/settings/InvitationsPage")),
  access: lazy(() => import("@/pages/settings/AccessPage")),
  profile: lazy(() => import("@/pages/settings/ProfilePage")),
};

/**
 * More specific paths first, so `/crops/plans` is not swallowed by `/crops`
 * and `/farms/new` is not matched as `/farms/:id`.
 */
const ORDERED_ROUTES = [...ROUTES].sort((a, b) => {
  const depth = b.path.split("/").length - a.path.split("/").length;
  if (depth !== 0) return depth;
  const aParams = (a.path.match(/:/g) ?? []).length;
  const bParams = (b.path.match(/:/g) ?? []).length;
  return aParams - bParams;
});

function AuthBootstrap() {
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const setOrganizations = useAuthStore((s) => s.setOrganizations);
  const setBootstrapped = useAuthStore((s) => s.setBootstrapped);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const refresh = localStorage.getItem(REFRESH_KEY);
      if (!refresh) {
        setBootstrapped(true);
        return;
      }
      try {
        const { data } = await axios.post<{ access: string; refresh?: string }>("/api/auth/refresh/", { refresh });
        if (data.refresh) localStorage.setItem(REFRESH_KEY, data.refresh);
        setAccessToken(data.access);
        const [user, orgs] = await Promise.all([authApi.me(), tenancyApi.organizations()]);
        if (cancelled) return;
        setUser(user);
        setOrganizations(orgs.results);
      } catch {
        if (!cancelled) logout();
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [logout, setAccessToken, setBootstrapped, setOrganizations, setUser]);

  return null;
}

export default function App() {
  return (
    <>
      <AuthBootstrap />
      <Routes>
        <Route path="/signin" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/invites/:token" element={<InvitePage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/home" replace />} />
            {ORDERED_ROUTES.map((route) => {
              const Page = PAGES[route.id];
              if (!Page) return null;
              return (
                <Route
                  key={route.id}
                  path={route.path}
                  element={
                    <Suspense fallback={<SkeletonBlock rows={6} />}>
                      <Page />
                    </Suspense>
                  }
                />
              );
            })}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/signin" replace />} />
      </Routes>
    </>
  );
}
