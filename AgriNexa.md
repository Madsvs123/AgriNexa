# AgriNexa — Platform Documentation

AgriNexa is a multi-tenant precision-farming operations center for farms, agribusinesses, crop consultants, and field teams. It brings field records, crop plans, live sensors, maps, irrigation, scouting, weather, inventory, equipment, and analytics into one application.

This document describes the platform as it exists today: architecture, features, the full REST/WebSocket API surface, frontend pages, data model, and operational details.

---

## 1. Architecture & Stack

| Layer | Technology |
|---|---|
| Backend API | Django 5.1 + Django REST Framework 3.15 |
| Auth | JWT (djangorestframework-simplejwt) with rotation + blacklist |
| Realtime | Django Channels 4 + Daphne (WebSockets over Redis channel layer) |
| Background jobs | Celery 5.4 + django-celery-beat (database scheduler) |
| Database | PostgreSQL (psycopg 3) |
| Cache / broker | Redis (channel layer, Celery broker, result backend) |
| Frontend | React 18 + TypeScript 5.6 + Vite 5 |
| UI library | Chakra UI v2 with a custom theme, light & dark color modes |
| Client state | Zustand (auth session, current organization, UI state) |
| Server state | TanStack Query v5 |
| Routing | React Router v6 |
| Maps | Leaflet / react-leaflet (OpenStreetMap + Esri satellite tiles), leaflet-geoman for boundary drawing/editing |
| Charts | Recharts |
| Icons | lucide-react |

### Repository layout

```
AgriNexa/
├── AgriNexa.md          ← this document
├── README.md            ← setup instructions
├── backend/
│   ├── agrinexa/        ← settings, urls, asgi/wsgi, celery, ws routing
│   └── apps/            ← 13 Django apps (see §5)
└── frontend/
    └── src/
        ├── api/client.ts     ← typed API client (axios)
        ├── theme.ts          ← Chakra theme (brand palette, semantic tokens)
        ├── stores/           ← Zustand stores (auth, ui)
        ├── hooks/            ← useSensorSocket
        ├── components/       ← ui/ (shared primitives) + layout/ (shell)
        ├── pages/            ← 35 route pages (see §4)
        └── types/index.ts    ← domain TypeScript types
```

### Dev topology

- Django dev server: `http://127.0.0.1:8000`
- Vite dev server: `http://localhost:5173`, proxying `/api`, `/media`, and `/ws` (with WebSocket upgrade) to the backend.
- Demo data: `python manage.py seed_demo` creates the **Green Valley Cooperative** org with farms, fields, and sensors. Demo users: `farmer@agrinexa.local`, `manager@agrinexa.local`, `operator@agrinexa.local` — password `Farmland#2026`.

---

## 2. Multi-Tenancy & Security Model

### Organizations and membership
Every business record belongs to an **Organization**. Users join organizations through **Memberships**, each carrying a **Role** (with a JSON permission list) and an `is_owner` flag. **Teams** group members inside an org. **FarmAccess** grants optionally restrict a member to specific farms with `can_view` / `can_edit` / `can_manage` levels.

