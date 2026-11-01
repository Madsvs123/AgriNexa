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
  label: string;
  icon: LucideIcon;
  /** Where the rail sends you when you click the section. */
  home: string;
  /** Settings sits at the rail's foot, away from the primary five. */
  footer?: boolean;
}

export interface NavRoute {
  id: string;
  section: SectionId;
  label: string;
  path: string;
  icon?: LucideIcon;
  /** Extra terms the command palette matches on. */
  keywords?: string[];
  scope?: ScopeKey[];
  /** Hidden from the section panel but still routable and searchable. */
  hidden?: boolean;
  /** Excluded from the palette too (detail/form routes with no standalone meaning). */
  unlisted?: boolean;
  /** Parent route id, for breadcrumb chains. */
  parent?: string;
  /** Breadcrumb/title override when the path carries a record name. */
  title?: string;
  /** Canvas page: the shell drops its padding and the page owns the viewport. */
  fullBleed?: boolean;
}

export const SECTIONS: NavSection[] = [
  { id: "home", label: "Home", icon: LayoutDashboard, home: "/home" },
  { id: "land", label: "Land", icon: MapPinned, home: "/map" },
  { id: "grow", label: "Grow", icon: Sprout, home: "/crops/plans" },
  { id: "operate", label: "Operate", icon: Droplets, home: "/irrigation" },
  { id: "insights", label: "Insights", icon: BarChart3, home: "/analytics" },
  { id: "settings", label: "Settings", icon: Settings, home: "/settings", footer: true },
];

