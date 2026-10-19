import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import axios from "axios";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { authApi, tenancyApi } from "@/api/client";
import { REFRESH_KEY, useAuthStore } from "@/stores/authStore";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import InvitePage from "@/pages/auth/InvitePage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import FarmsPage from "@/pages/farms/FarmsPage";
import FarmDetailPage from "@/pages/farms/FarmDetailPage";
import FarmFormPage from "@/pages/farms/FarmFormPage";
import FieldsPage from "@/pages/fields/FieldsPage";
import FieldDetailPage from "@/pages/fields/FieldDetailPage";
import FieldFormPage from "@/pages/fields/FieldFormPage";
import CropsPage from "@/pages/crops/CropsPage";
import CropPlansPage from "@/pages/crops/CropPlansPage";
import CropPlanDetailPage from "@/pages/crops/CropPlanDetailPage";
import VarietiesPage from "@/pages/crops/VarietiesPage";
import SeasonsPage from "@/pages/crops/SeasonsPage";
import RotationsPage from "@/pages/crops/RotationsPage";
import BudgetPage from "@/pages/crops/BudgetPage";
import MapPage from "@/pages/map/MapPage";
import SensorsPage from "@/pages/sensors/SensorsPage";
import SensorDetailPage from "@/pages/sensors/SensorDetailPage";
import IrrigationPage from "@/pages/irrigation/IrrigationPage";
import IrrigationZonePage from "@/pages/irrigation/IrrigationZonePage";
import WeatherPage from "@/pages/weather/WeatherPage";
import ScoutingPage from "@/pages/scouting/ScoutingPage";
import ScoutReportNewPage from "@/pages/scouting/ScoutReportNewPage";
import ScoutReportDetailPage from "@/pages/scouting/ScoutReportDetailPage";
import TreatmentsPage from "@/pages/scouting/TreatmentsPage";
import InventoryPage from "@/pages/inventory/InventoryPage";
import InventoryDetailPage from "@/pages/inventory/InventoryDetailPage";
import EquipmentPage from "@/pages/equipment/EquipmentPage";
import EquipmentDetailPage from "@/pages/equipment/EquipmentDetailPage";
import AnalyticsPage from "@/pages/analytics/AnalyticsPage";
import ReportsPage from "@/pages/reports/ReportsPage";
import TasksPage from "@/pages/tasks/TasksPage";
import DocumentsPage from "@/pages/documents/DocumentsPage";
import NotificationsPage from "@/pages/notifications/NotificationsPage";
import SearchPage from "@/pages/search/SearchPage";
import SettingsPage from "@/pages/settings/SettingsPage";
import TeamPage from "@/pages/settings/TeamPage";
import RolesPage from "@/pages/settings/RolesPage";
import InvitationsPage from "@/pages/settings/InvitationsPage";
import AccessPage from "@/pages/settings/AccessPage";
import ProfilePage from "@/pages/settings/ProfilePage";
import OrganizationPage from "@/pages/settings/OrganizationPage";
import NotFoundPage from "@/pages/NotFoundPage";

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
        const { data } = await axios.post<{ access: string; refresh?: string }>("/api/auth/token/", { refresh });
        if (data.refresh) localStorage.setItem(REFRESH_KEY, data.refresh);
        setAccessToken(data.access);
        const [user, orgs] = await Promise.all([authApi.me(), tenancyApi.organizations()]);
        if (cancelled) return;
        setUser(orgs.results as never);
        setOrganizations([user] as never);
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
            <Route path="/home" element={<DashboardPage />} />
            <Route path="/farms/:id" element={<FarmDetailPage />} />
            <Route path="/farms" element={<FarmsPage />} />
            <Route path="/farms/new" element={<FarmFormPage />} />
            <Route path="/farms/:id/edit" element={<FarmFormPage />} />
            <Route path="/fields" element={<FieldsPage />} />
            <Route path="/fields/:id" element={<FieldDetailPage />} />
            <Route path="/fields/new" element={<FieldFormPage />} />
            <Route path="/crops" element={<CropsPage />} />
        <Route path="/crops/plans/:id" element={<CropPlanDetailPage />} />
            <Route path="/crops/plans" element={<CropPlansPage />} />
            <Route path="/crops/varieties" element={<VarietiesPage />} />
            <Route path="/crops/seasons" element={<SeasonsPage />} />
            <Route path="/crops/rotations" element={<RotationsPage />} />
            <Route path="/crops/budget" element={<BudgetPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/sensors" element={<SensorsPage />} />
            <Route path="/sensors/:id" element={<SensorDetailPage />} />
            <Route path="/irrigation" element={<IrrigationPage />} />
            <Route path="/irrigation/zones/:id" element={<IrrigationZonePage />} />
            <Route path="/weather" element={<WeatherPage />} />
            <Route path="/scouting" element={<ScoutingPage />} />
            <Route path="/scouting/new" element={<ScoutReportNewPage />} />
            <Route path="/scouting/treatments" element={<TreatmentsPage />} />
            <Route path="/scouting/:id" element={<ScoutReportDetailPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/inventory/:id" element={<InventoryDetailPage />} />
            <Route path="/equipment" element={<EquipmentPage />} />
            <Route path="/equipment/:id" element={<EquipmentDetailPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/team" element={<TeamPage />} />
            <Route path="/settings/roles" element={<RolesPage />} />
            <Route path="/settings/invitations" element={<InvitationsPage />} />
            <Route path="/settings/access" element={<AccessPage />} />
            <Route path="/settings/profile" element={<ProfilePage />} />
            <Route path="/settings/organization" element={<OrganizationPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}
