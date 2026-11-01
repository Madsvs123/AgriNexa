import type { ConstraintResult, PlantingFit, PlantingSystem, ResourceKey } from "@/types";

export const PLANTING_SYSTEMS: Array<[PlantingSystem, string, string]> = [
  ["monoculture", "Monoculture", "One crop on the whole field."],
  ["intercrop", "Intercrop", "Two or more crops grown together in the same rows or alternating rows."],
  ["relay", "Relay", "Second crop sown into the first before it is harvested."],
  ["strip", "Strip", "Alternating strips wide enough for separate machinery passes."],
  ["cover", "Cover crop", "Non-cash crop grown to protect and build soil."],
];

export const CROP_CATEGORIES: Array<[string, string]> = [
  ["grain", "Grain"],
  ["oilseed", "Oilseed"],
  ["legume", "Legume"],
  ["vegetable", "Vegetable"],
  ["fruit", "Fruit"],
  ["forage", "Forage"],
  ["fiber", "Fiber"],
  ["cover", "Cover crop"],
  ["other", "Other"],
];

export const SOIL_OPTIONS: Array<[string, string]> = [
  ["clay", "Clay"],
  ["clay_loam", "Clay loam"],
  ["clay loam", "Clay loam (legacy)"],
  ["loam", "Loam"],
  ["silt_loam", "Silt loam"],
  ["silt loam", "Silt loam (legacy)"],
  ["silty clay loam", "Silty clay loam"],
  ["silt", "Silt"],
  ["sandy_loam", "Sandy loam"],
  ["sandy loam", "Sandy loam (legacy)"],
  ["sand", "Sand"],
  ["peat", "Peat"],
  ["chalk", "Chalk"],
];

export const RESOURCE_OPTIONS: Array<[ResourceKey, string, string]> = [
  ["water_acre_inches", "Irrigation water", "ac-in"],
  ["labor_hours", "Labor", "h"],
  ["nitrogen_lb", "Nitrogen", "lb"],
  ["seed_budget", "Seed budget", "USD"],
  ["input_budget", "Input budget", "USD"],
  ["total_budget", "Total budget", "USD"],
  ["acres", "Planted acres", "ac"],
  ["equipment_hours", "Equipment", "h"],
];

export const RAINFALL_OPTIONS: Array<["dry" | "normal" | "wet", string, string]> = [
  ["dry", "Dry year", "Yield −10%, irrigation demand +25%"],
  ["normal", "Normal year", "Crop defaults"],
  ["wet", "Wet year", "Yield −3%, irrigation demand −20%"],
];

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthDay(month: number | null | undefined, day: number | null | undefined): string {
  if (!month || !day) return "—";
  return `${MONTHS[month - 1]} ${day}`;
}

export function fitScheme(fit: PlantingFit | undefined | null): string {
  switch (fit) {
    case "optimal":
      return "green";
    case "late":
    case "early":
      return "yellow";
    case "outside":
      return "red";
    default:
      return "gray";
  }
}

export function fitLabel(fit: PlantingFit | undefined | null): string {
  switch (fit) {
    case "optimal":
      return "In window";
    case "late":
      return "Late";
    case "early":
      return "Early";
    case "outside":
      return "Outside window";
    default:
      return "No date";
  }
}

export function constraintScheme(status: ConstraintResult["status"]): string {
  switch (status) {
    case "violated":
      return "red";
    case "exceeded":
      return "orange";
    case "tight":
      return "yellow";
    default:
      return "green";
  }
}

export function fmtMoney(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "−" : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}`;
}

export function fmtDelta(value: number | null | undefined, money = false, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  if (Math.abs(value) < 0.005) return "±0";
  const sign = value > 0 ? "+" : "−";
  const body = money
    ? `$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: digits })}`
    : Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: digits });
  return `${sign}${body}`;
}

export function riskScheme(risk: number | null | undefined): string {
  if (risk === null || risk === undefined) return "gray";
  if (risk < 30) return "green";
  if (risk < 55) return "yellow";
  return "red";
}

/** Stable colour for a crop name when the API gives none. */
export function fallbackColor(name: string): string {
  const palette = ["#2F6F4E", "#D4A017", "#3D7EA6", "#8C5A3C", "#B05A7A", "#7CB518", "#C0392B", "#5C8A3C"];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}
