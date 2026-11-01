import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore, REFRESH_KEY } from "@/stores/authStore";
import { acceptLanguageHeader } from "@/i18n/bootstrap";
import { unwrapList } from "@/lib/utils";
import type {
  AnalyticsCosts,
  AnalyticsOverview,
  AnalyticsWater,
  AnalyticsYields,
  AuditLog,
  AuthResponse,
  Breakdown,
  BudgetLine,
  Crop,
  CropPlan,
  CropPlanComponent,
  CropProgress,
  DashboardIrrigation,
  DashboardKPIs,
  DashboardSummary,
  DocumentItem,
  ElevationEstimate,
  Equipment,
  ExpensePoint,
  Farm,
  FarmAccess,
  FarmerProfile,
  FertilizerPlan,
  Field,
  FieldHealthCard,
  FieldHistory,
  FieldNote,
  FuelLog,
  InventoryAlert,
  InventoryItem,
  Invitation,
  IrrigationAnalytics,
  IrrigationRecommendation,
  IrrigationSchedule,
  IrrigationZone,
  MaintenanceRecord,
  Member,
  NotificationItem,
  Organization,
  OrganizationSettings,
  Paginated,
  PlantingAssessment,
  PlantingWindow,
  PesticideApplication,
  PlantingSchedule,
  Plot,
  Region,
  ResolvedWindow,
  ResourceConstraint,
  ReportItem,
  Role,
  Rotation,
  RotationPreviewRow,
  RotationStep,
  RotationValidation,
  RotationFieldPhase,
  ScoutReport,
  SearchResults,
  Season,
  SeasonUsage,
  Sensor,
  SensorHealth,
  SoilLayer,
  SensorReading,
  SensorType,
  Strategy,
  StrategyAllocation,
  StrategyComparison,
  StrategyEvaluation,
  ServiceHistory,
  TaskItem,
  Team,
  Treatment,
  User,
  Variety,
  VarietyRecommendation,
  WaterUsage,
  WeatherAlert,
  WeatherCurrent,
  WeatherForecastDay,
  WeatherHistoryPoint,
  WeatherRecommendation,
  WeatherStation,
  YieldPoint,
} from "@/types";

const SKIP_REFRESH = ["/api/auth/register/", "/api/auth/login/", "/api/auth/refresh/"];

export const api = axios.create({
  baseURL: "",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const { accessToken, currentOrgId } = useAuthStore.getState();
  config.headers = config.headers ?? {};
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (currentOrgId) {
    config.headers["X-Organization-ID"] = currentOrgId;
  }
  config.headers["Accept-Language"] = acceptLanguageHeader();
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    delete (config.headers as Record<string, unknown>)["Content-Type"];
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccess(): Promise<string> {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) throw new Error("No refresh token");
  const { data } = await axios.post<{ access: string; refresh?: string }>("/api/auth/refresh/", {
    refresh,
  });
  if (data.refresh) localStorage.setItem(REFRESH_KEY, data.refresh);
  useAuthStore.getState().setAccessToken(data.access);
  return data.access;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const url = original?.url ?? "";
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !SKIP_REFRESH.some((p) => url.includes(p))
    ) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccess().finally(() => {
            refreshPromise = null;
          });
        }
        const access = await refreshPromise;
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      } catch {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

export function getApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Record<string, unknown> | string | undefined;
    if (!data) return err.message || "Request failed.";
    if (typeof data === "string") return data;
    const fieldErrors = data.errors;
    if (fieldErrors && typeof fieldErrors === "object") {
      const parts = Object.entries(fieldErrors as Record<string, unknown>).map(([key, value]) =>
        `${key}: ${Array.isArray(value) ? value.join(" ") : String(value)}`,
      );
      if (parts.length) return parts.join(" ");
    }
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) return data.detail.map(String).join(" ");
    const parts: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (key === "detail") continue;
      if (Array.isArray(value)) parts.push(`${key}: ${value.join(" ")}`);
      else if (typeof value === "string") parts.push(`${key}: ${value}`);
    }
    if (parts.length) return parts.join(" ");
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

async function getPage<T>(url: string, params?: Record<string, unknown>): Promise<Paginated<T>> {
  const { data } = await api.get<Paginated<T> | T[]>(url, { params });
  if (Array.isArray(data)) {
    return { count: data.length, next: null, previous: null, results: data };
  }
  return data;
}

