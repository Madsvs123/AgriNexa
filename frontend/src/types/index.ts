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

export type CropCategory =
  | "grain" | "oilseed" | "legume" | "vegetable" | "fruit" | "forage" | "fiber" | "cover" | "other";
export type WaterNeed = "low" | "medium" | "high";
export type PlantingSystem = "monoculture" | "intercrop" | "relay" | "strip" | "cover";

export interface Crop {
  id: UUID;
  name: string;
  category: CropCategory;
  scientific_name: string;
  family: string;
  typical_days: number;
  water_need: WaterNeed;
  color_hex: string;
  nitrogen_fixing: boolean;
  root_depth: "shallow" | "medium" | "deep";
  water_acre_inches: number | null;
  effective_water_inches: number;
  labor_hours_per_acre: number;
  nitrogen_lb_per_acre: number;
  expected_yield_per_acre: number;
  yield_unit: string;
  expected_price_per_unit: number;
  seed_cost_per_acre: number;
  input_cost_per_acre: number;
  compatible_intercrops: UUID[];
  variety_count?: number;
}
export interface Variety {
  id: UUID;
  crop: UUID;
  crop_name?: string;
  name: string;
  days_to_maturity: number;
  maturity_group: string;
  seed_rate_per_acre: number;
  expected_yield_per_acre: number;
  yield_unit: string;
  traits: string[];
  drought_tolerance: number;
  disease_resistance: string[];
  suitable_soils: string[];
  min_soil_temp_c: number | null;
  gdd_to_maturity: number | null;
  seed_cost_per_acre: number | null;
  effective_seed_cost: number;
  is_active: boolean;
}
export interface Season {
  id: UUID;
  farm: UUID | null;
  farm_name?: string | null;
  name: string;
  start_date: string;
  end_date: string;
  year?: number;
  is_active: boolean;
}
export interface PlantingWindow {
  id: UUID;
  crop: UUID;
  crop_name?: string;
  variety: UUID | null;
  variety_name?: string | null;
  farm: UUID | null;
  farm_name?: string | null;
  start_month: number;
  start_day: number;
  end_month: number;
  end_day: number;
  late_end_month: number | null;
  late_end_day: number | null;
  harvest_by_month: number | null;
  harvest_by_day: number | null;
  min_soil_temp_c: number | null;
  source: string;
  notes: string;
  resolved?: ResolvedWindow;
}
export interface ResolvedWindow {
  start: string | null;
  end: string | null;
  late_end: string | null;
  harvest_by: string | null;
  min_soil_temp_c: number | null;
  source: string;
  window_id: string | null;
  defined?: boolean;
}
export type PlantingFit = "optimal" | "late" | "early" | "outside" | "unknown";
export interface RotationCheck {
  score: number;
  lineage: { name: string; year: number | null; source: string }[];
  warnings: string[];
  notes: string[];
}
export interface PlantingAssessment {
  fit: PlantingFit;
  window: ResolvedWindow;
  days_to_maturity: number;
  projected_harvest: string | null;
  harvest_ok: boolean | null;
  soil_match: boolean | null;
  previous_crop: string | null;
  conflicts: { plan_id: UUID; crop_name: string; harvest_date: string; message: string }[];
  rotation: RotationCheck;
  warnings: string[];
}
export interface VarietyRecommendation {
  variety_id: UUID;
  name: string;
  maturity_group: string;
  days_to_maturity: number;
  drought_tolerance: number;
  expected_yield_per_acre: number;
  yield_unit: string;
  seed_cost_per_acre: number;
  projected_margin_per_acre: number;
  projected_harvest: string | null;
  score: number;
  reasons: string[];
}
export interface CropPlanComponent {
  id: UUID;
  crop_plan: UUID;
  crop: UUID;
  crop_name?: string;
  color_hex?: string;
  variety: UUID | null;
  variety_name?: string | null;
  role: "primary" | "intercrop" | "relay" | "cover";
  share_pct: number;
  row_arrangement: string;
  planting_date: string | null;
  order: number;
}
export interface CropPlan {
  id: UUID;
  field: UUID;
  field_name?: string;
  field_acres?: number;
  farm?: UUID;
  farm_name?: string;
  season: UUID;
  season_name?: string;
  crop: UUID;
  crop_name?: string;
  crop_color?: string;
  variety: UUID | null;
  variety_name?: string | null;
  planting_system: PlantingSystem;
  acres: number | null;
  effective_acres: number;
  planting_date: string | null;
  expected_harvest_date: string | null;
  target_yield: number | null;
  yield_unit: string;
  seed_required: number | null;
  status: string;
  notes: string;
  strategy: UUID | null;
  strategy_name?: string | null;
  rotation: UUID | null;
  typical_days?: number;
  components: CropPlanComponent[];
}
export interface RotationStep {
  id: UUID;
  rotation: UUID;
  year_offset: number;
  order: number;
  crop: UUID | null;
  crop_name?: string | null;
  crop_color?: string | null;
  variety: UUID | null;
  variety_name?: string | null;
  role: "main" | "cover" | "intercrop" | "fallow";
  companion_crops: UUID[];
  companion_names?: string[];
  season_label: string;
  notes: string;
}
export interface RotationFieldPhase {
  id: UUID;
  rotation: UUID;
  field: UUID;
  field_name?: string;
  phase_offset: number;
}
export interface Rotation {
  id: UUID;
  farm: UUID;
  farm_name?: string;
  name: string;
  sequence: unknown[];
  fields: UUID[];
  field_names?: string[];
  phases?: RotationFieldPhase[];
  start_year: number | null;
  cycle_years: number;
  is_active: boolean;
  notes: string;
  steps: RotationStep[];
}
export interface RotationValidation {
  ok: boolean;
  cycle_years?: number;
  diversity?: number;
  issues: { level: "error" | "warning" | "info"; year_offset?: number; message: string }[];
}
export interface RotationPreviewRow {
  field_id: UUID;
  field_name: string;
  acres: number;
  step_id: UUID | null;
  year_offset: number | null;
  role: string | null;
  crop_id: UUID | null;
  crop_name: string | null;
  variety_id: UUID | null;
  variety_name: string | null;
  companions: { id: UUID; name: string }[];
  suggested_planting: string | null;
}
export type ResourceKey =
  | "water_acre_inches" | "labor_hours" | "nitrogen_lb" | "seed_budget"
  | "input_budget" | "total_budget" | "acres" | "equipment_hours";
