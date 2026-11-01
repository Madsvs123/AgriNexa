import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";
import { currentLanguage } from "./locale";
import { languageMeta } from "./config";

/**
 * Locale-aware formatting.
 *
 * These mirror the helpers in `lib/utils.ts` but resolve the active language at
 * call time, so a language switch re-renders into the new locale without any
 * component needing to thread a locale argument through.
 */

function dateLocale() {
  return languageMeta(currentLanguage()).dateFns;
}

function intl() {
  return languageMeta(currentLanguage()).intlLocale;
}

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

export function formatDate(value: string | null | undefined, fallback = "—"): string {
  const d = parseDate(value);
  return d ? format(d, "PP", { locale: dateLocale() }) : fallback;
}

export function formatDateTime(value: string | null | undefined, fallback = "—"): string {
  const d = parseDate(value);
  return d ? format(d, "PPp", { locale: dateLocale() }) : fallback;
}

export function formatTime(value: string | null | undefined, fallback = "—"): string {
  const d = parseDate(value);
  if (d) return format(d, "p", { locale: dateLocale() });
  if (value && /^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  return fallback;
}

/** Short month + day, for planting-window chips. */
export function formatMonthDay(value: string | null | undefined, fallback = "—"): string {
  const d = parseDate(value);
  return d ? format(d, "MMM d", { locale: dateLocale() }) : fallback;
}

export function fromNow(value: string | null | undefined): string {
  const d = parseDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true, locale: dateLocale() }) : "—";
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(intl(), {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(intl(), {
    style: "percent",
    maximumFractionDigits: digits,
  }).format(value / 100);
}

export function formatCurrency(
  value: number | null | undefined,
  currency = "USD",
  digits = 0,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(intl(), {
    style: "currency",
    currency,
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

/** Signed delta, for strategy comparison cells. */
export function formatDelta(
  value: number | null | undefined,
  { currency, digits = 0 }: { currency?: string; digits?: number } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  if (Math.abs(value) < 0.005) return "±0";
  const formatted = currency
    ? formatCurrency(Math.abs(value), currency, digits)
    : formatNumber(Math.abs(value), digits);
  return `${value > 0 ? "+" : "−"}${formatted}`;
}

/**
 * Wrap user-supplied text (farm, field, crop names) so a Latin name inside an
 * Arabic sentence — or the reverse — does not reorder surrounding punctuation.
 */
export const BIDI_ISOLATE = { unicodeBidi: "isolate", dir: "auto" } as const;
