export type UUID = string;

export type StatusLevel = "healthy" | "warning" | "critical" | "idle"

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface User {
  id: UUID;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  date_joined: string;
}

export interface FarmerProfile {
  id: UUID;
  user: UUID;
  phone: string;
  bio: string;
  certifications: string;
  specialties: string;
  years_experience: number;
  license_number: string;
}

export interface Organization {
  id: UUID;
  name: string;
  slug: string;
  logo: string | null;
  created_at: string;
}

export interface OrganizationSettings {
  id: UUID;
  organization: UUID;
  timezone: string;
  unit_system: "imperial" | "metric";
  currency: string;
  season_start_month: number;
  default_map_lat: number | null;
  default_map_lng: number | null;
  legal_name: string;
  tax_id: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
  organizations: Organization[];
  organization?: Organization;
}

export interface Team {
  id: UUID;
  name: string;
  description: string;
  member_ids?: UUID[];
  members?: User[];
  created_at?: string;
}

export interface Role {
  id: UUID;
  name: string;
  description: string;
  permissions: string[];
}

export interface Member {
  id: UUID;
  user: User;
  organization: UUID;
  role: Role | null;
  role_id: UUID | null;
  teams: Team[];
  joined_at: string;
  is_owner: boolean;
}

export interface Invitation {
  id: UUID;
  email: string;
  role: UUID | null;
  role_name?: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  created_at: string;
  expires_at: string | null;
}

export interface FarmAccess {
  user_id: UUID;
  user_email?: string;
  user_name?: string;
  can_view: boolean;
  can_edit: boolean;
  can_manage: boolean;
}

export interface Region {
  id: UUID;
  name: string;
  code: string;
}

export interface Farm {
  id: UUID;
  name: string;
  code: string;
  address: string;
  lat: number | null;
  lng: number | null;
  total_acres: number
  timezone: string;
  region: Region | null;
  region_id: UUID | null;
  field_count?: number;
  created_at: string;
}

export interface Field {
  id: UUID;
  name: string;
  farm: UUID;
  farm_name?: string;
  acres: number;
  soil_type: string;
  crop: UUID | null;
  crop_name?: string;
  moisture: number | null;
  health_status: StatusLevel;
  boundary: GeoJSONPolygon | null;
  centroid_lat?: string | number | null;
  centroid_lng?: string | number | null;
  planting_date: string | null;
  harvest_date: string | null;
}

export interface Plot {
  id: UUID;
  name: string;
  field: UUID;
  field_name?: string;
  acres: number;
  boundary?: GeoJSONPolygon | null;
  notes?: string;
}

export interface SoilLayer {
  id: UUID;
  field: UUID;
  field_name?: string;
  name: string;
  soil_type: string;
  soil_type_display?: string;
  boundary: GeoJSONPolygon | null;
  acres: number;
  ph: number | string | null;
  organic_matter_pct: number | string | null;
  drainage?: string;
  notes?: string;
}

export interface ElevationPoint {
  lat: number;
  lng: number;
  elevation_m: number;
}

export interface ElevationEstimate {
  source: "open-meteo" | "estimate";
  min_m: number;
  max_m: number;
  mean_m: number;
  relief_m: number;
  points: ElevationPoint[];
}

export interface FieldNote {
  id: UUID;
  field: UUID;
  body: string;
  created_at: string;
  author_name?: string;
}

export interface FieldHistory {
  id: UUID;
  field: UUID;
  season: string;
  crop_name: string;
  yield_amount: number | null;
  notes: string;
  planted_at: string | null;
  harvested_at: string | null;
}

export interface Crop {
  id: UUID;
  name: string;
  category: string;
  typical_days_to_harvest: number;
  water_needs: string;
  description?: string;
}

export interface Variety {
  id: UUID;
  name: string;
  crop: UUID;
  crop_name?: string;
  maturity_days: number;
  traits: string;
}