export const authApi = {
  register: (body: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    organization_name: string;
  }) => api.post<AuthResponse>("/api/auth/register/", body).then((r) => r.data),
  login: (body: { email: string; password: string }) =>
    api.post<AuthResponse>("/api/auth/login/", body).then((r) => r.data),
  refresh: (refresh: string) =>
    api.post<{ access: string; refresh?: string }>("/api/auth/refresh/", { refresh }).then((r) => r.data),
  logout: (refresh: string) => api.post("/api/auth/logout/", { refresh }),
  me: () =>
    api.get<User & { user?: User }>("/api/auth/me/").then((r) => {
      const data = r.data;
      if (data && typeof data === "object" && "email" in data && data.email) return data;
      if (data && typeof data === "object" && data.user) return data.user;
      return data as User;
    }),
  patchMe: (body: Partial<User>) => api.patch<User>("/api/auth/me/", body).then((r) => r.data),
  profile: () => api.get<FarmerProfile>("/api/auth/profile/").then((r) => r.data),
  patchProfile: (body: Partial<FarmerProfile>) =>
    api.patch<FarmerProfile>("/api/auth/profile/", body).then((r) => r.data),
};

export const tenancyApi = {
  organizations: () => getPage<Organization>("/api/organizations/"),
  createOrganization: (body: Partial<Organization>) =>
    api.post<Organization>("/api/organizations/", body).then((r) => r.data),
  getOrganization: (id: string) => api.get<Organization>(`/api/organizations/${id}/`).then((r) => r.data),
  patchOrganization: (id: string, body: Partial<Organization>) =>
    api.patch<Organization>(`/api/organizations/${id}/`, body).then((r) => r.data),
  getOrgSettings: (id: string) =>
    api.get<OrganizationSettings>(`/api/organizations/${id}/settings/`).then((r) => r.data),
  patchOrgSettings: (id: string, body: Partial<OrganizationSettings>) =>
    api.patch<OrganizationSettings>(`/api/organizations/${id}/settings/`, body).then((r) => r.data),
  members: () => getPage<Member>("/api/members/"),
  patchMember: (id: string, body: Partial<{ role: string }>) =>
    api.patch<Member>(`/api/members/${id}/`, body).then((r) => r.data),
  deleteMember: (id: string) => api.delete(`/api/members/${id}/`),
  teams: () => getPage<Team>("/api/teams/"),
  createTeam: (body: Partial<Team>) => api.post<Team>("/api/teams/", body).then((r) => r.data),
  patchTeam: (id: string, body: Partial<Team>) => api.patch<Team>(`/api/teams/${id}/`, body).then((r) => r.data),
  deleteTeam: (id: string) => api.delete(`/api/teams/${id}/`),
  addTeamMember: (id: string, userId: string) => api.post(`/api/teams/${id}/members/`, { user_id: userId }),
  removeTeamMember: (id: string, userId: string) => api.delete(`/api/teams/${id}/members/${userId}/`),
  roles: () => getPage<Role>("/api/roles/"),
  createRole: (body: Partial<Role>) => api.post<Role>("/api/roles/", body).then((r) => r.data),
  patchRole: (id: string, body: Partial<Role>) => api.patch<Role>(`/api/roles/${id}/`, body).then((r) => r.data),
  deleteRole: (id: string) => api.delete(`/api/roles/${id}/`),
  invitations: () => getPage<Invitation>("/api/invitations/"),
  createInvitation: (body: { email: string; role?: string }) =>
    api.post<Invitation>("/api/invitations/", body).then((r) => r.data),
  resendInvitation: (id: string) => api.post(`/api/invitations/${id}/resend/`),
  acceptInvitation: (
    token: string,
    extra?: { password?: string; first_name?: string; last_name?: string },
  ) => api.post<AuthResponse>("/api/invitations/accept/", { token, ...extra }).then((r) => r.data),
  farmAccess: (farmId: string) =>
    api.get<FarmAccess[] | Paginated<FarmAccess>>(`/api/farms/${farmId}/access/`).then((r) => unwrapList(r.data)),
  putFarmAccess: (farmId: string, body: FarmAccess) =>
    api.put(`/api/farms/${farmId}/access/`, body).then((r) => r.data),
};

