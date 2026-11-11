# University OS

A personal planner for university: your courses, weekly timetable, exams, tasks and grades in one place, with a dark, archive-style interface that works on a phone as well as a desktop.

**Import with AI** fills it in for you: give any AI chat your timetable or syllabus with the prompt from the app, paste its reply, and your whole semester (courses, class times, grading, exams) is set up in one go.

## Features

| | |
|---|---|
| **Today's Briefing** | Today's classes and deadlines, a countdown to the next exam, work due in the next 7 days, grade standing |
| **Timetable** | Week view of classes, exams and due dates, one card per day |
| **Courses** | Courses with weekly class times, rooms, exams and links |
| **Gradebook** | Weighted categories, scores typed straight into the table, custom grade scale, current and projected letter grade |
| **Tasks** | Overdue / in progress / pending / completed, with priorities and due dates |
| **Habits** | Daily or times-per-week habits, punch card for today, week grid, streaks and 12-week consistency |
| **Study timer** | Start/stop sessions per course, add past sessions, daily and weekly totals against a weekly target |
| **Resource hub** | Saved links per course or global, categories, favorites, search |
| **Semester report** | Study time by course and by week, habit consistency, task completion, grade standing |
| **Import with AI** | Turn a syllabus or timetable into courses, checked before anything is saved |
| **Saving** | Self-hosted: login, saved on your server, synced across devices, daily database backup. Or browser-only with backup files |

## Ways to run it

| Option | Where your data lives | Best for |
|---|---|---|
| [On your own server](#run-on-your-own-server) (ZimaOS or any Docker host) | Your server's database, synced to every device | Daily use on phone + PC |
| [On your PC to try it](#try-it-on-your-pc) | Docker on your PC | Testing before installing on a server |
| [Browser only](#browser-only-no-server) | That one browser | Quick look, no server at all |

### Run on your own server

Full step-by-step guide for ZimaOS: **[docs/DEPLOY_ZIMAOS.md](docs/DEPLOY_ZIMAOS.md)**. Short version:

```bash
cp .env.example .env      # then set POSTGRES_PASSWORD and DJANGO_SECRET_KEY to long random values
docker compose up -d --build
docker compose exec backend python manage.py createsuperuser
```

Open `http://<server-ip>:8080` and sign in with the account you just created. There is no public sign-up.

### Try it on your PC

Needs [Docker Desktop](https://www.docker.com/products/docker-desktop/) running. From the project folder:

1. Create the settings file and two secrets:

   ```bash
   cp .env.example .env
   ```

   Make a random value (run it twice, one for each secret):

   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```

   Paste them into `.env` after `POSTGRES_PASSWORD=` and `DJANGO_SECRET_KEY=`.

2. Build and start (the first time takes a few minutes):

   ```bash
   docker compose up -d --build
   ```

3. Create your login:

   ```bash
   docker compose exec backend python manage.py createsuperuser
   ```

4. Open http://localhost:8080. From a phone on the same Wi-Fi, use `http://<your-pc-ip>:8080`.

Stop it with `docker compose down` (your data is kept). `docker compose down -v` **deletes the database**.

### Browser only (no server)

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

Everything is stored in that browser. Use **Settings → Download backup / Restore backup** to keep a copy or move it to another device.

## Your data and backups

- **Server:** every change is saved automatically; the cloud icon at the top shows **Saved / Saving… / Offline**. If the server can't be reached, changes stay on the device and are sent when it's back.
- **Daily backup:** the `backup` container writes `backups/uos-YYYYMMDD-HHMM.sql.gz` once a day and keeps 14 days (`BACKUP_KEEP_DAYS`). Copy that folder to another disk now and then. Restoring is covered in the [deploy guide](docs/DEPLOY_ZIMAOS.md#8-backups).
- **Planner file:** **Settings → Download backup** saves your whole planner as a JSON file you can restore on any install.
- **Security:** the server speaks plain `http`. Use it on your home network or over a VPN such as Tailscale; don't expose port 8080 to the internet.

## Configuration

All settings live in `.env` (see [`.env.example`](.env.example) for every option):

| Variable | Default | What it does |
|---|---|---|
| `POSTGRES_PASSWORD` | — (required) | Database password |
| `DJANGO_SECRET_KEY` | — (required) | Signs login sessions |
| `WEB_PORT` | `8080` | Port the app is served on |
| `ALLOWED_HOSTS` | `*` | Host names allowed to open the app |
| `ADMIN_URL` | `manage/` | Path of the admin pages |
| `BACKUP_DIR` / `BACKUP_KEEP_DAYS` | `./backups` / `14` | Where daily backups go and how long they're kept |
| `SECURE_*`, `*_COOKIE_SECURE` | `false` | Turn on only when every visit goes through HTTPS |

## Development

**Stack:** Django 5 + Django REST Framework + PostgreSQL 16 · React 19 + Vite + TypeScript + Tailwind CSS v4 · Docker Compose

```text
backend/     Django project: config/, apps/, common/, tests/
frontend/    React app: src/lib (data, sync), src/components, src/pages
docs/        Specification, design direction, import format, deploy guide
```

Full stack with live-reloading backend:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Or run the pieces directly. Database (port 5432 on localhost):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
```

Backend (set `DATABASE_URL` in `.env` to `postgres://uos:<POSTGRES_PASSWORD>@localhost:5432/uos` first):

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver         # http://localhost:8000
```

Frontend, talking to that backend:

```bash
cd frontend
npm install
VITE_DATA_MODE=server npm run dev  # http://localhost:5173, proxies /api to :8000
```

`VITE_DATA_MODE` is `local` (browser only, default), `server` (login + sync) or `sample` (fixed demo data).

Checks (the same ones CI runs):

```bash
cd backend && pytest && ruff check . && ruff format --check . && python manage.py makemigrations --check --dry-run
cd frontend && npx tsc -b && npm run build
```

API docs while the backend runs: `/api/docs/` (Swagger) and `/api/redoc/`.

## Documentation

| Topic | File |
|---|---|
| Install on ZimaOS, backups, updates | [`docs/DEPLOY_ZIMAOS.md`](docs/DEPLOY_ZIMAOS.md) |
| Import format and the prompt | [`docs/AI_IMPORT_GUIDE.md`](docs/AI_IMPORT_GUIDE.md) |
| Data model and API | [`docs/university-os-spec.md`](docs/university-os-spec.md) |
| Visual design | [`docs/design-direction.md`](docs/design-direction.md) |
| Frontend structure and design rules | [`frontend/README.md`](frontend/README.md) |