export interface Season {
  id: UUID;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface CropPlan {
  id: UUID;
  name: string;
  crop: UUID;
  crop_name?: string;
  variety: UUID | null;
  variety_name?: string;
  field: UUID;
  field_name?: string;
  farm_name?: string;
  season: UUID;
  season_name?: string;
  planted_acres: number;
  target_yield: number | null;
  status: string;
  planting_date: string | null;
  expected_harvest: string | null;
}

export interface Rotation {
  id: UUID;
  name: string;
  field: UUID;
  field_name?: string;
  sequence: { crop_name: string; year: number; season: string }[];
  notes: string;
}

export interface PlantingSchedule {
  id: UUID;
  crop_plan: UUID;
  field_name?: string;
  crop_name?: string;
  start_date: string;
  end_date: string;
  activity: string;
  status: string;
}

export interface FertilizerPlan {
  id: UUID;
  crop_plan: UUID;
  product: string;
  rate: string;
  scheduled_date: string;
  status: string;
  cost: number | null;
}

export interface PesticideApplication {
  id: UUID;
  crop_plan: UUID;
  product: string;
  target: string;
  rate: string;
  applied_at: string | null;
  status: string;
}

export interface BudgetLine {
  id: UUID;
  season: UUID;
  season_name?: string;
  category: string;
  planned: number;
  actual: number;
  notes: string;
}

export interface SensorType {
  id: UUID;
  name: string;
  unit: string;
  description: string;
}

export interface Sensor {
  id: UUID;
  name: string;
  sensor_type: UUID;
  sensor_type_name?: string;
  unit?: string;
  farm: UUID;
  farm_name?: string;
  field: UUID | null;
  field_name?: string;
  lat: number | null;
  lng: number | null;
  status: StatusLevel;
  last_reading: number | null;
  last_reading_at: string | null;
  battery_pct: number | null;
  sparkline?: number[];
}

export interface SensorReading {
  id: UUID;
  sensor: UUID;
  value: number;
  recorded_at: string;
}

export interface SensorHealth {
  status: StatusLevel;
  battery_pct: number | null;
  signal_strength: number | null;
  last_seen: string | null;
  issues: string[];
}

export interface IrrigationZone {
  id: UUID;
  name: string;
  field: UUID;
  field_name?: string;
  farm_name?: string;
  acres: number;
  moisture: number | null;
  threshold: number;
  status: StatusLevel;
  method: string;
  last_run_at: string | null;
  boundary?: GeoJSONPolygon | null;
}

export interface IrrigationSchedule {
  id: UUID;
  zone: UUID;
  zone_name?: string;
  start_time: string;
  duration_minutes: number;
  days_of_week: string[];
  is_active: boolean;
}

export interface WaterUsage {
  id: UUID;
  zone: UUID | null;
  farm: UUID | null;
  gallons: number;
  recorded_at: string;
  source: string;
}

export interface IrrigationRecommendation {
  id: UUID;
  zone: UUID;
  zone_name?: string;
  message: string;
  suggested_minutes: number;
  priority: StatusLevel;
  created_at: string;
}

export interface IrrigationAnalytics {
  efficiency_pct: number;
  gallons_this_week: number;
  gallons_last_week: number;
  by_zone: { zone_name: string; gallons: number }[];
  daily: { date: string; gallons: number }[];
}

export interface ScoutFinding {
  id?: UUID;
  name: string;
  severity: string;
  notes?: string;
}

export interface ScoutPhoto {
  id?: UUID;
  image: string;
  caption?: string;
}

export interface ScoutReport {
  id: UUID;
  field: UUID;
  field_name?: string;
  farm_name?: string;
  observed_at: string;
  health_score: number;
  severity: "low" | "medium" | "high" | "critical";
  notes: string;
  diseases: ScoutFinding[];
  pests: ScoutFinding[];
  weeds: ScoutFinding[];
  photos: ScoutPhoto[];
}

export interface Treatment {
  id: UUID;
  scout_report: UUID | null;
  field: UUID;
  field_name?: string;
  product: string;
  method: string;
  scheduled_date: string;
  completed_at: string | null;
  follow_up_task: UUID | null;
  notes: string;
  status: string;
}

export interface WeatherCurrent {
  farm: UUID;
  temperature_f: number;
  humidity: number;
  wind_mph: number;
  conditions: string;
  rainfall_in: number;
  feels_like: number;
  updated_at: string;
}

export interface WeatherForecastDay {
  date: string;
  high: number;
  low: number;
  conditions: string;
  precip_chance: number;
  rainfall_in: number;
  wind_mph: number;
}

export interface WeatherHistoryPoint {
  date: string;
  rainfall_in: number;
  temp_high: number;
  temp_low: number;
}

export interface WeatherAlert {
  id: UUID;
  farm: UUID;
  alert_type: "frost" | "heat" | "wind" | "storm" | "other";
  title: string;
  message: string;
  severity: StatusLevel;
  starts_at: string;
  ends_at: string | null;
}

export interface WeatherRecommendation {
  id: UUID;
  title: string;
  body: string;
  category: string;
}

export interface WeatherStation {
  id: UUID;
  name: string;
  farm: UUID;
  lat: number;
  lng: number;
  is_active: boolean;
}

export type InventoryCategory =
  | "seeds"
  | "fertilizers"
  | "chemicals"
  | "fuel"
  | "spare_parts"
  | "harvested";

export interface InventoryItem {
  id: UUID;
  name: string;
  category: InventoryCategory;
  sku: string;
  quantity: number;
  unit: string;
  reorder_level: number;
  location: string;
  farm: UUID | null;
  farm_name?: string;
  unit_cost: number | null;
}

export interface InventoryAlert {
  id: UUID;
  item: UUID;
  item_name: string;
  message: string;
  quantity: number;
  reorder_level: number;
}

export interface Equipment {
  id: UUID;
  name: string;
  type: string;
  farm: UUID;
  farm_name?: string;
  status: StatusLevel | "in_use" | "maintenance";
  hours: number;
  fuel_level: number | null;
  lat: number | null;
  lng: number | null;
  make: string;
  model: string;
  year: number | null;
}

export interface MaintenanceRecord {
  id: UUID;
  equipment: UUID;
  title: string;
  due_date: string;
  completed_at: string | null;
  notes: string;
  cost: number | null;
}

export interface FuelLog {
  id: UUID;
  equipment: UUID;
  gallons: number;
  cost: number | null;
  recorded_at: string;
  notes: string;
}

export interface Breakdown {
  id: UUID;
  equipment: UUID;
  occurred_at: string;
  description: string;
  resolved_at: string | null;
  cost: number | null;
}

export interface ServiceHistory {
  id: UUID;
  equipment: UUID;
  performed_at: string;
  summary: string;
  vendor: string;
  cost: number | null;
}

export interface DashboardSummary {
  total_acres: number;
  active_fields: number;
  yield_estimate: number;
  open_alerts: number;
  water_used: number;
  equipment_uptime: number;
}

export interface CropProgress {
  crop_name: string;
  planted_acres: number;
  progress_pct: number;
}

export interface YieldPoint {
  label: string;
  actual: number;
  target: number;
}

export interface FieldHealthCard {
  id: UUID;
  name: string;
  farm_name: string;
  health_status: StatusLevel;
  moisture: number | null;
  crop_name: string | null;
}

export interface DashboardIrrigation {
  zones_running: number;
  zones_total: number;
  gallons_today: number;
  efficiency_pct: number;
}

export interface ExpensePoint {
  date: string;
  amount: number;
}

export interface DashboardKPIs {
  yield_per_acre: number;
  cost_per_acre: number;
  water_per_acre: number;
  labor_hours: number;
}

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export interface TaskItem {
  id: UUID;
  title: string;
  description: string;
  status: TaskStatus;
  due_date: string | null;
  farm: UUID | null;
  farm_name?: string;
  field: UUID | null;
  field_name?: string;
  assignee_name?: string;
  priority: "low" | "medium" | "high";
}

export interface DocumentItem {
  id: UUID;
  title: string;
  category: string;
  farm: UUID | null;
  farm_name?: string;
  file: string;
  uploaded_at: string;
}

export interface NotificationItem {
  id: UUID;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  category: string;
  link?: string;
}

export interface AuditLog {
  id: UUID;
  actor: string;
  action: string;
  object_type: string;
  object_id: string;
  created_at: string;
}

export interface SearchResults {
  farms: Farm[];
  fields: Field[];
  equipment: Equipment[];
  inventory: InventoryItem[];
  tasks: TaskItem[];
  /** Returned by the API but previously dropped by the client. */
  crops: Crop[];
  query?: string;
  counts?: Record<string, number>;
}

export interface ReportItem {
  id: UUID;
  report_type: string;
  params: Record<string, unknown>;
  file: string | null;
  status: "pending" | "ready" | "failed";
  created_at: string;
}

export interface AnalyticsOverview {
  yield_trend: { date: string; value: number }[];
  water_trend: { date: string; value: number }[];
  cost_trend: { date: string; value: number }[];
  health_trend: { date: string; healthy: number; warning: number; critical: number }[];
}

export interface AnalyticsYields {
  by_crop: { crop_name: string; actual: number; target: number }[];
  by_field: { field_name: string; yield_per_acre: number }[];
}

export interface AnalyticsWater {
  daily: { date: string; gallons: number }[];
  by_farm: { farm_name: string; gallons: number }[];
}

export interface AnalyticsCosts {
  by_category: { category: string; amount: number }[];
  monthly: { month: string; amount: number }[];
}

export const ROLE_PERMISSIONS = [
  { key: "farms.view", label: "View farms" },
  { key: "farms.edit", label: "Edit farms" },
  { key: "crops.manage", label: "Manage crops" },
  { key: "sensors.manage", label: "Manage sensors" },
  { key: "irrigation.operate", label: "Operate irrigation" },
  { key: "inventory.manage", label: "Manage inventory" },
  { key: "equipment.manage", label: "Manage equipment" },
  { key: "reports.view", label: "View reports" },
  { key: "settings.admin", label: "Administer settings" },
  { key: "scouting.create", label: "Create scouting reports" },
  { key: "weather.view", label: "View weather" },
] as const;