### Request scoping
- API clients authenticate with a **JWT Bearer token** and select the active org with the **`X-Organization-ID`** request header (falls back to the user's first owned/active membership).
- `OrganizationMiddleware` resolves `request.organization` (performing JWT auth itself for API clients), and every tenant viewset filters its queryset by that organization. Writes that reference another organization's records through foreign keys are rejected (`OrgScopedWriteMixin`).
- Object-level `FarmAccessPermission` enforces per-farm restrictions for members who have FarmAccess rows.

### Security guarantees (enforced and test-covered)
- Cross-tenant isolation: an org member can never list or reference another org's data.
- Farm-access scoping is enforced on **every** read path, including global search. `apps/common/scoping.accessible_farm_ids` is the single resolver; `OrganizationQuerySetMixin` and `SearchView` both go through it so they cannot diverge. (Search previously filtered on organization alone, leaking the names of farms, fields, and equipment to members without a grant.)
- Invitation tokens are **never returned by the API** (email-only); accepting an invite never issues tokens for an existing account (the user must sign in first), never demotes an owner, and only grants farms belonging to the inviting org.
- `is_owner`, `is_system` (roles), and `is_active` (orgs) are read-only through the API; system roles cannot be edited or deleted.
- Built-in (global) sensor types cannot be modified or deleted by tenants.
- Sensor WebSocket streams require an active membership in the farm's organization.
- Registration enforces Django's password validators; login is case-insensitive on email.

### Auth flow
1. `POST /api/auth/register/` — creates user + organization + default roles, returns `{access, refresh, user, organizations}`.
2. `POST /api/auth/login/` — email + password, same response shape.
3. Access tokens live 60 min (`JWT_ACCESS_MINUTES`), refresh 14 days (`JWT_REFRESH_DAYS`), rotated and blacklisted on refresh.
4. The frontend stores the refresh token in localStorage, bootstraps sessions on reload via `POST /api/auth/refresh/`, auto-refreshes on 401 responses, and `POST /api/auth/logout/` blacklists the refresh token.

---

## 3. Feature Overview

| Domain | Capabilities |
|---|---|
| **Dashboard** | Season KPIs (acres, active fields, yield estimate, open alerts, water used, equipment uptime), crop progress bars, irrigation snapshot, current weather, field-health heatmap, expense chart, low-stock / sensor-alert / task feeds, yield-vs-target chart |
| **Farms & Fields** | Regions → Farms → Fields → Plots hierarchy; GeoJSON field boundaries with spatial validation; field notes; crop history; per-farm access matrix |
| **Farm mapping** | Interactive boundary editor (draw/edit/clear polygons & rectangles with live acreage), plot subdivisions constrained to their field with overlap protection, typed soil layers (clay/loam/sand/… with pH & organic matter) rendered as colored overlays, per-field elevation estimates (Open-Meteo terrain with offline fallback, cached), map controls (recenter, basemap switch, scale bar, layer toggles) |
| **Crops** | Crop catalog, varieties, growing seasons, seasonal crop plans (with Gantt timeline), rotation plans, planting schedules, fertilizer plans, pesticide applications, seasonal budgets |
| **Map** | Interactive Leaflet map with satellite/street layers, field polygons colored by health, plot-subdivision and soil-layer overlays, sensor and equipment markers, irrigation-zone overlays, layer toggles, recenter and scale controls |
| **Sensors** | Sensor types (built-in + custom), device registry, readings time-series with date-range filtering, device health, live readings, real-time stream over WebSocket |
| **Irrigation** | Zones with moisture thresholds, schedules, water-usage records, automated recommendations (evaluated every 15 min), manual zone override, irrigation analytics |
| **Weather** | Stations per farm, current conditions, forecast (refreshed every 30 min; OpenWeather key optional), history with date ranges, alerts (frost/heat, evaluated every 10 min), field-work recommendations |
| **Scouting** | Scout reports with disease observations, pest incidents, weed pressure, photos, severity ratings; treatment plans |
| **Inventory** | Items by category (seed, fertilizer, chemical, fuel, parts, harvested), stock movements (in/out/adjust/harvest), reorder-level alerts (hourly check) |
| **Equipment** | Fleet registry, maintenance schedules (due-flagging hourly), fuel logs, breakdowns, service history, live location on map |
| **Tasks** | Kanban-style board (to-do / in-progress / blocked / done), assignees, priorities |
| **Documents** | File uploads (drag & drop), categorization, per-farm association |
| **Notifications** | In-app notification center, unread badge, mark-read/mark-all, live push over WebSocket, generated by sensor/weather/inventory/equipment background jobs (deduplicated) |
| **Analytics & Reports** | Overview/yields/water/costs analytics, async report generation (Celery) with JSON artifacts |
| **Crop planning** | Multi-season rotations with cover crops, companions, and per-field phase offsets; mixed-cropping plans (intercrop, relay, strip, cover) with share percentages; variety selection ranked by maturity, soil, drought tolerance, disease resistance, yield and seed cost; planting windows with optimal/late/harvest-by dates and conflict detection; resource constraints (water, labor, nitrogen, budgets, acres) as hard or soft limits; **farming strategies** — what-if allocations per field with price/yield/cost multipliers and a rainfall scenario, evaluated for revenue, cost, margin, labor, water, nitrogen balance, diversity, rotation compliance, constraint utilisation, and risk, then compared side-by-side and adopted into crop plans |
| **Localization** | English, Spanish, and Arabic, with full right-to-left layout for Arabic. Language is detected once from the caller's country (edge header, then `Accept-Language`, then the device time zone) and then persists as the user's own choice; English is the fallback. Covers the UI (1,313 keys across nine namespaces), API choice labels and validation messages, and planning warnings |
| **Search** | Global search across farms, fields, equipment, inventory, tasks — via the Ctrl-K command palette or the search page |
| **Audit** | AuditLog middleware records state-changing requests per org (read-only API) |
| **Settings** | Organization profile & settings (units, currency, timezone, season start), team management, roles & permissions, invitations (email-based), farm-access matrix, user profile |

---

## 4. Frontend Pages (React Router)

Public routes:

| Route | Page | Purpose |
|---|---|---|
| `/signin` | LoginPage | Email/password sign-in |
| `/register` | RegisterPage | Create account + organization |
| `/invites/:token` | InvitePage | Accept an emailed invitation |

### Shell & information architecture

Navigation is two-level. A **nav rail** picks one of six sections; a **section panel** beside it lists only that section's pages, so at most eight destinations are visible at once instead of a flat 27-item sidebar.

| Section | Destinations |
|---|---|
| Home | Dashboard (Notifications and Search are routable but not listed) |
| Land | Farm map, Farms, Fields |
| Grow | Crop plans, Strategies, Rotations, Catalog (crops · varieties · planting windows), Constraints, Seasons, Budget |
| Operate | Irrigation, Sensors, Weather, Scouting, Treatments, Equipment, Inventory, Tasks |
| Insights | Analytics, Reports, Documents |
| Settings (rail foot) | Overview, Organization, Team, Roles, Invitations, Farm access, Profile |

Shell surfaces:

- **`NavRail`** — six section icons; Settings sits at the foot, away from the primary five.
- **`SectionPanel`** — the active section's pages, an inline filter (shown when a section has more than five pages), and that section's scope controls. Collapsible; the state persists and does **not** reset on navigation.
- **`ContextBar`** — breadcrumbs, the single scope control, the ⌘K search pill, notifications, and the account menu (which now also holds the light/dark toggle).
- **`ContextPanel`** — right-hand inspector, docked and non-modal at `xl`, a drawer below. Used for the map's field inspector so the panel no longer covers the map.
- **`CommandPalette`** — `Ctrl/⌘+K` or `/`. Four result groups: Recents, Go to (every destination, matched locally), Actions, and Records (debounced API search). Full keyboard traversal; `>` restricts to actions, `#` to records.
- **`MobileTabBar`** — bottom tabs for the five primary sections below `lg`.

#### The navigation manifest

`src/navigation/manifest.ts` is the single source of truth. Routes, the rail, section panels, breadcrumbs, document titles, and the palette's "Go to" results are all derived from it; `App.tsx` supplies only the page component per route id. Previously the route table and the sidebar were maintained separately and had drifted — `/scouting/treatments`, `/notifications`, and `/search` were routable but unreachable from navigation.

`npm run check:nav` asserts the manifest's invariants: every route resolves, literal segments beat parameters (`/farms/new` is not `/farms/:id`), breadcrumb chains are correct, no section exceeds eight visible links, and every route has exactly one page component.

#### Page templates

| Template | Used by |
|---|---|
| `ListPage` | Index pages — header, filter bar, body in one rhythm |
| `DetailPage` | Record pages — identity strip, up to four KPIs, **URL-synced tabs** (`?tab=`), lazily-mounted panels |
| `WorkspacePage` | Full-viewport canvas with docked tool and inspector panels (the map) |

List filters live in the URL via `useUrlFilters`, so a filtered view is linkable and survives the back button. Detail tabs use `useUrlTab` for the same reason.

#### Scope

`scopeStore` holds the active **farm** and **season**; routes declare which dimensions they use (`scope: ["farm", "season"]`) and `useScope()` returns only those as query params. Farm selection used to be re-picked per page — the map had its own selector while lists had their own filters — so moving between Fields, Map, and Irrigation lost context. Switching organizations resets scope, since the previous tenant's ids do not exist in the new one.

Protected routes (inside the app shell):

| Route | Page |
|---|---|
| `/` → `/home` | DashboardPage — three bands: Right now (alerts), This season (KPIs), Trends (collapsed) |
| `/map` | MapPage — canvas with a docked tools panel and a non-modal field inspector |
| `/farms`, `/farms/new`, `/farms/:id`, `/farms/:id/edit` | Farm list / create / detail (tabs: overview, fields, equipment, sensors, seasons, notes, access) / edit |
| `/fields`, `/fields/new`, `/fields/:id`, `/fields/:id/edit` | Field list / create / detail (tabs: overview, plots, soil & elevation, agronomy, notes) / edit |
| `/crops` | Catalog — tabs for crops (agronomic profile + economics), varieties (selection criteria), planting windows; `/crops/varieties` and `/crops/windows` redirect to the matching tab |
| `/crops/plans`, `/crops/plans/:id` | Crop plans list (URL filters: status, system, crop) with a composer that shows live window/rotation assessment and ranked varieties; detail with crop-mix editor, schedule, inputs |
| `/crops/strategies`, `/crops/strategies/:id`, `/crops/strategies/compare?ids=` | Strategy list with multi-select compare; workbench (field allocations, assumption sliders, results, constraint rail, adopt/clone/baseline); side-by-side comparison matrix with deltas, ranking, crop-mix and economics charts |
| `/crops/rotations`, `/crops/rotations/:id` | Rotation list with year timelines; detail with sequence editor (steps per cycle year, roles, companions), field assignment with phase offsets, next-season preview, and one-click strategy generation |
| `/crops/constraints` | Resource constraints CRUD plus utilisation of committed plans for the scoped season/farm |
| `/crops/seasons`, `/crops/budget` | Growing seasons; seasonal budget (planned vs actual, scoped) |
| `/sensors`, `/sensors/:id` | Sensor fleet / sensor detail (readings chart, health) |
| `/irrigation`, `/irrigation/zones/:id` | Zones + schedules + recommendations / zone detail |
| `/weather` | Current, forecast, history, alerts, recommendations |
| `/scouting`, `/scouting/new`, `/scouting/:id`, `/scouting/treatments` | Reports list / new report (multi-step, photo upload) / detail / treatment plans |
| `/inventory`, `/inventory/:id` | Stock by category tabs / item detail with movement drawer |
| `/equipment`, `/equipment/:id` | Fleet cards / machine detail (map, maintenance, fuel, service) |
| `/analytics` | Analytics charts (overview, yields, water, costs) |
| `/reports` | Generate + download reports |
| `/tasks` | Kanban task board |
| `/documents` | Document library with drag-and-drop upload |
| `/notifications` | Notification center |
| `/search` | Full search page (`?q=`) |
| `/settings` | Settings overview |
| `/settings/organization` | Org profile, units/currency/timezone |
| `/settings/team` | Members, role assignment, removal |
| `/settings/roles` | Role editor with permission toggles |
| `/settings/invitations` | Send/resend invitations |
| `/settings/access` | Per-farm access matrix |
| `/settings/profile` | User + farmer profile |
| `*` | NotFoundPage |

### Localization (English / Spanish / Arabic)

**Resolution order.** `?lang=` → saved device choice → the signed-in user's
`preferred_language` → country → browser → English.

Detection applies **once**, on a first visit, and then explains itself with a
dismissible notice offering one click back to English. Re-applying it on every
load would overwrite the deliberate choice of anyone travelling, on a VPN, or
working in a country whose language they do not read. `preferred_language` is
blank by default so "not chosen yet" stays distinguishable from an explicit
choice of English — otherwise every new account would be pinned to English and
would ignore its own browser and country.

Country comes from a CDN edge header (`CF-IPCountry`, CloudFront, Vercel,
App Engine), then an `Accept-Language` region subtag, then the device time
zone client-side. There is no GeoIP database: the edge already knows the
country in production, so deployment needs no MaxMind account or `.mmdb`
refresh. `npm run check:i18n` asserts the SPA's country map matches
`apps/common/i18n.py`, since the two decide the same question from different
places.

| Piece | Where |
|---|---|
| Runtime | `src/i18n/` — i18next + react-i18next, catalogues loaded over HTTP from `public/locales/<lang>/<ns>.json` |
| Namespaces | `common`, `nav`, `auth`, `dashboard`, `land`, `grow`, `operate`, `insights`, `settings` |
| Direction | `LocaleProvider` sets `<html lang/dir>` and rebuilds the Chakra theme; `buildTheme(language)` carries `direction` so logical props and Popper placements resolve correctly |
| Formatting | `src/i18n/format.ts` resolves the active locale at call time; `lib/utils` re-exports it so all 46 importing modules are locale-aware |
| Option labels | `src/lib/usePlanningLabels.ts` — soils, categories, planting systems, statuses, resources, rainfall scenarios |
| Detection | `GET /api/i18n/detect/` (public) and `src/i18n/bootstrap.ts` |
| Backend | `apps/common/i18n.py`, `LanguageMiddleware`, `gettext_lazy` across model choices and help text, `.po` under `backend/locale/` |

**Right-to-left.** Layout uses Chakra's logical props (`marginStart`,
`insetEnd`, `borderStartRadius`, `textAlign="start"`) and `placement="start|end"`
for drawers, so the shell mirrors from the theme's `direction` alone.
Directional icons flip; record names render with `dir="auto"` so a Latin farm
name inside an Arabic sentence does not drag punctuation with it.

