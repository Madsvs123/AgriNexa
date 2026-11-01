import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { PlantingFit, PlantingSystem, ResourceKey } from "@/types";

/**
 * Names for the planning domain's coded values.
 *
 * The API stores and returns codes (`clay_loam`, `intercrop`, `dry`); every
 * label is resolved here so a value has one spelling per language and the
 * select options, table cells, and badges can never disagree.
 */
export function usePlanningLabels() {
  const { t } = useTranslation("grow");

  const plantingSystem = useCallback((v: PlantingSystem) => t(`options.plantingSystem.${v}.label`, v), [t]);
  const plantingSystemHint = useCallback((v: PlantingSystem) => t(`options.plantingSystem.${v}.hint`, ""), [t]);
  const cropCategory = useCallback((v: string) => t(`options.cropCategory.${v}`, v), [t]);
  const soil = useCallback(
    // Legacy rows store a display string ("silt loam") rather than a key.
    (v: string) => t(`options.soil.${v.replace(/ /g, "_")}`, v),
    [t],
  );
  const resource = useCallback((v: ResourceKey) => t(`options.resource.${v}`, v), [t]);
  const rainfall = useCallback((v: string) => t(`options.rainfall.${v}.label`, v), [t]);
  const rainfallHint = useCallback((v: string) => t(`options.rainfall.${v}.hint`, ""), [t]);
  const waterNeed = useCallback((v: string) => t(`options.waterNeed.${v}`, v), [t]);
  const rootDepth = useCallback((v: string) => t(`options.rootDepth.${v}`, v), [t]);
  const planStatus = useCallback((v: string) => t(`options.planStatus.${v}`, v), [t]);
  const strategyStatus = useCallback((v: string) => t(`options.strategyStatus.${v}`, v), [t]);
  const stepRole = useCallback((v: string) => t(`options.stepRole.${v}`, v), [t]);
  const componentRole = useCallback((v: string) => t(`options.componentRole.${v}`, v), [t]);
  const budgetCategory = useCallback((v: string) => t(`options.budgetCategory.${v}`, v), [t]);
  const constraintStatus = useCallback((v: string) => t(`options.constraintStatus.${v}`, v), [t]);
  const fit = useCallback((v: PlantingFit | undefined | null) => t(`options.fit.${v ?? "unknown"}`, ""), [t]);

  return {
    t,
    plantingSystem,
    plantingSystemHint,
    cropCategory,
    soil,
    resource,
    rainfall,
    rainfallHint,
    waterNeed,
    rootDepth,
    planStatus,
    strategyStatus,
    stepRole,
    componentRole,
    budgetCategory,
    constraintStatus,
    fit,
  };
}
