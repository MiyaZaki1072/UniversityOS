# University OS

A personal university planner: semesters, courses, timetable, gradebook, calendar, tasks, habits, study sessions and resources, with a TVA-inspired dark-brown interface and an **Import with AI** feature that turns a syllabus or timetable into courses.

**Stack:** Django + DRF + PostgreSQL · React + Vite + TypeScript + Tailwind · Docker Compose on ZimaOS

## Status

Usable today: courses, weekly timetable, exams, tasks, gradebook and Import with AI. Runs either fully in the browser or on your own server (login + saved planner + daily backups).

## Start here

| If you want to… | Read |
|---|---|
| Know the data model and API | [`docs/university-os-spec.md`](docs/university-os-spec.md) |
| Know the visual direction | [`docs/design-direction.md`](docs/design-direction.md) |
| Import courses with AI | [`docs/AI_IMPORT_GUIDE.md`](docs/AI_IMPORT_GUIDE.md) |
| Work on the frontend | [`frontend/README.md`](frontend/README.md) |

## Run on a home server (ZimaOS / any Docker host)

Step-by-step guide: [`docs/DEPLOY_ZIMAOS.md`](docs/DEPLOY_ZIMAOS.md). Short version:

```bash
cp .env.example .env              # then fill in POSTGRES_PASSWORD and DJANGO_SECRET_KEY
docker compose up -d --build
docker compose exec backend python manage.py createsuperuser
```

Open `http://<server-ip>:8080` and sign in. The planner is saved on the server and synced across devices; a database backup is written to `backups/` every day.

For development with live reload of the backend:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
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
