# AgriNexa

Precision farming platform for farms, agribusinesses, crop consultants, and field teams. It brings field records, crop plans, sensors, maps, irrigation, scouting, weather, inventory, and equipment into one multi-tenant operations center.

## Stack

Django 5 and Django REST Framework on the backend. React, TypeScript, Vite, and Chakra UI (light/dark theme) on the frontend, with Zustand for client state and TanStack Query for server state. PostgreSQL, Redis, and Celery support data and background work.

Full platform documentation — features, API reference, pages, data model, and operations — lives in [AgriNexa.md](AgriNexa.md).

## Layout

- `backend/` — Django API
- `frontend/` — React client

## Local setup

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
```

```bash
pip install -r requirements.txt
```

```bash
python manage.py migrate
python manage.py seed_demo   # optional demo data (farmer@agrinexa.local / Farmland#2026)
python manage.py runserver   # serves http://127.0.0.1:8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev                  # serves http://localhost:5173, proxies /api and /ws to :8000
```

The backend expects PostgreSQL (configure via `POSTGRES_*` env vars) and Redis (for Channels websockets and Celery). `python manage.py runserver` and the REST API work without Redis; live websockets and background jobs need it. Keep real secrets out of git — set `DJANGO_SECRET_KEY` and friends through the environment in production.

Run the backend test suite with `python manage.py test apps`, and the frontend type check with `npm run typecheck`.

## License

Released under the [MIT License](LICENSE).
