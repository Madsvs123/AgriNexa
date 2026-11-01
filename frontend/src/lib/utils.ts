import type { Paginated, StatusLevel } from "@/types";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function unwrapList<T>(data: Paginated<T> | T[] | null | undefined): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : data.results ?? (data as unknown as T[]);
}

/**
 * Date and number formatting.
 *
 * These delegate to `@/i18n/format`, which resolves the active language at
 * call time. Re-exporting here keeps the 46 modules that already import from
 * `lib/utils` working, and means a call site cannot accidentally use a
 * locale-blind formatter.
 */
export {
  parseDate,
  formatDate,
  formatDateTime,
  formatTime,
  formatMonthDay,
  fromNow,
  formatNumber,
  formatCurrency,
  formatDelta,
} from "@/i18n/format";

import i18n from "@/i18n";
import { formatNumber as formatNumberLocalized } from "@/i18n/format";

/**
 * Acreage with its unit.
 *
 * Acres stay the unit of record in every language — the domain model, the
 * agronomy, and the stored data are all imperial. Only the word is
 * translated; converting to hectares is a separate change that would have to
 * touch yields, water, and seeding rates together.
 */
export function formatAcres(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return i18n.t("units.acresShort", {
    ns: "common",
    value: formatNumberLocalized(value, value < 10 ? 1 : 0),
  });
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return formatNumberLocalized(value, 0) + "%";
}

export function displayName(first?: string, last?: string, email?: string): string {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || email || "Account";
}

export function initials(first?: string, last?: string, email?: string): string {
  if (first || last) return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "A";
  return (email?.[0] ?? "A").toUpperCase();
}

export function statusTone(status: string | undefined | null): StatusLevel {
  const s = (status ?? "idle").toLowerCase();
  if (["healthy", "ok", "active", "online", "ready", "done", "completed", "in_use"].includes(s)) {
    return "healthy";
  }
  if (["warning", "warn", "low", "delayed", "pending", "maintenance"].includes(s)) return "warning";
  if (["critical", "error", "offline", "danger", "high", "blocked", "failed"].includes(s)) {
    return "critical";
  }
  return "idle";
}

export function healthColor(status: string | undefined | null): string {
  const tone = statusTone(status);
  if (tone === "healthy") return "#7CB518";
  if (tone === "warning") return "#D4A017";
  if (tone === "critical") return "#B42318";
  return "#5C6B63";
}

export function seasonParams(seasonId: string | null): Record<string, unknown> {
  return seasonId ? { season_id: seasonId } : {};
}

export function wsUrl(path: string, token: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${path}?token=${encodeURIComponent(token)}`;
}
