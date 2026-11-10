# University OS — Frontend

React + Vite + TypeScript + Tailwind CSS v4. TVA-inspired "Academic Records Division" design system, one dark-brown theme.

## Run

```bash
npm install
npm run dev            # http://localhost:5173 (proxies /api → http://localhost:8000)
npm run build          # production bundle in dist/ (serve behind Django / nginx)
npm run build:preview  # one self-contained HTML file in dist-preview/ for design review
```

Data is saved on the device (browser storage) by default, so the app runs with no server. Set `VITE_DATA_MODE=api` in `.env` to use the Django API instead, or `sample` for fixed sample data (`npm run build:preview` always uses sample data). Back up or move data between devices from Settings.

## Structure

```text
src/
├── styles/
│   ├── tokens.css        # ALL colors, fonts, radii, shadows (single dark TVA theme)
│   └── fonts.css         # self-hosted Jost, IBM Plex Sans/Mono, IBM Plex Sans Thai
├── index.css             # maps tokens to Tailwind utilities, base styles, motion
├── lib/
│   ├── types.ts          # API types (replace with openapi-typescript output later)
│   ├── api.ts            # fetch wrapper (session + CSRF)
│   ├── store.tsx         # app data context: dashboard data, import dialog, applyImport
│   ├── importConfig.ts   # AI import format v1: JSON cleanup, validation, preview plan
│   ├── aiImportPrompt.ts # the prompt users copy into ChatGPT/Claude/Gemini + example file
│   ├── format.ts         # dates/times in Asia/Bangkok, durations, percentages
├── components/
│   ├── import/           # ImportDialog (Import with AI)
│   ├── layout/           # AppShell, AppSidebar, AppHeader, MobileNav, Emblem, nav config
│   └── ui/               # Button, StatusStamp, RecordCard, StatCard, SectionHeader, PageHeader,
│                         # EmptyState, SkeletonRows, ErrorNotice, DataTable, CountdownPanel,
│                         # ResourceCard, FormField, Modal, Drawer
├── pages/
│   ├── Dashboard.tsx     # "Today's Briefing"
│   ├── dashboard/        # TodayDocket, WorkQueue, GradeStandingTable, DailyProtocol, WeeklyActivity
│   └── PlaceholderPage.tsx  # other modules, pending redesign
└── data/sampleDashboard.ts
```

## Import with AI

See [docs/AI_IMPORT_GUIDE.md](../docs/AI_IMPORT_GUIDE.md) for the user guide, the AI prompt, the format reference and the backend endpoint.

## Design rules (short version)

- Colors only through tokens (`bg-surface`, `text-ink-muted`, `text-accent-strong`…). Never hard-code hex in components.
- `accent-strong` is for orange text, `accent-fill` for primary buttons, `accent` for marks, rules and dots.
- Mono (`.tabular`) for numbers, codes, dates and times — not for paragraphs.
- `.micro` uppercase labels sparingly: section metadata, form labels, table headers.
- Stamps (`StatusStamp`) express state only.
- Radii 2–4px. Borders over shadows.

## Backend notes

The API contract is `../docs/university-os-spec.md` (v1.2). The dashboard uses the extended `/dashboard/summary/` response (Section 12.11) and the import dialog posts to `/imports/academic/` (Section 12.12).