Arabic also neutralises `letter-spacing` and `text-transform` globally:
letter-spacing breaks the cursive joins between Arabic letters, and the
shell's uppercase tracked labels would otherwise render as disconnected
glyphs. Fonts switch to Noto Kufi/Sans Arabic, loaded on demand so English and
Spanish users never fetch them.

**LTR islands.** Maps (Leaflet), the boundary editor (Geoman), the sensor
sparkline, and all Recharts figures (via `ChartFrame`) stay left-to-right
inside an RTL page. They position panes, axes, legends, and tooltips in
physical coordinates and do not mirror, so an RTL page would put the Y axis on
the wrong side of its own plot area. Numerals are Western in every language
(Arabic uses `nu-latn`), because acreage, yields, SKUs, and field codes are
read off bag labels and equipment displays that are Latin-digit everywhere.

**Planning warnings.** `assess_planting`, `rotation_check`, and
`rotation_validate` return `{ code, params, message }` rather than an
interpolated English sentence. The SPA renders from `code`, so each language
controls word order, date format, and plural category — Arabic needs six CLDR
plural forms where English has two. The English `message` remains for API
consumers and logs.

**Not translated:** user data (farm, field, crop, and variety names), the
AgriNexa brand mark, and the Ctrl-K shortcut. Units stay imperial in every
language — acres, yields, water, and seeding rates are one interlocking
system, and converting the display alone would be worse than not converting;
metric support is separate work.