export const farmsApi = {
  regions: (params?: Record<string, unknown>) => getPage<Region>("/api/regions/", params),
  createRegion: (body: Partial<Region>) => api.post<Region>("/api/regions/", body).then((r) => r.data),
  patchRegion: (id: string, body: Partial<Region>) =>
    api.patch<Region>(`/api/regions/${id}/`, body).then((r) => r.data),
  deleteRegion: (id: string) => api.delete(`/api/regions/${id}/`),
  list: (params?: Record<string, unknown>) => getPage<Farm>("/api/farms/", params),
  get: (id: string) => api.get<Farm>(`/api/farms/${id}/`).then((r) => r.data),
  create: (body: Partial<Farm>) => api.post<Farm>("/api/farms/", body).then((r) => r.data),
  patch: (id: string, body: Partial<Farm>) => api.patch<Farm>(`/api/farms/${id}/`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/api/farms/${id}/`),
  fields: (params?: Record<string, unknown>) => getPage<Field>("/api/fields/", params),
  getField: (id: string) => api.get<Field>(`/api/fields/${id}/`).then((r) => r.data),
  createField: (body: Partial<Field>) => api.post<Field>("/api/fields/", body).then((r) => r.data),
  patchField: (id: string, body: Partial<Field>) => api.patch<Field>(`/api/fields/${id}/`, body).then((r) => r.data),
  deleteField: (id: string) => api.delete(`/api/fields/${id}/`),
  fieldHistory: (id: string) =>
    api.get<FieldHistory[] | Paginated<FieldHistory>>(`/api/fields/${id}/history/`).then((r) => unwrapList(r.data)),
  plots: (params?: Record<string, unknown>) => getPage<Plot>("/api/plots/", params),
  createPlot: (body: Partial<Plot>) => api.post<Plot>("/api/plots/", body).then((r) => r.data),
  patchPlot: (id: string, body: Partial<Plot>) => api.patch<Plot>(`/api/plots/${id}/`, body).then((r) => r.data),
  deletePlot: (id: string) => api.delete(`/api/plots/${id}/`),
  soilLayers: (params?: Record<string, unknown>) => getPage<SoilLayer>("/api/soil-layers/", params),
  createSoilLayer: (body: Partial<SoilLayer>) =>
    api.post<SoilLayer>("/api/soil-layers/", body).then((r) => r.data),
  deleteSoilLayer: (id: string) => api.delete(`/api/soil-layers/${id}/`),
  fieldElevation: (id: string, refresh = false) =>
    api
      .get<ElevationEstimate>(`/api/fields/${id}/elevation/`, { params: refresh ? { refresh: 1 } : undefined })
      .then((r) => r.data),
  notes: (params?: Record<string, unknown>) => getPage<FieldNote>("/api/field-notes/", params),
  createNote: (body: Partial<FieldNote>) => api.post<FieldNote>("/api/field-notes/", body).then((r) => r.data),
  patchNote: (id: string, body: Partial<FieldNote>) =>
    api.patch<FieldNote>(`/api/field-notes/${id}/`, body).then((r) => r.data),
  deleteNote: (id: string) => api.delete(`/api/field-notes/${id}/`),
};

export const cropsApi = {
  // ── Catalog ───────────────────────────────────────────────────────────
  crops: (params?: Record<string, unknown>) => getPage<Crop>("/api/crops/", params),
  getCrop: (id: string) => api.get<Crop>(`/api/crops/${id}/`).then((r) => r.data),
  createCrop: (body: Partial<Crop>) => api.post<Crop>("/api/crops/", body).then((r) => r.data),
  patchCrop: (id: string, body: Partial<Crop>) => api.patch<Crop>(`/api/crops/${id}/`, body).then((r) => r.data),
  deleteCrop: (id: string) => api.delete(`/api/crops/${id}/`),
  varieties: (params?: Record<string, unknown>) => getPage<Variety>("/api/varieties/", params),
  createVariety: (body: Partial<Variety>) => api.post<Variety>("/api/varieties/", body).then((r) => r.data),
  patchVariety: (id: string, body: Partial<Variety>) =>
    api.patch<Variety>(`/api/varieties/${id}/`, body).then((r) => r.data),
  deleteVariety: (id: string) => api.delete(`/api/varieties/${id}/`),
  recommendVarieties: (params: { field: string; crop: string; season: string; planting_date?: string }) =>
    api
      .get<{ field: string; crop: string; results: VarietyRecommendation[] }>("/api/varieties/recommend/", { params })
      .then((r) => r.data),

  // ── Seasons & windows ─────────────────────────────────────────────────
  seasons: (params?: Record<string, unknown>) => getPage<Season>("/api/seasons/", params),
  createSeason: (body: Partial<Season>) => api.post<Season>("/api/seasons/", body).then((r) => r.data),
  patchSeason: (id: string, body: Partial<Season>) =>
    api.patch<Season>(`/api/seasons/${id}/`, body).then((r) => r.data),
  deleteSeason: (id: string) => api.delete(`/api/seasons/${id}/`),
  plantingWindows: (params?: Record<string, unknown>) => getPage<PlantingWindow>("/api/planting-windows/", params),
  createPlantingWindow: (body: Partial<PlantingWindow>) =>
    api.post<PlantingWindow>("/api/planting-windows/", body).then((r) => r.data),
  patchPlantingWindow: (id: string, body: Partial<PlantingWindow>) =>
    api.patch<PlantingWindow>(`/api/planting-windows/${id}/`, body).then((r) => r.data),
  deletePlantingWindow: (id: string) => api.delete(`/api/planting-windows/${id}/`),
  resolveWindow: (params: { crop: string; variety?: string; farm?: string; year?: number }) =>
    api.get<ResolvedWindow>("/api/planning/window/", { params }).then((r) => r.data),
  assess: (params: { field: string; crop: string; season: string; variety?: string; planting_date?: string }) =>
    api.get<PlantingAssessment>("/api/planning/assess/", { params }).then((r) => r.data),

  // ── Crop plans ────────────────────────────────────────────────────────
  plans: (params?: Record<string, unknown>) => getPage<CropPlan>("/api/crop-plans/", params),
  getPlan: (id: string) => api.get<CropPlan>(`/api/crop-plans/${id}/`).then((r) => r.data),
  createPlan: (body: Partial<CropPlan>) => api.post<CropPlan>("/api/crop-plans/", body).then((r) => r.data),
  patchPlan: (id: string, body: Partial<CropPlan>) =>
    api.patch<CropPlan>(`/api/crop-plans/${id}/`, body).then((r) => r.data),
  deletePlan: (id: string) => api.delete(`/api/crop-plans/${id}/`),
  planAssessment: (id: string) =>
    api.get<PlantingAssessment>(`/api/crop-plans/${id}/assessment/`).then((r) => r.data),
  planComponents: (params?: Record<string, unknown>) =>
    getPage<CropPlanComponent>("/api/crop-plan-components/", params),
  createPlanComponent: (body: Partial<CropPlanComponent>) =>
    api.post<CropPlanComponent>("/api/crop-plan-components/", body).then((r) => r.data),
  deletePlanComponent: (id: string) => api.delete(`/api/crop-plan-components/${id}/`),

  // ── Rotations ─────────────────────────────────────────────────────────
  rotations: (params?: Record<string, unknown>) => getPage<Rotation>("/api/rotations/", params),
  getRotation: (id: string) => api.get<Rotation>(`/api/rotations/${id}/`).then((r) => r.data),
  createRotation: (body: Partial<Rotation>) => api.post<Rotation>("/api/rotations/", body).then((r) => r.data),
  patchRotation: (id: string, body: Partial<Rotation>) =>
    api.patch<Rotation>(`/api/rotations/${id}/`, body).then((r) => r.data),
  deleteRotation: (id: string) => api.delete(`/api/rotations/${id}/`),
  validateRotation: (id: string) => api.get<RotationValidation>(`/api/rotations/${id}/validate/`).then((r) => r.data),
  previewRotation: (id: string, season: string) =>
    api
      .get<{ season: string; year: number; fields: RotationPreviewRow[] }>(`/api/rotations/${id}/preview/`, {
        params: { season },
      })
      .then((r) => r.data),
  rotationToStrategy: (id: string, body: { season: string; name?: string }) =>
    api.post<Strategy>(`/api/rotations/${id}/create-strategy/`, body).then((r) => r.data),
  setRotationPhases: (id: string, phases: { field: string; phase_offset: number }[]) =>
    api.put<RotationFieldPhase[]>(`/api/rotations/${id}/phases/`, phases).then((r) => r.data),
  rotationSteps: (params?: Record<string, unknown>) => getPage<RotationStep>("/api/rotation-steps/", params),
  createRotationStep: (body: Partial<RotationStep>) =>
    api.post<RotationStep>("/api/rotation-steps/", body).then((r) => r.data),
  patchRotationStep: (id: string, body: Partial<RotationStep>) =>
    api.patch<RotationStep>(`/api/rotation-steps/${id}/`, body).then((r) => r.data),
  deleteRotationStep: (id: string) => api.delete(`/api/rotation-steps/${id}/`),

  // ── Constraints ───────────────────────────────────────────────────────
  constraints: (params?: Record<string, unknown>) =>
    getPage<ResourceConstraint>("/api/resource-constraints/", params),
  createConstraint: (body: Partial<ResourceConstraint>) =>
    api.post<ResourceConstraint>("/api/resource-constraints/", body).then((r) => r.data),
  patchConstraint: (id: string, body: Partial<ResourceConstraint>) =>
    api.patch<ResourceConstraint>(`/api/resource-constraints/${id}/`, body).then((r) => r.data),
  deleteConstraint: (id: string) => api.delete(`/api/resource-constraints/${id}/`),
  seasonUsage: (params: { season: string; farm?: string }) =>
    api.get<SeasonUsage>("/api/planning/constraints/", { params }).then((r) => r.data),

  // ── Strategies ────────────────────────────────────────────────────────
  strategies: (params?: Record<string, unknown>) => getPage<Strategy>("/api/strategies/", params),
  getStrategy: (id: string) => api.get<Strategy>(`/api/strategies/${id}/`).then((r) => r.data),
  createStrategy: (body: Partial<Strategy>) => api.post<Strategy>("/api/strategies/", body).then((r) => r.data),
  patchStrategy: (id: string, body: Partial<Strategy>) =>
    api.patch<Strategy>(`/api/strategies/${id}/`, body).then((r) => r.data),
  deleteStrategy: (id: string) => api.delete(`/api/strategies/${id}/`),
  evaluateStrategy: (id: string) =>
    api.post<StrategyEvaluation>(`/api/strategies/${id}/evaluate/`).then((r) => r.data),
  compareStrategies: (ids: string[], refresh = true) =>
    api
      .get<StrategyComparison>("/api/strategies/compare/", { params: { ids: ids.join(","), refresh: refresh ? 1 : 0 } })
      .then((r) => r.data),
  adoptStrategy: (id: string, force = false) =>
    api
      .post<{ strategy: Strategy; created: string[]; updated: string[]; skipped: { field: string; reason: string }[] }>(
        `/api/strategies/${id}/adopt/`,
        { force },
      )
      .then((r) => r.data),
  cloneStrategy: (id: string, name?: string) =>
    api.post<Strategy>(`/api/strategies/${id}/clone/`, { name }).then((r) => r.data),
  setAllocations: (id: string, allocations: Partial<StrategyAllocation>[]) =>
    api.put<Strategy>(`/api/strategies/${id}/allocations/`, allocations).then((r) => r.data),
  allocations: (params?: Record<string, unknown>) =>
    getPage<StrategyAllocation>("/api/strategy-allocations/", params),
  createAllocation: (body: Partial<StrategyAllocation>) =>
    api.post<StrategyAllocation>("/api/strategy-allocations/", body).then((r) => r.data),
  patchAllocation: (id: string, body: Partial<StrategyAllocation>) =>
    api.patch<StrategyAllocation>(`/api/strategy-allocations/${id}/`, body).then((r) => r.data),
  deleteAllocation: (id: string) => api.delete(`/api/strategy-allocations/${id}/`),

  // ── Schedules, inputs, budget ─────────────────────────────────────────
  plantingSchedules: (params?: Record<string, unknown>) =>
    getPage<PlantingSchedule>("/api/planting-schedules/", params),
  createPlanting: (body: Partial<PlantingSchedule>) =>
    api.post<PlantingSchedule>("/api/planting-schedules/", body).then((r) => r.data),
  fertilizerPlans: (params?: Record<string, unknown>) =>
    getPage<FertilizerPlan>("/api/fertilizer-plans/", params),
  createFertilizer: (body: Partial<FertilizerPlan>) =>
    api.post<FertilizerPlan>("/api/fertilizer-plans/", body).then((r) => r.data),
  pesticides: (params?: Record<string, unknown>) =>
    getPage<PesticideApplication>("/api/pesticide-applications/", params),
  createPesticide: (body: Partial<PesticideApplication>) =>
    api.post<PesticideApplication>("/api/pesticide-applications/", body).then((r) => r.data),
  budgets: (params?: Record<string, unknown>) => getPage<BudgetLine>("/api/budgets/", params),
  createBudget: (body: Partial<BudgetLine>) => api.post<BudgetLine>("/api/budgets/", body).then((r) => r.data),
  patchBudget: (id: string, body: Partial<BudgetLine>) =>
    api.patch<BudgetLine>(`/api/budgets/${id}/`, body).then((r) => r.data),
};

export const sensorsApi = {
  types: (params?: Record<string, unknown>) => getPage<SensorType>("/api/sensor-types/", params),
  createType: (body: Partial<SensorType>) => api.post<SensorType>("/api/sensor-types/", body).then((r) => r.data),
  list: (params?: Record<string, unknown>) => getPage<Sensor>("/api/sensors/", params),
  get: (id: string) => api.get<Sensor>(`/api/sensors/${id}/`).then((r) => r.data),
  create: (body: Partial<Sensor>) => api.post<Sensor>("/api/sensors/", body).then((r) => r.data),
  patch: (id: string, body: Partial<Sensor>) => api.patch<Sensor>(`/api/sensors/${id}/`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/api/sensors/${id}/`),
  readings: (id: string, params?: { start?: string; end?: string }) =>
    api
      .get<SensorReading[] | Paginated<SensorReading>>(`/api/sensors/${id}/readings/`, { params })
      .then((r) => unwrapList(r.data)),
  postReading: (id: string, body: { value: number; recorded_at?: string }) =>
    api.post<SensorReading>(`/api/sensors/${id}/readings/`, body).then((r) => r.data),
  health: (id: string) => api.get<SensorHealth>(`/api/sensors/${id}/health/`).then((r) => r.data),
  live: () =>
    api.get<Sensor[] | Paginated<Sensor>>("/api/sensors/live/").then((r) => unwrapList(r.data)),
};

