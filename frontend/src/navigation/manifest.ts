import {
  Activity,
  BarChart3,
  Bell,
  Bug,
  ClipboardList,
  CloudSun,
  Coins,
  Droplets,
  FileText,
  FolderOpen,
  Building2,
  KeyRound,
  LayoutDashboard,
  Leaf,
  // Aliased: the bare name would shadow the global `Map` constructor used below.
  Map as MapIcon,
  MapPinned,
  Radio,
  Repeat,
  Settings,
  ShieldCheck,
  Sprout,
  Tractor,
  UserCircle,
  Users,
  Warehouse,
  CalendarRange,
  GitCompareArrows,
  Gauge,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for navigation.
 *
 * Routes, the nav rail, section panels, breadcrumbs, document titles, and the
 * command palette's "Go to" results are all derived from this array. Previously
 * `App.tsx` and `Sidebar.tsx` maintained the route list twice and had already
 * drifted — `/scouting/treatments`, `/notifications`, and `/search` were
 * routable but unreachable from the sidebar.
 */

export type SectionId = "home" | "land" | "grow" | "operate" | "insights" | "settings";

/** Scope dimensions a route actually uses, so the scope picker only offers what matters. */
export type ScopeKey = "farm" | "season";

export interface NavSection {
  id: SectionId;
  icon: LucideIcon;
  /** Where the rail sends you when you click the section. */
  home: string;
  /** Settings sits at the rail's foot, away from the primary five. */
  footer?: boolean;
}

export interface NavRoute {
  id: string;
  section: SectionId;
  path: string;
  icon?: LucideIcon;
  scope?: ScopeKey[];
  /** Hidden from the section panel but still routable and searchable. */
  hidden?: boolean;
  /** Excluded from the palette too (detail/form routes with no standalone meaning). */
  unlisted?: boolean;
  /** Parent route id, for breadcrumb chains. */
  parent?: string;
  /** Canvas page: the shell drops its padding and the page owns the viewport. */
  fullBleed?: boolean;
}

export const SECTIONS: NavSection[] = [
  { id: "home", icon: LayoutDashboard, home: "/home" },
  { id: "land", icon: MapPinned, home: "/map" },
  { id: "grow", icon: Sprout, home: "/crops/plans" },
  { id: "operate", icon: Droplets, home: "/irrigation" },
  { id: "insights", icon: BarChart3, home: "/analytics" },
  { id: "settings", icon: Settings, home: "/settings", footer: true },
];

export const ROUTES: NavRoute[] = [
  // ── Home ────────────────────────────────────────────────────────────────
  {
    id: "dashboard",
    section: "home",
    path: "/home",
    icon: LayoutDashboard,
    scope: ["season"],
  },
  {
    id: "notifications",
    section: "home",
    path: "/notifications",
    icon: Bell,
    hidden: true,
  },
  {
    id: "search",
    section: "home",
    path: "/search",
    hidden: true,
    unlisted: true,
  },

  // ── Land ────────────────────────────────────────────────────────────────
  {
    id: "map",
    section: "land",
    path: "/map",
    icon: MapIcon,
    scope: ["farm"],
    fullBleed: true,
  },
  {
    id: "farms",
    section: "land",
    path: "/farms",
    icon: MapPinned,
  },
  {
    id: "farm-new",
    section: "land",
    path: "/farms/new",
    parent: "farms",
    hidden: true,
  },
  {
    id: "farm-detail",
    section: "land",
    path: "/farms/:id",
    parent: "farms",
    hidden: true,
    unlisted: true,
  },
  {
    id: "farm-edit",
    section: "land",
    path: "/farms/:id/edit",
    parent: "farm-detail",
    hidden: true,
    unlisted: true,
  },
  {
    id: "fields",
    section: "land",
    path: "/fields",
    icon: Sprout,
    scope: ["farm"],
  },
  {
    id: "field-new",
    section: "land",
    path: "/fields/new",
    parent: "fields",
    hidden: true,
  },
  {
    id: "field-detail",
    section: "land",
    path: "/fields/:id",
    parent: "fields",
    hidden: true,
    unlisted: true,
  },
  {
    id: "field-edit",
    section: "land",
    path: "/fields/:id/edit",
    parent: "field-detail",
    hidden: true,
    unlisted: true,
  },

  // ── Grow ────────────────────────────────────────────────────────────────
  {
    id: "crop-plans",
    section: "grow",
    path: "/crops/plans",
    icon: ClipboardList,
    scope: ["farm", "season"],
  },
  {
    id: "crop-plan-detail",
    section: "grow",
    path: "/crops/plans/:id",
    parent: "crop-plans",
    hidden: true,
    unlisted: true,
  },
  {
    id: "strategies",
    section: "grow",
    path: "/crops/strategies",
    icon: GitCompareArrows,
    scope: ["farm", "season"],
  },
  {
    id: "strategy-compare",
    section: "grow",
    path: "/crops/strategies/compare",
    parent: "strategies",
    hidden: true,
  },
  {
    id: "strategy-detail",
    section: "grow",
    path: "/crops/strategies/:id",
    parent: "strategies",
    hidden: true,
    unlisted: true,
  },
  {
    id: "rotations",
    section: "grow",
    path: "/crops/rotations",
    icon: Repeat,
    scope: ["farm"],
  },
  {
    id: "rotation-detail",
    section: "grow",
    path: "/crops/rotations/:id",
    parent: "rotations",
    hidden: true,
    unlisted: true,
  },
  {
    id: "crops",
    section: "grow",
    path: "/crops",
    icon: Leaf,
  },
  {
    id: "varieties",
    section: "grow",
    path: "/crops/varieties",
    parent: "crops",
    hidden: true,
  },
  {
    id: "planting-windows",
    section: "grow",
    path: "/crops/windows",
    parent: "crops",
    hidden: true,
  },
  {
    id: "constraints",
    section: "grow",
    path: "/crops/constraints",
    icon: Gauge,
    scope: ["farm", "season"],
  },
  {
    id: "seasons",
    section: "grow",
    path: "/crops/seasons",
    icon: CalendarRange,
  },
  {
    id: "budget",
    section: "grow",
    path: "/crops/budget",
    icon: Coins,
    scope: ["farm", "season"],
  },

  // ── Operate ─────────────────────────────────────────────────────────────
  {
    id: "irrigation",
    section: "operate",
    path: "/irrigation",
    icon: Droplets,
    scope: ["farm"],
  },
  {
    id: "irrigation-zone",
    section: "operate",
    path: "/irrigation/zones/:id",
    parent: "irrigation",
    hidden: true,
    unlisted: true,
  },
  {
    id: "sensors",
    section: "operate",
    path: "/sensors",
    icon: Radio,
    scope: ["farm"],
  },
  {
    id: "sensor-detail",
    section: "operate",
    path: "/sensors/:id",
    parent: "sensors",
    hidden: true,
    unlisted: true,
  },
  {
    id: "weather",
    section: "operate",
    path: "/weather",
    icon: CloudSun,
    scope: ["farm"],
  },
  {
    id: "scouting",
    section: "operate",
    path: "/scouting",
    icon: Bug,
    scope: ["farm"],
  },
  {
    id: "scout-new",
    section: "operate",
    path: "/scouting/new",
    parent: "scouting",
    hidden: true,
  },
  {
    id: "treatments",
    section: "operate",
    path: "/scouting/treatments",
    icon: ShieldCheck,
  },
  {
    id: "scout-detail",
    section: "operate",
    path: "/scouting/:id",
    parent: "scouting",
    hidden: true,
    unlisted: true,
  },
  {
    id: "equipment",
    section: "operate",
    path: "/equipment",
    icon: Tractor,
    scope: ["farm"],
  },
  {
    id: "equipment-detail",
    section: "operate",
    path: "/equipment/:id",
    parent: "equipment",
    hidden: true,
    unlisted: true,
  },
  {
    id: "inventory",
    section: "operate",
    path: "/inventory",
    icon: Warehouse,
  },
  {
    id: "inventory-detail",
    section: "operate",
    path: "/inventory/:id",
    parent: "inventory",
    hidden: true,
    unlisted: true,
  },
  {
    id: "tasks",
    section: "operate",
    path: "/tasks",
    icon: Activity,
  },

  // ── Insights ────────────────────────────────────────────────────────────
  {
    id: "analytics",
    section: "insights",
    path: "/analytics",
    icon: BarChart3,
    scope: ["season"],
  },
  {
    id: "reports",
    section: "insights",
    path: "/reports",
    icon: FileText,
  },
  {
    id: "documents",
    section: "insights",
    path: "/documents",
    icon: FolderOpen,
  },

  // ── Settings ────────────────────────────────────────────────────────────
  {
    id: "settings",
    section: "settings",
    path: "/settings",
    icon: Settings,
  },
  {
    id: "organization",
    section: "settings",
    path: "/settings/organization",
    icon: Building2,
  },
  {
    id: "team",
    section: "settings",
    path: "/settings/team",
    icon: Users,
  },
  {
    id: "roles",
    section: "settings",
    path: "/settings/roles",
    icon: KeyRound,
  },
  {
    id: "invitations",
    section: "settings",
    path: "/settings/invitations",
    icon: Users,
  },
  {
    id: "access",
    section: "settings",
    path: "/settings/access",
    icon: ShieldCheck,
  },
  {
    id: "profile",
    section: "settings",
    path: "/settings/profile",
    icon: UserCircle,
  },
];

const BY_ID = new Map(ROUTES.map((r) => [r.id, r]));

export function routeById(id: string): NavRoute | undefined {
  return BY_ID.get(id);
}

export function sectionRoutes(section: SectionId): NavRoute[] {
  return ROUTES.filter((r) => r.section === section && !r.hidden);
}

/** Routes offered as "Go to" destinations in the command palette. */
export const PALETTE_ROUTES = ROUTES.filter((r) => !r.unlisted && !r.path.includes(":"));

/** A route with its label and keywords resolved in the active language. */
export interface LocalizedRoute extends NavRoute {
  label: string;
  keywords: string[];
  sectionLabel: string;
}

/**
 * Score a route against a query. Higher is better; 0 means no match.
 *
 * Operates on the localized label and keywords, so typing "riego" finds
 * Irrigation in Spanish and "ري" finds it in Arabic.
 */
export function scoreRoute(route: LocalizedRoute, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const label = route.label.toLowerCase();
  if (label === q) return 100;
  if (label.startsWith(q)) return 80;
  if (label.includes(q)) return 60;
  if (route.sectionLabel.toLowerCase().startsWith(q)) return 45;
  for (const kw of route.keywords) {
    const k = kw.trim().toLowerCase();
    if (!k) continue;
    if (k === q) return 50;
    if (k.startsWith(q)) return 40;
    if (k.includes(q)) return 25;
  }
  return 0;
}

/** Convert a concrete pathname into the manifest route that produced it. */
export function matchRoute(pathname: string): NavRoute | undefined {
  const exact = ROUTES.find((r) => r.path === pathname);
  if (exact) return exact;
  // Longest pattern first so `/farms/:id/edit` wins over `/farms/:id`.
  const candidates = ROUTES.filter((r) => r.path.includes(":")).sort(
    (a, b) => b.path.split("/").length - a.path.split("/").length,
  );
  for (const route of candidates) {
    const pattern = route.path.split("/");
    const actual = pathname.split("/");
    if (pattern.length !== actual.length) continue;
    const ok = pattern.every((part, i) => part.startsWith(":") || part === actual[i]);
    if (ok) return route;
  }
  return undefined;
}

export function sectionForPath(pathname: string): SectionId {
  return matchRoute(pathname)?.section ?? "home";
}

export interface Crumb {
  label: string;
  path?: string;
}

/** The chain of routes from a section root down to `pathname`. */
export function routeChain(pathname: string): NavRoute[] {
  const route = matchRoute(pathname);
  if (!route) return [];
  const chain: NavRoute[] = [];
  let cursor: NavRoute | undefined = route;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    chain.unshift(cursor);
    cursor = cursor.parent ? BY_ID.get(cursor.parent) : undefined;
  }
  return chain;
}

/**
 * Breadcrumb chain for a pathname.
 *
 * `labelFor` resolves a route id to its name in the active language;
 * `leafLabel` overrides the last crumb with a record's own name, which is
 * user data and never translated.
 */
export function breadcrumbsFor(
  pathname: string,
  labelFor: (id: string) => string,
  leafLabel?: string,
): Crumb[] {
  const chain = routeChain(pathname);
  return chain.map((r, i) => {
    const isLeaf = i === chain.length - 1;
    return {
      label: isLeaf && leafLabel ? leafLabel : labelFor(r.id),
      path: isLeaf || r.path.includes(":") ? undefined : r.path,
    };
  });
}