### Theming & state
- **Theme** (`src/theme.ts`): brand palette (forest green `brand.*`, wheat accent), Fraunces display / DM Sans body fonts, and semantic tokens (`bg.canvas`, `bg.surface`, `bg.subtle`, `fg.default`, `fg.muted`, `border.default`) that adapt to color mode. Light/dark is toggled from the account menu (persisted by Chakra; no flash on reload thanks to `ColorModeScript`).
  - **Card variants** — `surface` (default: flat, hairline border), `panel` (floating, shadowed), `inset` (tinted, borderless). These replace the `borderWidth`/`borderColor`/`bg` triple that was repeated inline on roughly fifty cards.
  - **`zIndices`** — one ladder for the shell (`mapOverlay` 5 … `palette` 1500). Map overlays sit *below* `sticky`: they previously used a raw `z-index: 1000` inside a `position: relative` parent, which creates no stacking context, so they painted over the sticky header while scrolling.
  - **`density`** and **`layout`** — shared spacing rhythm and shell dimensions, applied by the templates instead of per-page margins.
- **i18n**: see the Localization section above. `LocaleProvider` wraps `ChakraProvider`; `useDirection()` exposes `isRtl` for the few cases logical CSS cannot express.
- **Zustand stores**: `authStore` (user, access token, organizations, current org id, session bootstrap state; refresh token + org id persisted to localStorage), `scopeStore` (active farm + season, persisted), and `uiStore` (nav drawer, section panel, command palette, recent destinations).
- **Hooks**: `useScope` (route-aware farm/season params), `useUrlFilters` / `useUrlTab` (URL-backed list filters and detail tabs), `useDebounced`, `useSensorSocket`.
- **Shared components** (`components/ui/`): FormField/PageHeader/ErrorBanner/Skeletons, StatCard/StatusBadge/EmptyState/ChartCard, DataTable, FilterBar/FilterSelect, Modal/Drawer/ConfirmDialog, FileDrop, SensorSparkline/SeverityMeter/LayerToggle, MapView (overlays + recenter/basemap/scale controls), BoundaryEditor (leaflet-geoman polygon drawing with live acreage and context outlines).