export const irrigationApi = {
  zones: (params?: Record<string, unknown>) => getPage<IrrigationZone>("/api/irrigation-zones/", params),
  getZone: (id: string) => api.get<IrrigationZone>(`/api/irrigation-zones/${id}/`).then((r) => r.data),
  createZone: (body: Partial<IrrigationZone>) =>
    api.post<IrrigationZone>("/api/irrigation-zones/", body).then((r) => r.data),
  patchZone: (id: string, body: Partial<IrrigationZone>) =>
    api.patch<IrrigationZone>(`/api/irrigation-zones/${id}/`, body).then((r) => r.data),
  deleteZone: (id: string) => api.delete(`/api/irrigation-zones/${id}/`),
  schedules: (params?: Record<string, unknown>) =>
    getPage<IrrigationSchedule>("/api/irrigation-schedules/", params),
  createSchedule: (body: Partial<IrrigationSchedule>) =>
    api.post<IrrigationSchedule>("/api/irrigation-schedules/", body).then((r) => r.data),
  patchSchedule: (id: string, body: Partial<IrrigationSchedule>) =>
    api.patch<IrrigationSchedule>(`/api/irrigation-schedules/${id}/`, body).then((r) => r.data),
  deleteSchedule: (id: string) => api.delete(`/api/irrigation-schedules/${id}/`),
  waterUsage: (params?: Record<string, unknown>) => getPage<WaterUsage>("/api/water-usage/", params),
  postWaterUsage: (body: Partial<WaterUsage>) =>
    api.post<WaterUsage>("/api/water-usage/", body).then((r) => r.data),
  recommendations: () =>
    api
      .get<IrrigationRecommendation[] | Paginated<IrrigationRecommendation>>("/api/irrigation/recommendations/")
      .then((r) => unwrapList(r.data)),
  override: (id: string, body: { duration_minutes: number; notes?: string }) =>
    api.post(`/api/irrigation-zones/${id}/override/`, body),
  analytics: () => api.get<IrrigationAnalytics>("/api/irrigation/analytics/").then((r) => r.data),
};

