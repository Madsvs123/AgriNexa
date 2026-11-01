import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  PALETTE_ROUTES,
  ROUTES,
  SECTIONS,
  sectionRoutes,
  type LocalizedRoute,
  type NavRoute,
  type SectionId,
} from "./manifest";

/**
 * Navigation labels in the active language.
 *
 * The manifest holds structure only (ids, paths, icons, parents); every
 * human-readable string lives in the `nav` catalogue, keyed by route id. That
 * keeps one source of truth per language and lets `check-navigation` assert
 * no route is missing a name in any of them.
 */
export function useNavLabels() {
  const { t } = useTranslation("nav");

  const labelFor = useCallback((id: string) => t(`routes.${id}.label`, id), [t]);
  const sectionLabelFor = useCallback((id: SectionId) => t(`sections.${id}`, id), [t]);
  const keywordsFor = useCallback(
    (id: string) =>
      t(`routes.${id}.keywords`, "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    [t],
  );

  const localize = useCallback(
    (route: NavRoute): LocalizedRoute => ({
      ...route,
      label: labelFor(route.id),
      keywords: keywordsFor(route.id),
      sectionLabel: sectionLabelFor(route.section),
    }),
    [labelFor, keywordsFor, sectionLabelFor],
  );

  return { t, labelFor, sectionLabelFor, keywordsFor, localize };
}

/** Sections with translated labels, in manifest order. */
export function useSections() {
  const { sectionLabelFor } = useNavLabels();
  return useMemo(
    () => SECTIONS.map((s) => ({ ...s, label: sectionLabelFor(s.id) })),
    [sectionLabelFor],
  );
}

/** Visible routes for one section, translated. */
export function useSectionRoutes(section: SectionId): LocalizedRoute[] {
  const { localize } = useNavLabels();
  return useMemo(() => sectionRoutes(section).map(localize), [section, localize]);
}

/** Every route the command palette can jump to, translated. */
export function usePaletteRoutes(): LocalizedRoute[] {
  const { localize } = useNavLabels();
  return useMemo(() => PALETTE_ROUTES.map(localize), [localize]);
}

/** All routes, translated — used by the nav parity check in tests. */
export function useAllRoutes(): LocalizedRoute[] {
  const { localize } = useNavLabels();
  return useMemo(() => ROUTES.map(localize), [localize]);
}
