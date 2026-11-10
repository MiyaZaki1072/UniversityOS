> **Status (Nov 2026):** approved direction with one change — the app uses a **single dark-brown theme** (no light theme, no theme toggle). The tokens in `frontend/src/styles/tokens.css` are the source of truth for colors; Section 3 below is the original brief.

# University OS — TVA-Inspired UI/UX Design Direction

## 1. Design Vision

I want University OS to have a visual identity heavily inspired by the **Time Variance Authority (TVA) interiors and production design from Marvel's Loki, particularly the Season 1 and Season 2 TVA aesthetic.**

The intended visual direction is:

**1960s–1970s Retro-Futurism + Mid-Century Modernism + Brutalist Institutional Design.**

Imagine an alternate-history university administration system built inside the TVA headquarters.

The application should feel like a sophisticated academic administration terminal from an organization that has been operating since the 1960s, using technology and graphic design from that era.

It should feel:
- Institutional and bureaucratic.
- Retro-futuristic.
- Warm but slightly mysterious.
- Organized and systematic.
- Professional rather than playful.
- Nostalgic without looking outdated.
- Uniquely designed rather than looking like a generic SaaS dashboard.

The most important concept is:

**The UI should feel like you're working inside a retro-futuristic organization that manages time, records, and schedules. In this application, the things being managed are university life, semesters, grades, classes, and academic progress.**

This is an aesthetic reference, not a request to reproduce copyrighted TVA logos, artwork, characters, or exact movie assets. Create an original University OS identity using the same visual principles.

---

## 2. Visual References

Use these visual references as inspiration:

- TVA headquarters interiors from Loki.
- TVA reception and processing areas.
- TVA employee office desks.
- Retro CRT terminals and analog computers.
- 1960s government administration offices.
- 1970s institutional graphic design.
- Mid-century modern furniture and architectural patterns.
- Brutalist concrete architecture.

Important characteristics:

### Architecture
- Monumental architectural proportions.
- Symmetrical and geometric layouts.
- Concrete and stone-inspired surfaces.
- Strong horizontal and vertical lines.
- Large rectangular sections.
- Repeated circular or grid-based motifs.

### Furniture and materials
- Walnut and dark wood.
- Warm beige surfaces.
- Brushed metal.
- Muted olive-green furniture.
- Orange accents.
- Paper folders and physical documents.

### Technology
- CRT monitor aesthetics.
- Monochrome terminal displays.
- Analog control panels.
- Mechanical buttons and switches.
- Old computer interfaces.
- Typewriter-inspired details.

Do not make the application literally look like an old computer screen everywhere. The goal is to translate these visual characteristics into a modern and usable web application.

---

## 3. Color System

Use a warm, earthy TVA-inspired palette.

Suggested color tokens:

### Primary palette

| Token | Hex | Usage |
|---|---|---|
| Background | #E8E2D4 | Main application background |
| Surface | #F3EEE3 | Cards and content panels |
| Surface Secondary | #DCD4C4 | Secondary panels |
| Ink | #292820 | Main text |
| Muted Ink | #706B5E | Secondary text |
| Border | #BDB4A3 | Dividers and borders |
| TVA Orange | #C75C35 | Primary accent |
| Mustard | #D1A34A | Secondary accent |
| Olive | #77785B | Navigation and supporting elements |
| Walnut | #423329 | Dark surfaces |
| Sage | #89917A | Positive and informational accents |

These are initial design tokens, not rigid requirements. Adjust them after creating the first visual prototype.

### Color usage rules

- Cream and warm beige should dominate the main interface.
- Orange should be the primary accent, not the background of every component.
- Mustard yellow should be used for important information and highlights.
- Olive green should provide balance.
- Walnut brown should be used for dark structural sections.
- Avoid excessive saturation.
- Avoid bright neon colors.
- Avoid the typical blue-and-purple SaaS color palette.

The application should look warm, slightly aged, and sophisticated.

### Theme

Make the warm light theme the default.

An optional dark theme can be called "After Hours" or "Terminal Mode".

The dark theme should use:
- Deep walnut and charcoal surfaces.
- Cream text.
- Amber and muted orange indicators.
- Subtle green terminal accents.