export const scoutingApi = {
  reports: (params?: Record<string, unknown>) => getPage<ScoutReport>("/api/scout-reports/", params),
  getReport: (id: string) => api.get<ScoutReport>(`/api/scout-reports/${id}/`).then((r) => r.data),
  createReport: (body: FormData | Record<string, unknown>) =>
    api
      .post<ScoutReport>("/api/scout-reports/", body, {
        headers: body instanceof FormData ? { "Content-Type": "multipart/form-data" } : undefined,
      })
      .then((r) => r.data),
  patchReport: (id: string, body: Partial<ScoutReport>) =>
    api.patch<ScoutReport>(`/api/scout-reports/${id}/`, body).then((r) => r.data),
  deleteReport: (id: string) => api.delete(`/api/scout-reports/${id}/`),
  treatments: (params?: Record<string, unknown>) => getPage<Treatment>("/api/treatments/", params),
  createTreatment: (body: Partial<Treatment>) =>
    api.post<Treatment>("/api/treatments/", body).then((r) => r.data),
  patchTreatment: (id: string, body: Partial<Treatment>) =>
    api.patch<Treatment>(`/api/treatments/${id}/`, body).then((r) => r.data),
  deleteTreatment: (id: string) => api.delete(`/api/treatments/${id}/`),
};

