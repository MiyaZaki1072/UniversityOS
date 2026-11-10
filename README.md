# University OS

A personal university planner: semesters, courses, timetable, gradebook, calendar, tasks, habits, study sessions and resources, with a TVA-inspired dark-brown interface and an **Import with AI** feature that turns a syllabus or timetable into courses.

**Stack:** Django + DRF + PostgreSQL · React + Vite + TypeScript + Tailwind · Docker Compose on ZimaOS

## Status

Frontend design system, Dashboard (sample data), backend skeleton, and Docker Compose setup are ready.

## Start here

| If you want to… | Read |
|---|---|
| Know the data model and API | [`docs/university-os-spec.md`](docs/university-os-spec.md) |
| Know the visual direction | [`docs/design-direction.md`](docs/design-direction.md) |
| Import courses with AI | [`docs/AI_IMPORT_GUIDE.md`](docs/AI_IMPORT_GUIDE.md) |
| Work on the frontend | [`frontend/README.md`](frontend/README.md) |

## Run with Docker

1. Copy the example environment file and set a secret key:

```bash
cp .env.example .env
```

2. Build and start PostgreSQL, the Django backend, and the Nginx frontend server:

```bash
docker compose up --build
```

- Frontend: `http://localhost:8080`
- Health check: `http://localhost:8080/api/health/`

For production (without development overrides or host database ports):

```bash
docker compose -f docker-compose.yml up -d --build
```

## Run locally for development

Start PostgreSQL in Docker, then run the backend and frontend directly:

```bash
docker compose up -d db

cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py runserver        # http://localhost:8000
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev                       # http://localhost:5173 (proxies /api to :8000)
```