Do not make the dark theme a generic pure-black cyberpunk interface.

---

## 4. Typography

Typography is an important part of the visual identity.

Use a combination of:

### Headings
Jost or another geometric sans-serif typeface inspired by mid-century graphic design.

Characteristics:
- Strong geometric shapes.
- Clean typography.
- Clear hierarchy.
- Slightly editorial appearance.

### Body text
IBM Plex Sans.

Characteristics:
- Excellent readability.
- Professional appearance.
- Suitable for academic data and forms.

### Monospaced information
IBM Plex Mono.

Use for:
- Course codes.
- Assessment IDs.
- Dates and timestamps.
- Countdown numbers.
- Grade calculations.
- System metadata.
- Technical labels.

Avoid using monospaced fonts for every paragraph.

Use a maximum of three main font families.

---

## 5. Layout and Navigation

The application should resemble an institutional administration system.

### Desktop layout

Use:
- A fixed vertical navigation sidebar.
- A structured top header.
- A large content area.
- Clear section titles.
- Breadcrumb navigation.
- Compact information panels.

The sidebar should feel like a department navigation panel inside an institutional building.

Possible branding:

UNIVERSITY OS
ACADEMIC RECORDS DIVISION

Include:
- Dashboard
- Calendar
- Courses
- Gradebook
- Tasks
- Habits
- Study Sessions
- Resource Hub
- Analytics
- Settings

Show the currently active semester somewhere in the sidebar or header.

### Header

The header should include:
- Current page title.
- Breadcrumbs.
- Current date.
- Current semester.
- Notifications.
- User profile.

Use uppercase micro-labels for institutional details, but keep normal text readable.

For example:

ACADEMIC RECORDS DIVISION
SEMESTER 1 / 2026
MONDAY, 10 NOVEMBER 2026

Do not overuse uppercase typography.

---

## 6. Component Design Language

Avoid generic rounded SaaS cards.

Use a more structured visual language.

### Cards

Use:
- Small corner radii.
- Thin borders.
- Flat surfaces.
- Subtle shadows only where appropriate.
- Colored side indicators.
- Small category labels.
- Structured content layouts.

Some cards can look like:
- Paper forms.
- Physical folders.
- Administrative records.
- Office documents.
- Indexed files.

Do not make everything look like a literal paper sheet. These references should remain subtle.

### Buttons

Primary buttons:
- Muted TVA orange.
- Dark readable text or white text depending on contrast.
- Compact rectangular appearance.
- Small corner radius.

Secondary buttons:
- Cream or transparent backgrounds.
- Thin borders.
- Dark text.

Avoid oversized pill-shaped buttons everywhere.

### Badges and statuses

Use institutional status labels:

- PENDING
- IN PROGRESS
- COMPLETED
- FILED
- OVERDUE
- UNGRADED
- FINALIZED

Style them like small printed or stamped labels.

Do not turn every piece of information into a badge.

### Tables

Tables are especially important because this application handles academic records.

Use:
- Structured rows.
- Subtle alternating backgrounds where useful.
- Thin horizontal dividers.
- Clear numerical alignment.
- Monospaced numerical information.
- Strong column headers.

The gradebook should feel like an official academic ledger.

### Icons

Use consistent, simple line icons.

Lucide icons are acceptable.

Avoid colorful emoji as the primary icon system.

---

## 7. Page-Specific Design Direction

Every page should have its own purpose but remain part of the same visual system.

### A. Dashboard — Daily Briefing

The dashboard should resemble an internal TVA daily briefing screen.

Suggested title:

"Today's Briefing"

Display:

- Current semester.
- Today's timetable.
- Upcoming examinations.
- Upcoming assignment deadlines.
- Daily habits.
- Study duration.
- Weekly progress.

Important element:

An "UPCOMING EXAMINATION" panel with a large countdown.

Example:

CALCULUS I
MIDTERM EXAMINATION

T-14 DAYS

The countdown should be visually prominent, using large monospaced numbers and orange/mustard accents.

Make the dashboard information-rich but not overcrowded.

### B. Courses — Academic Records