export const weatherApi = {
  current: (farm?: string) =>
    api.get<WeatherCurrent>("/api/weather/current/", { params: { farm } }).then((r) => r.data),
  forecast: (farm?: string) =>
    api
      .get<WeatherForecastDay[] | Paginated<WeatherForecastDay>>("/api/weather/forecast/", { params: { farm } })
      .then((r) => unwrapList(r.data)),
  history: (params: { farm?: string; start?: string; end?: string }) =>
    api
      .get<WeatherHistoryPoint[] | Paginated<WeatherHistoryPoint>>("/api/weather/history/", { params })
      .then((r) => unwrapList(r.data)),
  alerts: (farm?: string) =>
    api
      .get<WeatherAlert[] | Paginated<WeatherAlert>>("/api/weather/alerts/", { params: { farm } })
      .then((r) => unwrapList(r.data)),
  recommendations: (farm?: string) =>
    api
      .get<WeatherRecommendation[] | Paginated<WeatherRecommendation>>("/api/weather/recommendations/", {
        params: { farm },
      })
      .then((r) => unwrapList(r.data)),
  stations: (params?: Record<string, unknown>) => getPage<WeatherStation>("/api/weather-stations/", params),
  createStation: (body: Partial<WeatherStation>) =>
    api.post<WeatherStation>("/api/weather-stations/", body).then((r) => r.data),
  patchStation: (id: string, body: Partial<WeatherStation>) =>
    api.patch<WeatherStation>(`/api/weather-stations/${id}/`, body).then((r) => r.data),
  deleteStation: (id: string) => api.delete(`/api/weather-stations/${id}/`),
};

