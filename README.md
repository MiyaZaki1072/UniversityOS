# University OS

A personal university planner: semesters, courses, timetable, gradebook, calendar, tasks, habits, study sessions and resources, with a TVA-inspired dark-brown interface and an **Import with AI** feature that turns a syllabus or timetable into courses.

**Stack:** Django + DRF + PostgreSQL · React + Vite + TypeScript + Tailwind · Docker Compose on ZimaOS

## Status

Frontend design system and Dashboard (sample data) are done. Backend work is next.

## Start here

| If you want to… | Read |
|---|---|
| Know the data model and API | [`docs/university-os-spec.md`](docs/university-os-spec.md) |
| Know the visual direction | [`docs/design-direction.md`](docs/design-direction.md) |
| Import courses with AI | [`docs/AI_IMPORT_GUIDE.md`](docs/AI_IMPORT_GUIDE.md) |
| Work on the frontend | [`frontend/README.md`](frontend/README.md) |

## Run the frontend now

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 — sample data until the API exists
```

Docker and backend instructions will be added with the backend.
