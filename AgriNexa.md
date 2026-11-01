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
| Maps | Leaflet / react-leaflet (OpenStreetMap + Esri satellite tiles) |
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
| **Farms & Fields** | Regions → Farms → Fields → Plots hierarchy; GeoJSON field boundaries; field notes; crop history; per-farm access matrix |
| **Crops** | Crop catalog, varieties, growing seasons, seasonal crop plans (with Gantt timeline), rotation plans, planting schedules, fertilizer plans, pesticide applications, seasonal budgets |
| **Map** | Interactive Leaflet map with satellite/street layers, field polygons colored by health, sensor and equipment markers, irrigation-zone overlays, layer toggles |
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

Protected routes (inside the app shell — sidebar, topbar with org switcher, season filter, dark/light toggle, notifications, Ctrl-K palette):

| Route | Page |
|---|---|
| `/` → `/home` | DashboardPage (season operations overview) |
| `/map` | MapPage (full-screen operations map with layer toggles) |
| `/farms`, `/farms/new`, `/farms/:id`, `/farms/:id/edit` | Farm list / create / detail (tabs: overview, seasons, access, notes) / edit |
| `/fields`, `/fields/new`, `/fields/:id`, `/fields/:id/edit` | Field list / create / detail (history, zones, sensors) / edit |
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
- **Theme** (`src/theme.ts`): brand palette (forest green `brand.*`, wheat accent), Fraunces display / DM Sans body fonts, and semantic tokens (`bg.canvas`, `bg.surface`, `bg.subtle`, `fg.default`, `fg.muted`, `border.default`) that adapt to color mode. Light/dark is toggled from the topbar (persisted by Chakra; no flash on reload thanks to `ColorModeScript`).
- **Zustand stores**: `authStore` (user, access token, organizations, current org id, session bootstrap state; refresh token + org id persisted to localStorage) and `uiStore` (sidebar, command palette, selected season — persisted).
- **Shared components** (`components/ui/`): FormField/PageHeader/ErrorBanner/Skeletons, StatCard/StatusBadge/EmptyState/ChartCard, DataTable, Modal/Drawer/ConfirmDialog, FileDrop, SensorSparkline/SeverityMeter/LayerToggle, MapView.

---

## 5. Backend Apps & Data Model

| App | Models |
|---|---|
| `accounts` | User (custom, email login, UUID pk), FarmerProfile |
| `tenancy` | Organization, Role, Membership, Team, TeamMembership, Invitation, FarmAccess |
| `farms` | Region, Farm, Field (GeoJSON boundary), Plot, FieldNote, CropHistory |
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
| `fields/` | GeoJSON `boundary`; `GET/POST {id}/history/` — crop history entries. |
| `plots/`, `field-notes/` | Sub-field plots; notes accept `content` (or alias `body`). |

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
| `GET search/?q=` | Cross-entity search → `{farms, fields, equipment, inventory, tasks}`. |

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

- **Backend**: `python manage.py test apps` — smoke suite covering register → login → org header → tenant data, token refresh, mixed-case login, invitation-token non-exposure, owner-escalation protection, bad-header resilience, and cross-tenant isolation. `manage.py check` and the migration graph are clean.
- **Frontend**: `npm run typecheck` (strict TypeScript, zero errors); `npm run build` runs the type check before bundling.
- Known technical debt: the JS bundle is ~1.4 MB minified (Chakra + Framer Motion + Recharts + Leaflet in one chunk) — route-level code-splitting is the recommended next step; `sensorsApi.live()` does not yet accept a farm filter (backend supports `?farm=`).