export const ROUTES: NavRoute[] = [
  // ── Home ────────────────────────────────────────────────────────────────
  {
    id: "dashboard",
    section: "home",
    label: "Dashboard",
    path: "/home",
    icon: LayoutDashboard,
    keywords: ["overview", "kpi", "summary", "today"],
    scope: ["season"],
  },
  {
    id: "notifications",
    section: "home",
    label: "Notifications",
    path: "/notifications",
    icon: Bell,
    keywords: ["alerts", "inbox"],
    hidden: true,
  },
  {
    id: "search",
    section: "home",
    label: "Search results",
    path: "/search",
    keywords: ["find"],
    hidden: true,
    unlisted: true,
  },

  // ── Land ────────────────────────────────────────────────────────────────
  {
    id: "map",
    section: "land",
    label: "Farm map",
    path: "/map",
    icon: MapIcon,
    keywords: ["boundaries", "gis", "layers", "satellite", "soil", "plots"],
    scope: ["farm"],
    fullBleed: true,
  },
  {
    id: "farms",
    section: "land",
    label: "Farms",
    path: "/farms",
    icon: MapPinned,
    keywords: ["properties", "sites", "ranch"],
  },
  {
    id: "farm-new",
    section: "land",
    label: "Add farm",
    path: "/farms/new",
    parent: "farms",
    hidden: true,
  },
  {
    id: "farm-detail",
    section: "land",
    label: "Farm",
    path: "/farms/:id",
    parent: "farms",
    hidden: true,
    unlisted: true,
  },
  {
    id: "farm-edit",
    section: "land",
    label: "Edit farm",
    path: "/farms/:id/edit",
    parent: "farm-detail",
    hidden: true,
    unlisted: true,
  },
  {
    id: "fields",
    section: "land",
    label: "Fields",
    path: "/fields",
    icon: Sprout,
    keywords: ["acres", "parcels", "boundaries", "soil"],
    scope: ["farm"],
  },
  {
    id: "field-new",
    section: "land",
    label: "Add field",
    path: "/fields/new",
    parent: "fields",
    hidden: true,
  },
  {
    id: "field-detail",
    section: "land",
    label: "Field",
    path: "/fields/:id",
    parent: "fields",
    hidden: true,
    unlisted: true,
  },
  {
    id: "field-edit",
    section: "land",
    label: "Edit field",
    path: "/fields/:id/edit",
    parent: "field-detail",
    hidden: true,
    unlisted: true,
  },

  // ── Grow ────────────────────────────────────────────────────────────────
  {
    id: "crop-plans",
    section: "grow",
    label: "Crop plans",
    path: "/crops/plans",
    icon: ClipboardList,
    keywords: ["planting", "seasonal plan", "schedule"],
    scope: ["season"],
  },
  {
    id: "crop-plan-detail",
    section: "grow",
    label: "Crop plan",
    path: "/crops/plans/:id",
    parent: "crop-plans",
    hidden: true,
    unlisted: true,
  },
  {
    id: "crops",
    section: "grow",
    label: "Catalog",
    path: "/crops",
    icon: Leaf,
    keywords: ["crops", "corn", "soy", "wheat"],
  },
  {
    id: "varieties",
    section: "grow",
    label: "Varieties",
    path: "/crops/varieties",
    icon: Sprout,
    keywords: ["hybrid", "cultivar", "seed"],
  },
  {
    id: "seasons",
    section: "grow",
    label: "Seasons",
    path: "/crops/seasons",
    icon: CalendarRange,
    keywords: ["year", "cycle"],
  },
  {
    id: "rotations",
    section: "grow",
    label: "Rotations",
    path: "/crops/rotations",
    icon: Repeat,
    keywords: ["sequence", "cover crop"],
  },
  {
    id: "budget",
    section: "grow",
    label: "Budget",
    path: "/crops/budget",
    icon: Coins,
    keywords: ["cost", "spend", "margin", "expenses"],
    scope: ["season"],
  },

  // ── Operate ─────────────────────────────────────────────────────────────
  {
    id: "irrigation",
    section: "operate",
    label: "Irrigation",
    path: "/irrigation",
    icon: Droplets,
    keywords: ["water", "zones", "pivot", "drip", "schedule"],
    scope: ["farm"],
  },
  {
    id: "irrigation-zone",
    section: "operate",
    label: "Zone",
    path: "/irrigation/zones/:id",
    parent: "irrigation",
    hidden: true,
    unlisted: true,
  },
  {
    id: "sensors",
    section: "operate",
    label: "Sensors",
    path: "/sensors",
    icon: Radio,
    keywords: ["probes", "moisture", "telemetry", "iot"],
    scope: ["farm"],
  },
  {
    id: "sensor-detail",
    section: "operate",
    label: "Sensor",
    path: "/sensors/:id",
    parent: "sensors",
    hidden: true,
    unlisted: true,
  },
  {
    id: "weather",
    section: "operate",
    label: "Weather",
    path: "/weather",
    icon: CloudSun,
    keywords: ["forecast", "rain", "wind", "frost", "gdd"],
    scope: ["farm"],
  },
  {
    id: "scouting",
    section: "operate",
    label: "Scouting",
    path: "/scouting",
    icon: Bug,
    keywords: ["pest", "disease", "weeds", "walk", "report"],
    scope: ["farm"],
  },
  {
    id: "scout-new",
    section: "operate",
    label: "New scout report",
    path: "/scouting/new",
    parent: "scouting",
    hidden: true,
  },
  {
    id: "treatments",
    section: "operate",
    label: "Treatments",
    path: "/scouting/treatments",
    icon: ShieldCheck,
    keywords: ["spray", "pesticide", "application", "chemical"],
  },
  {
    id: "scout-detail",
    section: "operate",
    label: "Scout report",
    path: "/scouting/:id",
    parent: "scouting",
    hidden: true,
    unlisted: true,
  },
  {
    id: "equipment",
    section: "operate",
    label: "Equipment",
    path: "/equipment",
    icon: Tractor,
    keywords: ["machinery", "tractor", "planter", "maintenance", "fuel"],
    scope: ["farm"],
  },
  {
    id: "equipment-detail",
    section: "operate",
    label: "Equipment",
    path: "/equipment/:id",
    parent: "equipment",
    hidden: true,
    unlisted: true,
  },
  {
    id: "inventory",
    section: "operate",
    label: "Inventory",
    path: "/inventory",
    icon: Warehouse,
    keywords: ["stock", "seed", "fertilizer", "chemical", "sku", "reorder"],
  },
  {
    id: "inventory-detail",
    section: "operate",
    label: "Item",
    path: "/inventory/:id",
    parent: "inventory",
    hidden: true,
    unlisted: true,
  },
  {
    id: "tasks",
    section: "operate",
    label: "Tasks",
    path: "/tasks",
    icon: Activity,
    keywords: ["todo", "work orders", "assignments", "board"],
  },

  // ── Insights ────────────────────────────────────────────────────────────
  {
    id: "analytics",
    section: "insights",
    label: "Analytics",
    path: "/analytics",
    icon: BarChart3,
    keywords: ["yield", "water", "cost", "trends", "charts"],
    scope: ["season"],
  },
  {
    id: "reports",
    section: "insights",
    label: "Reports",
    path: "/reports",
    icon: FileText,
    keywords: ["export", "pdf", "csv", "generate"],
  },
  {
    id: "documents",
    section: "insights",
    label: "Documents",
    path: "/documents",
    icon: FolderOpen,
    keywords: ["files", "contracts", "uploads", "attachments"],
  },

  // ── Settings ────────────────────────────────────────────────────────────
  {
    id: "settings",
    section: "settings",
    label: "Overview",
    path: "/settings",
    icon: Settings,
    keywords: ["preferences", "configuration"],
  },
  {
    id: "organization",
    section: "settings",
    label: "Organization",
    path: "/settings/organization",
    icon: Building2,
    keywords: ["company", "tenant", "billing"],
  },
  {
    id: "team",
    section: "settings",
    label: "Team",
    path: "/settings/team",
    icon: Users,
    keywords: ["members", "people", "staff"],
  },
  {
    id: "roles",
    section: "settings",
    label: "Roles",
    path: "/settings/roles",
    icon: KeyRound,
    keywords: ["permissions", "access control"],
  },
  {
    id: "invitations",
    section: "settings",
    label: "Invitations",
    path: "/settings/invitations",
    icon: Users,
    keywords: ["invite", "onboard"],
  },
  {
    id: "access",
    section: "settings",
    label: "Farm access",
    path: "/settings/access",
    icon: ShieldCheck,
    keywords: ["permissions", "grants", "scoping"],
  },
  {
    id: "profile",
    section: "settings",
    label: "Profile",
    path: "/settings/profile",
    icon: UserCircle,
    keywords: ["account", "me", "password"],
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

/** Score a route against a query. Higher is better; 0 means no match. */
export function scoreRoute(route: NavRoute, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const label = route.label.toLowerCase();
  if (label === q) return 100;
  if (label.startsWith(q)) return 80;
  if (label.includes(q)) return 60;
  const section = route.section.toLowerCase();
  if (section.startsWith(q)) return 45;
  for (const kw of route.keywords ?? []) {
    const k = kw.toLowerCase();
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

/** Breadcrumb chain for a pathname, walking `parent` links up the manifest. */
export function breadcrumbsFor(pathname: string, leafLabel?: string): Crumb[] {
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
  return chain.map((r, i) => {
    const isLeaf = i === chain.length - 1;
    return {
      label: isLeaf ? leafLabel ?? r.title ?? r.label : r.title ?? r.label,
      path: isLeaf || r.path.includes(":") ? undefined : r.path,
    };
  });
}
