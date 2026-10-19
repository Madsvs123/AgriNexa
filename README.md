# AgriNexa

Precision farming platform for farms, agribusinesses, crop consultants, and field teams. It brings field records, crop plans, sensors, maps, irrigation, scouting, weather, inventory, and equipment into one multi-tenant operations center.

## Stack

Django 5 and Django REST Framework on the backend. React, TypeScript, and Vite on the frontend. PostgreSQL, Redis, and Celery support data and background work.

## Layout

- `backend/` — Django API
- `frontend/` — React client

## Local setup

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
```

```bash
pip install -r requirements.txt
```

```bash
python manage.py migrate
python manage.py runserver
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Use PostgreSQL and Redis when the project expects them. Copy `.env.example` to `.env` where an example file is present, and keep real secrets out of git.

## License

Released under the [MIT License](LICENSE).
