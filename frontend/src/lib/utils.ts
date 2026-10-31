import { format, formatDistanceToNow, parseISO, isValid } from "date-fns";
import type { Paginated, StatusLevel } from "@/types";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function unwrapList<T>(data: Paginated<T> | T[] | null | undefined): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : data.results ?? (data as unknown as T[]);
}

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

export function formatDate(value: string | null | undefined, fallback = "—"): string {
  const d = parseDate(value);
  return d ? format(d, "MMM d, yyyy") : fallback;
}

export function formatDateTime(value: string | null | undefined, fallback = "—"): string {
  const d = parseDate(value);
  return d ? format(d, "MMM d, yyyy h:mm a") : fallback;
}

export function formatTime(value: string | null | undefined, fallback = "—"): string {
  const d = parseDate(value);
  if (d) return format(d, "h:mm a");
  if (value && /^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  return fallback;
}

export function fromNow(value: string | null | undefined): string {
  const d = parseDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : "—";
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function formatAcres(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${formatNumber(value, value < 10 ? 1 : 0)} ac`;
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${formatNumber(value, 0)}%`;
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
