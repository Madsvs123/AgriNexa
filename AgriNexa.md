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
| Grow | Crop plans, Catalog, Varieties, Seasons, Rotations, Budget |
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
| `/crops` | Crop catalog (+ add-crop drawer) |
| `/crops/plans`, `/crops/plans/:id` | Seasonal crop plans list / detail with Gantt timeline |
| `/crops/varieties`, `/crops/seasons`, `/crops/rotations`, `/crops/budget` | Varieties, growing seasons, rotations, seasonal budget |
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

### Theming & state
- **Theme** (`src/theme.ts`): brand palette (forest green `brand.*`, wheat accent), Fraunces display / DM Sans body fonts, and semantic tokens (`bg.canvas`, `bg.surface`, `bg.subtle`, `fg.default`, `fg.muted`, `border.default`) that adapt to color mode. Light/dark is toggled from the account menu (persisted by Chakra; no flash on reload thanks to `ColorModeScript`).
  - **Card variants** — `surface` (default: flat, hairline border), `panel` (floating, shadowed), `inset` (tinted, borderless). These replace the `borderWidth`/`borderColor`/`bg` triple that was repeated inline on roughly fifty cards.
  - **`zIndices`** — one ladder for the shell (`mapOverlay` 5 … `palette` 1500). Map overlays sit *below* `sticky`: they previously used a raw `z-index: 1000` inside a `position: relative` parent, which creates no stacking context, so they painted over the sticky header while scrolling.
  - **`density`** and **`layout`** — shared spacing rhythm and shell dimensions, applied by the templates instead of per-page margins.
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
| `crops` | Crop, CropVariety, GrowingSeason, CropPlan, RotationPlan, PlantingSchedule, FertilizerPlan, PesticideApplication, SeasonalBudget |
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
`crops/`, `varieties/`, `seasons/`, `crop-plans/`, `rotations/`, `planting-schedules/`, `fertilizer-plans/`, `pesticide-applications/`, `budgets/` — standard CRUD. Duplicate crop/region names per org return 400.

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

- **Backend**: `python manage.py test apps` — covers the auth/tenancy chain (register → login → org header → tenant data, token refresh, mixed-case login, invitation-token non-exposure, owner-escalation protection, bad-header resilience, cross-tenant isolation), spatial geometry units (ring validity, self-intersection, area/centroid accuracy, containment, overlap), spatial API rules (derived acreage, invalid boundary 400s, plot containment/overlap, soil-layer containment, elevation estimate + cache), and global search (grouped results, identifier matching, prefix ranking, `type`/`limit` handling, and farm-access scoping for restricted members). `manage.py check` and the migration graph are clean.
  - Needs no database server: `python manage.py test apps --settings=agrinexa.settings_test` runs the same suite on in-memory SQLite with an in-memory channel layer.
- **Frontend**: `npm run typecheck` (strict TypeScript, zero errors); `npm run check:nav` asserts the navigation manifest's invariants and that it has not drifted from the route table; `npm run build` runs the type check before bundling.
- Known technical debt:
  - Phase-4 page migrations are partial. `Dashboard`, `Map`, `Farms`, `Farm detail`, `Fields`, `Field detail`, `Sensors`, `Equipment`, and `Inventory` use the new templates. The remaining index and detail pages still render `PageHeader` directly — they work unchanged, but their filters are not yet URL-backed and their detail tabs are not yet linkable.
  - Detail pages that have not adopted `useRegisterPageTitle` show a generic breadcrumb leaf ("Sensor" rather than the sensor's name).
  - `sensorsApi.live()` does not yet accept a farm filter (backend supports `?farm=`), so the sensor grid filters live readings client-side.
  - The vendor chunk is still ~760 kB minified (Chakra + Framer Motion in one chunk); pages are now route-split, and `manualChunks` for the vendor libraries is the next step.