export interface ResourceConstraint {
  id: UUID;
  farm: UUID | null;
  farm_name?: string | null;
  season: UUID | null;
  season_name?: string | null;
  resource: ResourceKey;
  label?: string;
  limit_value: number;
  unit: string;
  is_hard: boolean;
  notes: string;
}
export interface ConstraintResult {
  constraint_id: UUID;
  resource: ResourceKey;
  label: string;
  unit: string;
  limit: number;
  used: number;
  remaining: number;
  utilization_pct: number;
  is_hard: boolean;
  status: "ok" | "tight" | "exceeded" | "violated";
  scope: string;
}
export interface StrategyTotals {
  acres: number;
  production: number;
  revenue: number;
  seed_cost: number;
  input_cost: number;
  total_cost: number;
  margin: number;
  margin_per_acre: number;
  labor_hours: number;
  water_acre_inches: number;
  nitrogen_demand_lb: number;
  nitrogen_fixed_lb: number;
  nitrogen_balance_lb: number;
  crop_acres: Record<string, number>;
}
export interface StrategyFieldResult extends StrategyTotals {
  allocation_id: UUID;
  field_id: UUID;
  field_name: string;
  crop_name: string;
  variety_name: string | null;
  planting_system: PlantingSystem;
  components: { crop_name: string; share_pct: number; role: string }[];
  fit?: PlantingFit;
  rotation_score?: number;
  warnings?: string[];
}
export interface StrategyEvaluation {
  strategy_id: UUID;
  name: string;
  status: string;
  is_baseline: boolean;
  assumptions: { price_multiplier: number; yield_multiplier: number; cost_multiplier: number; rainfall_scenario: string };
  totals: StrategyTotals;
  crop_count: number;
  diversity_index: number;
  rotation_score: number | null;
  risk_score: number;
  planting_fit: { optimal: number; late: number; early: number; outside: number };
  constraints: ConstraintResult[];
  hard_violations: number;
  soft_exceeded: number;
  feasible: boolean;
  unplanted_fields: { id: UUID; name: string; acres: number }[];
  unplanted_acres: number;
  fields: StrategyFieldResult[];
  warnings: string[];
}
export interface StrategyComponent {
  crop: UUID;
  variety?: UUID | null;
  share_pct: number;
  role?: string;
  row_arrangement?: string;
}
export interface StrategyAllocation {
  id: UUID;
  strategy: UUID;
  field: UUID;
  field_name?: string;
  field_acres?: number;
  field_soil?: string;
  crop: UUID | null;
  crop_name?: string | null;
  crop_color?: string | null;
  variety: UUID | null;
  variety_name?: string | null;
  planting_system: PlantingSystem;
  acres: number | null;
  effective_acres: number;
  planting_date: string | null;
  components: StrategyComponent[];
  notes: string;
}
export type StrategyStatus = "draft" | "candidate" | "adopted" | "archived";
export interface StrategySummary {
  acres?: number;
  revenue?: number;
  total_cost?: number;
  margin?: number;
  margin_per_acre?: number;
  risk_score?: number;
  diversity_index?: number;
  rotation_score?: number | null;
  feasible?: boolean;
  hard_violations?: number;
  crop_acres?: Record<string, number>;
}
export interface Strategy {
  id: UUID;
  farm: UUID;
  farm_name?: string;
  season: UUID;
  season_name?: string;
  name: string;
  description: string;
  status: StrategyStatus;
  is_baseline: boolean;
  rotation: UUID | null;
  rotation_name?: string | null;
  price_multiplier: number;
  yield_multiplier: number;
  cost_multiplier: number;
  rainfall_scenario: "dry" | "normal" | "wet";
  allocation_count?: number;
  summary?: StrategySummary;
  evaluated_at: string | null;
  adopted_at: string | null;
  allocations?: StrategyAllocation[];
  evaluation?: StrategyEvaluation;
}
export interface StrategyComparison {
  strategies: StrategyEvaluation[];
  baseline_id: UUID | null;
  metrics: {
    key: string;
    label: string;
    higher_is_better: boolean;
    values: (number | null)[];
    deltas: (number | null)[];
    best_index: number | null;
  }[];
  ranking: { index: number; strategy_id: UUID; name: string; score: number }[];
  crop_mix: { name: string; crop_acres: Record<string, number> }[];
}
export interface SeasonUsage {
  season: string;
  farm: string | null;
  metrics: StrategyTotals;
  constraints: ConstraintResult[];
  plan_count: number;
}
export interface FertilizerPlan {
  id: UUID;
  crop_plan: UUID;
  product_name: string;
  nutrient_analysis: string;
  rate_per_acre: number;
  unit: string;
  application_date: string | null;
  method: string;
  cost: number;
}
export interface PesticideApplication {
  id: UUID;
  crop_plan: UUID;
  product_name: string;
  target_pest: string;
  rate_per_acre: number;
  unit: string;
  application_date: string | null;
  reentry_hours: number;
  phi_days: number;
  applicator: string;
}
export interface PlantingSchedule {
  id: UUID;
  crop_plan: UUID;
  stage: string;
  scheduled_date: string;
  completed_date: string | null;
  notes: string;
}
export interface BudgetLine {
  id: UUID;
  season: UUID;
  season_name?: string;
  farm: UUID;
  farm_name?: string;
  category: string;
  planned_amount: number;
  actual_amount: number;
  currency: string;
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