Course pages should resemble organized institutional records.

Each course card should show:
- Course code.
- Course name.
- Credits.
- Course color.
- Next scheduled class.
- Current grade status.

Opening a course should reveal sections:

- Overview.
- Timetable.
- Gradebook.
- Assessments.
- Resources.

The course page should feel like opening a categorized academic file.

### C. Gradebook — Academic Ledger

This is one of the most important interfaces.

The gradebook should resemble an official university grading ledger.

Use structured tables and clearly visible calculations.

Example:

COURSE: COMPUTER PROGRAMMING

| Component | Weight | Earned | Maximum |
|---|---:|---:|---:|
| Grader | 55% | 345 | 400 |
| Midterm | 20% | 80 | 100 |
| Final | 20% | — | 100 |
| Labwork | 5% | 90 | 100 |

Display:
- Weighted contributions.
- Current provisional grade.
- Final grade when available.
- Ungraded assessments.
- Category completion.

Make the grade breakdown transparent.

Use orange and mustard for important values, not every number.

The user should be able to edit scores and grading weights without navigating through many pages.

### D. Calendar — Temporal Scheduling

This should be one of the most visually distinctive pages.

Use an organized timetable inspired by:
- Institutional wall planners.
- Analog scheduling boards.
- Old office calendars.
- Numbered event records.

Display:
- Monthly calendar.
- Weekly timetable.
- Daily agenda.
- Exams.
- Quizzes.
- Class schedules.
- Assignment deadlines.

Use course colors consistently.

Exam countdowns should have their own dedicated visual treatment.

Calendar events should resemble organized schedule records, not colorful floating pills.

### E. Resource Hub — Internal Directory

This should resemble a TVA internal records and directory terminal.

Display categorized resources such as:

- Learning Platforms.
- University Websites.
- Programming.
- Development Tools.
- Course Materials.
- Personal Resources.

Each resource should look like an indexed file card.

Include:
- Website name.
- Description.
- Category.
- Optional icon.
- Favorite indicator.
- Open link action.

Support both global resources and course-specific resources.

Make the resource directory searchable.

### F. Tasks — Work Queue

Tasks should resemble an institutional work queue.

Display tasks in clear sections:

- Pending.
- In Progress.
- Completed.
- Overdue.

Use priority indicators and deadlines.

Allow users to organize large assignments into smaller subtasks in the future.

### G. Habits — Daily Protocol

Habits should resemble an organized daily checklist or administrative punch card.

Display:
- Daily habits.
- Weekly targets.
- Completion history.
- Consistency percentages.
- Calendar heatmap.

A weekly habit view could use a printed checklist aesthetic.

Avoid making the experience feel like a cartoon game.

### H. Study Sessions — Activity Log

Use a retro timing and activity-record concept.

Display:
- Active study session.
- Selected course.
- Session duration.
- Daily study records.
- Weekly totals.

The running timer can use a CRT-inspired numerical treatment without sacrificing readability.

### I. Analytics — Semester Report

This page should feel like an official institutional performance report.

Display:
- Study hours per course.
- Weekly study statistics.
- Habit consistency.
- Assignment completion.
- Academic grade summaries.

Use simple charts with the established palette.

Avoid generic colorful analytics dashboards.

---

## 8. Subtle Visual Details

These details can help establish the TVA identity without overwhelming the interface.

Consider:

- Small numbered division labels.
- Geometric circular decorations.
- Subtle radial patterns.
- Thin architectural grid lines.
- Paper-like backgrounds.
- Very subtle grain or noise texture.
- Retro-inspired section dividers.
- Stamped status labels.
- Terminal-style metadata.
- Large editorial page titles.
- Small institutional notices.

Possible decorative text:

ACADEMIC RECORDS
DIVISION 01
CURRENT SEMESTER
OFFICIAL STUDENT RECORD
SYSTEM STATUS: OPERATIONAL

Use these details sparingly.

Do not add meaningless decorative text everywhere.

---

## 9. Animation and Interaction

Use subtle, deliberate animations.

The UI should feel mechanical and precise rather than playful.