---

## 5. Backend Apps & Data Model

| App | Models |
|---|---|
| `accounts` | User (custom, email login, UUID pk), FarmerProfile |
| `tenancy` | Organization, Role, Membership, Team, TeamMembership, Invitation, FarmAccess |
| `farms` | Region, Farm, Field (GeoJSON boundary + elevation cache), Plot, SoilLayer, FieldNote, CropHistory; geometry module (validation, area, centroid, containment, overlap); elevation service |
| `crops` | Crop (agronomic profile: family, N-fixing, root depth, water/labor/N per acre; economics: yield, price, seed and input cost; compatible intercrops), CropVariety (maturity group, drought tolerance, disease resistance, suitable soils, seed cost override), GrowingSeason, PlantingWindow, CropPlan (+ planting_system, acres, strategy/rotation provenance), CropPlanComponent, RotationPlan (fields M2M, start_year), RotationStep, RotationFieldPhase, ResourceConstraint, FarmingStrategy, StrategyAllocation, PlantingSchedule, FertilizerPlan, PesticideApplication, SeasonalBudget |
| `sensors` | SensorType (global + per-org), Sensor, SensorReading, DeviceHealth |
| `irrigation` | IrrigationZone, IrrigationSchedule, WaterUsage, IrrigationRecommendation, IrrigationEvent |
| `weather` | WeatherStation, WeatherReading, WeatherForecast, WeatherAlert |
| `scouting` | ScoutReport, DiseaseObservation, PestIncident, WeedPressure, ScoutPhoto, TreatmentPlan |
| `inventory` | InventoryItem, StockMovement |
| `equipment` | Equipment, MaintenanceSchedule, FuelLog, Breakdown, ServiceHistory |
| `platform` | Task, Document, Notification, AuditLog (+ AuditMiddleware, search, notification consumer) |
| `analytics` | Report |
| `common` | Abstract bases (UUIDModel, TimeStampedModel, OrganizationScopedModel), tenant viewsets/mixins, permissions, pagination, exception handler |

All API models use UUID primary keys and created/updated timestamps. List endpoints are paginated (`?page=`, 25 per page, response `{count, next, previous, results}`), and support `django-filter` filtering, `?search=`, and `?ordering=` where registered.

---

## 6. REST API Reference

Base URL: `/api/`. All endpoints require `Authorization: Bearer <access>` plus `X-Organization-ID: <org-uuid>` unless noted. Router resources expose standard CRUD: `GET list`, `POST create`, `GET/PATCH/PUT/DELETE detail` (exceptions noted). Errors return `{detail, code}`; validation errors return `{detail: "Validation failed", errors: {field: [...]}}`; deleting a referenced record returns 409.

### Auth — `/api/auth/` (no org header required)