export const inventoryApi = {
  list: (params?: Record<string, unknown>) => getPage<InventoryItem>("/api/inventory/", params),
  get: (id: string) => api.get<InventoryItem>(`/api/inventory/${id}/`).then((r) => r.data),
  create: (body: Partial<InventoryItem>) =>
    api.post<InventoryItem>("/api/inventory/", body).then((r) => r.data),
  patch: (id: string, body: Partial<InventoryItem>) =>
    api.patch<InventoryItem>(`/api/inventory/${id}/`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/api/inventory/${id}/`),
  move: (id: string, body: { quantity: number; movement_type: string; notes?: string }) =>
    api.post(`/api/inventory/${id}/move/`, body),
  alerts: () =>
    api.get<InventoryAlert[] | Paginated<InventoryAlert>>("/api/inventory/alerts/").then((r) => unwrapList(r.data)),
};

export const equipmentApi = {
  list: (params?: Record<string, unknown>) => getPage<Equipment>("/api/equipment/", params),
  get: (id: string) => api.get<Equipment>(`/api/equipment/${id}/`).then((r) => r.data),
  create: (body: Partial<Equipment>) => api.post<Equipment>("/api/equipment/", body).then((r) => r.data),
  patch: (id: string, body: Partial<Equipment>) =>
    api.patch<Equipment>(`/api/equipment/${id}/`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/api/equipment/${id}/`),
  maintenance: (params?: Record<string, unknown>) => getPage<MaintenanceRecord>("/api/maintenance/", params),
  createMaintenance: (body: Partial<MaintenanceRecord>) =>
    api.post<MaintenanceRecord>("/api/maintenance/", body).then((r) => r.data),
  patchMaintenance: (id: string, body: Partial<MaintenanceRecord>) =>
    api.patch<MaintenanceRecord>(`/api/maintenance/${id}/`, body).then((r) => r.data),
  fuelLogs: (params?: Record<string, unknown>) => getPage<FuelLog>("/api/fuel-logs/", params),
  createFuelLog: (body: Partial<FuelLog>) => api.post<FuelLog>("/api/fuel-logs/", body).then((r) => r.data),
  breakdowns: (params?: Record<string, unknown>) => getPage<Breakdown>("/api/breakdowns/", params),
  createBreakdown: (body: Partial<Breakdown>) =>
    api.post<Breakdown>("/api/breakdowns/", body).then((r) => r.data),
  serviceHistory: (params?: Record<string, unknown>) => getPage<ServiceHistory>("/api/service-history/", params),
  createService: (body: Partial<ServiceHistory>) =>
    api.post<ServiceHistory>("/api/service-history/", body).then((r) => r.data),
};