Examples:
- Small slide transitions when changing pages.
- Subtle fade-in for content.
- Quick stamp-like feedback when completing an item.
- Gentle hover changes.
- Smooth sidebar transitions.
- Small mechanical-feeling button feedback.

Avoid:
- Excessive bouncing.
- Huge parallax effects.
- Unnecessary 3D animations.
- Constant background animations.
- Overly dramatic transitions.

Respect the user's reduced-motion accessibility setting.

Animations should generally be short and should not slow down normal interactions.

---

## 10. Responsive Design

The application must work properly on desktop and mobile.

### Desktop
- Full sidebar.
- Spacious academic dashboard.
- Dense but readable gradebook tables.
- Full weekly timetable.

### Tablet
- Collapsible sidebar.
- Adaptive card grids.
- Responsive tables.

### Mobile
- Compact navigation.
- Bottom navigation or a small menu.
- Single-column dashboard.
- Touch-friendly controls.
- Readable examination countdowns.
- Responsive gradebook views.

Do not simply shrink the desktop layout.

Important information should remain readable and accessible.

---

## 11. What to Avoid

This is extremely important.

Do NOT create:

1. Generic modern SaaS dashboards.
2. Default Tailwind-looking interfaces.
3. Excessive rounded cards.
4. Glassmorphism.
5. Neon cyberpunk colors.
6. Purple/blue gradients.
7. Excessive shadows.
8. Excessive animations.
9. Random decorative icons.
10. Overly complicated skeuomorphic interfaces.
11. Tiny unreadable terminal text.
12. A literal recreation of the Loki TVA set.

Do not sacrifice usability for aesthetics.

This must still function as a serious academic management application.

The goal is to combine a recognizable retro-futuristic visual identity with modern web usability.

---

## 12. Technical Implementation Instructions

The current technology stack is:

- React.
- Vite.
- TypeScript.
- Tailwind CSS.
- Django REST Framework.
- PostgreSQL.

Before implementing the visual design:

1. Inspect the existing frontend.
2. Identify its current styling system and component library.
3. Understand the current routing and page structure.
4. Identify reusable components.
5. Avoid replacing working functionality unnecessarily.

Then:

### Step 1 — Design tokens

Create a central design system using CSS variables.

Define:
- Colors.
- Typography.
- Spacing.
- Borders.
- Radii.
- Shadows.
- Light theme.
- Optional dark theme.

### Step 2 — Core components

Build reusable components:

- AppSidebar.
- AppHeader.
- PageHeader.
- StatCard.
- RecordCard.
- StatusStamp.
- DataTable.
- SectionHeader.
- CountdownPanel.
- ResourceCard.
- EmptyState.
- FormField.
- Modal.
- Drawer.

### Step 3 — Application shell

Build the complete responsive application shell.

It should establish the visual identity before individual modules are implemented.

### Step 4 — Dashboard prototype

Build the Dashboard first using realistic sample data.

The Dashboard must demonstrate the complete visual direction.

### Step 5 — Apply the design system

Once the dashboard looks correct, apply the design system consistently to:
- Courses.
- Gradebook.
- Calendar.
- Resource Hub.
- Tasks.
- Habits.
- Study Sessions.
- Analytics.

### Step 6 — Quality review

Check:
- Visual consistency.
- Responsive behavior.
- Readability.
- Accessibility.
- Loading states.
- Empty states.
- Error states.
- Existing functionality.

Do not modify the Django backend or database as part of a frontend-only visual redesign unless absolutely necessary.

---

## 13. Expected Deliverables

Before implementation, provide:

1. A short explanation of how the TVA design direction will be translated into University OS.
2. A proposed color palette.
3. A typography system.
4. An application layout proposal.
5. A reusable component plan.
6. A dashboard design proposal.
7. A list of existing frontend files that need modification.

Then implement the visual foundation and Dashboard as the first vertical slice.

Do not redesign every page at once.

After the first dashboard implementation, summarize what was changed and let me review the visual direction before extending it to all other modules.

**Final design goal:**

University OS should look like an academic department inside a retro-futuristic TVA headquarters — an organized, warm, authoritative 1960s–1970s institution that manages every detail of university life through an elegant administrative interface.