| Method & Path | Description |
|---|---|
| `POST register/` | Create user + organization. Body: `email, password, first_name, last_name, organization_name` (optional `phone, org_type, country, timezone`). Returns tokens + user + organizations. Enforces password validators. |
| `POST login/` | `{email, password}` (case-insensitive email) → `{access, refresh, user, organizations}` |
| `POST refresh/` | `{refresh}` → `{access, refresh}` (rotating) |
| `POST logout/` | `{refresh}` → blacklists the token |
| `GET/PATCH me/` | Current user profile |
| `GET/PATCH profile/` | FarmerProfile (experience, specialties…) |

### Tenancy

| Resource | Notes |
|---|---|
| `organizations/` | List/update only (no create/delete via API). `GET/PATCH/PUT {id}/settings/` — org settings (units, currency, moisture unit, timezone, season start month, legal name, map center). |
| `members/` | Memberships. `role` writable (must belong to the org); `is_owner` read-only; owner cannot be deleted. |
| `roles/` | Custom roles with `permissions` JSON list. System roles read-only. |
| `teams/` | CRUD. `GET/POST {id}/members/` (body `{user_id}`, must be an org member), `DELETE {id}/members/{userId}/`. |
| `invitations/` | Create (body `{email, role, farm_ids?}`) sends an email with an accept link; token never exposed in responses. `POST {id}/resend/`. `POST accept/` (AllowAny; body `{token, password?, first_name?, last_name?}`) — creates the account for new users, or requires sign-in for existing ones. |

### Farms

| Resource | Notes |
|---|---|
| `regions/` | Farm groupings |
| `farms/` | `GET/PUT {id}/access/` — farm access matrix (PUT accepts a list of `{user, can_view, can_edit, can_manage}`; users must be org members). Annotated `field_count`. |
| `fields/` | GeoJSON `boundary` is spatially validated (closed simple ring, coordinate ranges, non-zero area); when present, `acres`, `centroid_lat`, and `centroid_lng` are derived from it. `GET/POST {id}/history/` — crop history. `GET {id}/elevation/` — elevation estimate `{source, min_m, max_m, mean_m, relief_m, points[]}` sampled on a grid inside the boundary (Open-Meteo, deterministic offline fallback), cached on the field; `?refresh=1` recomputes. |
| `plots/` | Sub-field subdivisions. A plot boundary must lie within its field's boundary and may not overlap sibling plots; acreage derives from the boundary. |
| `soil-layers/` | Typed soil polygons (`clay`, `clay_loam`, `loam`, `silt_loam`, `silt`, `sandy_loam`, `sand`, `peat`, `chalk`) with `ph`, `organic_matter_pct`, `drainage`; boundary must lie within the field; filter with `?field=`. |
| `field-notes/` | Notes accept `content` (or alias `body`). |

Spatial validation errors return HTTP 400 with a specific message (e.g. "The outer ring intersects itself.", "Plot boundary must lie within the field boundary.", "Plot boundary overlaps plot 'Strip A'.").

### Crops
`crops/`, `varieties/`, `seasons/`, `planting-windows/`, `crop-plans/`, `crop-plan-components/`, `rotations/`, `rotation-steps/`, `resource-constraints/`, `strategies/`, `strategy-allocations/`, `planting-schedules/`, `fertilizer-plans/`, `pesticide-applications/`, `budgets/` — standard tenant-scoped CRUD. Planning-specific endpoints:

| Endpoint | Purpose |
|---|---|
| `GET planning/assess/?field=&crop=&season=&variety=&planting_date=` | Grade a hypothetical planting: window fit (`optimal`/`late`/`early`/`outside`), projected harvest vs harvest-by, soil match, previous-occupant conflict, rotation score and lineage, warnings. |
| `GET planning/window/?crop=&variety=&farm=&year=` | Resolved planting window (most-specific-wins: variety > farm > crop; category default if none defined). |
| `GET planning/constraints/?season=&farm=` | Resource usage of committed crop plans against applicable constraints. |
| `GET crop-plans/{id}/assessment/` | Assessment for an existing plan. |
| `GET varieties/recommend/?field=&crop=&season=&planting_date=` | Varieties ranked 0–100 with reasons (harvest slack, soil rating, drought tolerance vs irrigation, yield and seed cost vs crop average, disease resistance) and projected margin per acre. |
| `GET rotations/{id}/validate/` | Static cycle checks: back-to-back repeats, same-family successions, missing legume, diversity. |
| `GET rotations/{id}/preview/?season=` | What each assigned field grows that season (honours `start_year` and per-field phase offsets), with companions and suggested planting date. |
| `POST rotations/{id}/create-strategy/` `{season, name?}` | Materialise the preview into a new strategy. |
| `PUT rotations/{id}/phases/` `[{field, phase_offset}]` | Replace per-field phase offsets. |
| `POST strategies/{id}/evaluate/` | Recompute and cache the evaluation. |
| `GET strategies/compare/?ids=a,b,c&refresh=1` | Evaluations side-by-side: per-metric values, deltas vs the baseline, best index, overall ranking, crop mix. |
| `POST strategies/{id}/adopt/` `{force?}` | Create/replace *planned* crop plans (and components) for every allocation; `409` if hard constraints are violated unless `force`. Demotes the previously adopted strategy to candidate. |
| `POST strategies/{id}/clone/` `{name?}` | Duplicate as a draft. |
| `PUT strategies/{id}/allocations/` `[...]` | Bulk-replace allocations atomically (all-or-nothing validation), then re-evaluate. |

