import type { ConstraintResult, PlantingFit, PlantingSystem, ResourceKey } from "@/types";

/**
 * Option codes. Labels and descriptions live in the `grow` catalogue under
 * `options.*`, so a value is stored once and named once per language.
 */
export const PLANTING_SYSTEMS: PlantingSystem[] = [
  "monoculture",
  "intercrop",
  "relay",
  "strip",
  "cover",
];

export const CROP_CATEGORIES = [
  "grain",
  "oilseed",
  "legume",
  "vegetable",
  "fruit",
  "forage",
  "fiber",
  "cover",
  "other",
] as const;

export const SOIL_OPTIONS = [
  "clay",
  "clay_loam",
  "loam",
  "silt_loam",
  "silty clay loam",
  "silt",
  "sandy_loam",
  "sand",
  "peat",
  "chalk",
] as const;

/** Resource code paired with its unit; the unit is not translated. */
export const RESOURCE_OPTIONS: Array<[ResourceKey, string]> = [
  ["water_acre_inches", "ac-in"],
  ["labor_hours", "h"],
  ["nitrogen_lb", "lb"],
  ["seed_budget", "USD"],
  ["input_budget", "USD"],
  ["total_budget", "USD"],
  ["acres", "ac"],
  ["equipment_hours", "h"],
];

export const RAINFALL_OPTIONS = ["dry", "normal", "wet"] as const;

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