export const dashboardApi = {
  summary: (params?: Record<string, unknown>) =>
    api.get<DashboardSummary>("/api/dashboard/summary/", { params }).then((r) => r.data),
  cropProgress: (params?: Record<string, unknown>) =>
    api
      .get<CropProgress[] | Paginated<CropProgress>>("/api/dashboard/crop-progress/", { params })
      .then((r) => unwrapList(r.data)),
  yields: (params?: Record<string, unknown>) =>
    api
      .get<YieldPoint[] | Paginated<YieldPoint>>("/api/dashboard/yields/", { params })
      .then((r) => unwrapList(r.data)),
  fieldHealth: (params?: Record<string, unknown>) =>
    api
      .get<FieldHealthCard[] | Paginated<FieldHealthCard>>("/api/dashboard/field-health/", { params })
      .then((r) => unwrapList(r.data)),
  irrigation: (params?: Record<string, unknown>) =>
    api.get<DashboardIrrigation>("/api/dashboard/irrigation/", { params }).then((r) => r.data),
  expenses: (params?: Record<string, unknown>) =>
    api
      .get<ExpensePoint[] | Paginated<ExpensePoint>>("/api/dashboard/expenses/", { params })
      .then((r) => unwrapList(r.data)),
  kpis: (params?: Record<string, unknown>) =>
    api.get<DashboardKPIs>("/api/dashboard/kpis/", { params }).then((r) => r.data),
};

export const analyticsApi = {
  overview: () => api.get<AnalyticsOverview>("/api/analytics/overview/").then((r) => r.data),
  yields: () => api.get<AnalyticsYields>("/api/analytics/yields/").then((r) => r.data),
  water: () => api.get<AnalyticsWater>("/api/analytics/water/").then((r) => r.data),
  costs: () => api.get<AnalyticsCosts>("/api/analytics/costs/").then((r) => r.data),
  generateReport: (body: { report_type: string; params: Record<string, unknown> }) =>
    api.post<ReportItem>("/api/reports/generate/", body).then((r) => r.data),
  reports: () => getPage<ReportItem>("/api/reports/"),
};

export const platformApi = {
  search: (q: string, options?: { type?: string[]; limit?: number }) =>
    api
      .get<SearchResults>("/api/search/", {
        params: {
          q,
          ...(options?.type?.length ? { type: options.type.join(",") } : {}),
          ...(options?.limit ? { limit: options.limit } : {}),
        },
      })
      .then((r) => r.data),
  tasks: (params?: Record<string, unknown>) => getPage<TaskItem>("/api/tasks/", params),
  getTask: (id: string) => api.get<TaskItem>(`/api/tasks/${id}/`).then((r) => r.data),
  createTask: (body: Partial<TaskItem>) => api.post<TaskItem>("/api/tasks/", body).then((r) => r.data),
  patchTask: (id: string, body: Partial<TaskItem>) =>
    api.patch<TaskItem>(`/api/tasks/${id}/`, body).then((r) => r.data),
  deleteTask: (id: string) => api.delete(`/api/tasks/${id}/`),
  documents: (params?: Record<string, unknown>) => getPage<DocumentItem>("/api/documents/", params),
  uploadDocument: (body: FormData) =>
    api
      .post<DocumentItem>("/api/documents/", body, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data),
  deleteDocument: (id: string) => api.delete(`/api/documents/${id}/`),
  notifications: (params?: Record<string, unknown>) => getPage<NotificationItem>("/api/notifications/", params),
  readNotification: (id: string) => api.post(`/api/notifications/${id}/read/`),
  readAllNotifications: () => api.post("/api/notifications/read-all/"),
  auditLogs: (params?: Record<string, unknown>) => getPage<AuditLog>("/api/audit-logs/", params),
};