Evaluation model (see `apps/crops/services.py`): per-acre crop economics × allocation acres, with variety overrides for yield and seed cost; mixed-cropping components split acres by `share_pct` (remainder to the primary) and intercrop/relay systems get an 8% land-equivalent-ratio revenue uplift; strategy multipliers scale price, yield, and cost; the rainfall scenario scales yield (dry ×0.90, wet ×0.97) and irrigation demand (dry ×1.25, wet ×0.80). Nitrogen balance credits 40 lb/ac for fixing crops. Risk (0–100) combines crop concentration, late/outside plantings, nitrogen deficit, constraint breaches, and dryland high-water crops in a dry scenario. Constraints resolve most-specific-wins (farm-season > farm or season > organization) per resource.

### Sensors

| Resource | Notes |
|---|---|
| `sensor-types/` | Global built-ins (read-only) + org-specific custom types. |
| `sensors/` | Registry with latest-value annotation. `GET/POST {id}/readings/` (GET supports `?start=&end=` datetime filters; POST `{value, recorded_at?}`), `GET {id}/health/`, `GET live/` (latest readings; `?farm=` filter). |

### Irrigation

| Resource | Notes |
|---|---|
| `irrigation-zones/` | `POST {id}/override/` — manual run `{duration_minutes, notes?}`. |
| `irrigation-schedules/`, `water-usage/` | CRUD. |
| `irrigation/recommendations/` | Read-only list (generated by the beat job). |
| `GET irrigation/analytics/` | Zones running/total, gallons today, efficiency. |

### Weather

| Resource | Notes |
|---|---|
| `weather-stations/` | CRUD, per farm. |
| `weather/alerts/` | Alert list (`?farm=`). |
| `GET weather/current/` | Latest conditions (`?farm=`). |
| `GET weather/forecast/` | Daily forecast (`?farm=`). |
| `GET weather/history/` | Readings; `?days=N` (default 14) or `?start=&end=`. |
| `GET weather/recommendations/` | Field-work recommendations. |

### Scouting
`scout-reports/` (multipart supported for photos; nested disease/pest/weed observations), `treatments/` — CRUD.

### Inventory
`inventory/` — CRUD; `POST {id}/move/` `{quantity, movement_type: in|out|adjust|harvest, notes?}`; `GET alerts/` — items at/under reorder level.

### Equipment
`equipment/` (typed via model choices), `maintenance/`, `fuel-logs/`, `breakdowns/`, `service-history/` — CRUD.

### Platform

| Resource | Notes |
|---|---|
| `tasks/` | Task board CRUD (`?status=` filter). |
| `documents/` | Multipart upload, field name `file`. |
| `notifications/` | Read-only list + `POST {id}/read/`, `POST read-all/` (direct POST create returns 405). |
| `audit-logs/` | Read-only. |
| `GET i18n/detect/` | Public. Language for this caller with the source that decided it (`profile`, `country`, `accept-language`, `default`), the resolved country, direction, and the shipped language list. Unauthenticated callers are allowed so the sign-in screen can render in the right language, but credentials are honoured when sent. |
| `GET search/?q=&type=&limit=` | Cross-entity search → `{farms, fields, equipment, inventory, tasks, crops, query, counts}`. Matches names **and identifiers** (farm/field `code`, equipment `serial`/make/model, inventory `sku`/`lot_number`), ranks exact then prefix then substring matches, and applies the same organization **and farm-access** boundary as the ViewSets. `type` is a comma-separated subset of groups; `limit` defaults to 8, capped at 25. |

### Analytics

| Endpoint | Description |
|---|---|
| `GET dashboard/summary/` | `{total_acres, active_fields, yield_estimate, open_alerts, water_used, equipment_uptime}` |
| `GET dashboard/crop-progress/`, `yields/`, `field-health/`, `irrigation/`, `expenses/`, `kpis/` | Dashboard widgets |
| `GET analytics/overview/`, `yields/`, `water/`, `costs/` | Analytics page datasets |
| `reports/` | `GET` list, `POST` create, `POST generate/` `{report_type, params}` — queues async generation; file saved under `media/reports/`. |

---

## 7. WebSocket API

Daphne serves WebSockets on the same port; authenticate with `?token=<access-JWT>` in the query string (`JWTAuthMiddleware`).

| Path | Stream |
|---|---|
| `ws/sensors/<farm_uuid>/?token=…` | Live sensor readings for a farm (`sensor.reading` events). Requires membership in the farm's organization. |
| `ws/notifications/?token=…` | Per-user notification push (`notification.message` events). |

The frontend consumes both: the app shell subscribes to notifications globally, and sensor/map pages subscribe to the selected farm's stream (`useSensorSocket`), invalidating the relevant queries on each message.

---

## 8. Background Jobs (Celery Beat)

| Task | Schedule | Purpose |
|---|---|---|
| `weather.refresh_forecasts` | 30 min | Ingest forecasts (OpenWeather if `OPENWEATHER_API_KEY` set, seasonal stub otherwise) |
| `irrigation.evaluate_irrigation_recommendations` | 15 min | Generate zone recommendations from moisture/thresholds |
| `sensors.check_sensor_health` | 5 min | Flag stale sensors offline (sensors that have never reported are exempt) |
| `weather.evaluate_weather_alerts` | 10 min | Frost/heat alerts + notifications |
| `inventory.check_reorder_levels` | hourly | Low-stock notifications (deduplicated against unread) |
| `equipment.flag_due_maintenance` | hourly | Maintenance-due notifications (deduplicated) |

Report generation (`analytics.generate_report`) runs on demand via Celery.

---

## 9. Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `DJANGO_SECRET_KEY` | dev value | **Set in production** |
| `DJANGO_DEBUG` | `true` | Disable in production |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | |
| `POSTGRES_DB/USER/PASSWORD/HOST/PORT` | `agrinexa`/…/`localhost:5432` | Database |
| `REDIS_URL` | `redis://localhost:6379/0` | Channels layer |
| `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` | redis `/1`, `/2` | Celery |
| `JWT_ACCESS_MINUTES` / `JWT_REFRESH_DAYS` | 60 / 14 | Token lifetimes |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Frontend origins |
| `FRONTEND_URL` | `http://localhost:5173` | Used in invitation emails |
| `OPENWEATHER_API_KEY` | empty | Real forecasts when set |
| `EMAIL_BACKEND` | console | Invitation emails |

Upload limit 10 MB; media served from `/media/` in debug.

---

## 10. Quality & Testing

- **Backend**: `python manage.py test apps` — covers the auth/tenancy chain (register → login → org header → tenant data, token refresh, mixed-case login, invitation-token non-exposure, owner-escalation protection, bad-header resilience, cross-tenant isolation), spatial geometry units (ring validity, self-intersection, area/centroid accuracy, containment, overlap), spatial API rules (derived acreage, invalid boundary 400s, plot containment/overlap, soil-layer containment, elevation estimate + cache), global search (grouped results, identifier matching, prefix ranking, `type`/`limit` handling, and farm-access scoping for restricted members), language resolution (country mapping, header precedence, anonymised Cloudflare codes, profile-beats-location, translated choice labels and validation messages through the API), and crop planning (window grading incl. wrap-around winter windows and variety-specific overrides, previous-occupant conflicts, rotation scoring and cycle validation, phase offsets, variety ranking, strategy economics incl. mixed-cropping shares and scenario multipliers, constraint precedence and hard/soft handling, adopt/clone lifecycle, compare deltas, and atomic bulk allocations). `manage.py check` and the migration graph are clean.
  - Needs no gettext either: `python manage.py compilepo` compiles `.po` to `.mo` in pure Python, so build images do not need the GNU gettext binaries. `.mo` files are build output and are gitignored.
  - Needs no database server: `python manage.py test apps --settings=agrinexa.settings_test` runs the same suite on in-memory SQLite with an in-memory channel layer.
- **Frontend**: `npm run typecheck` (strict TypeScript, zero errors); `npm run check:i18n` holds every catalogue to the English key set, verifies interpolation placeholders survive translation, requires all six CLDR plural forms for Arabic, and checks the country map against the API's; `npm run check:nav` asserts the navigation manifest's invariants and that it has not drifted from the route table; `npm run build` runs the type check before bundling.
- Known technical debt:
  - Translations are a first pass by a single author. Agronomic terms were chosen for trade usage (Spanish *lote*/*parcela*/*monitoreo*, Arabic *تحميل*/*طميية طينية*), but a native agronomist review in each language is the obvious next step, as is deciding a Spanish regional variant if a specific market is targeted — the catalogues currently use neutral Latin American Spanish.
  - Arabic RTL has not been reviewed visually by a native reader.
  - Phase-4 page migrations are partial. `Dashboard`, `Map`, `Farms`, `Farm detail`, `Fields`, `Field detail`, `Sensors`, `Equipment`, and `Inventory` use the new templates. The remaining index and detail pages still render `PageHeader` directly — they work unchanged, but their filters are not yet URL-backed and their detail tabs are not yet linkable.
  - Detail pages that have not adopted `useRegisterPageTitle` show a generic breadcrumb leaf ("Sensor" rather than the sensor's name).
  - `sensorsApi.live()` does not yet accept a farm filter (backend supports `?farm=`), so the sensor grid filters live readings client-side.
  - The vendor chunk is still ~760 kB minified (Chakra + Framer Motion in one chunk); pages are now route-split, and `manualChunks` for the vendor libraries is the next step.
