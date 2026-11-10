# University OS — Backend Architecture & API Specification

**Version:** 1.2  
**Status:** Initial implementation specification  
**Backend:** Django + Django REST Framework  
**Database:** PostgreSQL  
**Frontend:** React + Vite + TypeScript  
**Deployment:** Docker Compose on ZimaOS  
**API Prefix:** `/api/v1/`

---

## Changes

### 1.2

| # | Area | Change |
|---|---|---|
| 1 | Imports | New AI-assisted academic import: `POST /api/v1/imports/academic/` accepts a `university-os/v1` JSON file (Section 12.12). |
| 2 | Dashboard | `/dashboard/summary/` now also returns `courses`, `habits.items`, `study.week_by_day`, `study.weekly_target_minutes`, semester dates and `grade_standing`, which the Dashboard screen needs (Section 12.11). |

### 1.1 (changes from 1.0)

| # | Area | Change |
|---|---|---|
| 1 | Project structure | Renamed the `calendar` Django app to `scheduling` to avoid shadowing Python's standard-library `calendar` module. URL paths (`/calendar/...`) are unchanged. |
| 2 | Semester | Added `is_archived`, archive/unarchive endpoints, and rules tying archiving to activation and deletion. |
| 3 | ClassMeeting | `starts_on` / `ends_on` are now optional and default to the parent semester's dates. Explicit dates must fall within the semester. |
| 4 | Gradebook | `letter_grade` is only returned when the course is fully graded. Added `projected_letter_grade` and `is_final`. Fixed the inconsistent grade-summary example. Grade scales must include a 0% band. Defined decimal precision rules. |
| 5 | Tasks | Added an optional one-to-one link from Task to Assessment so a graded assignment's deadline lives in one place. |
| 6 | Calendar | Assessment deadlines without a linked task now appear in the agenda. Occurrence `source_type` values are defined explicitly. |
| 7 | Data model | Added `GradeScaleBand` and the Task → Assessment link to the entity diagram; added `updated_at` to ClassMeeting. |

---

# 1. Project Overview

University OS is a personal academic management application designed to organize university life in one centralized platform.

It provides academic management, grade calculation, timetable management, university resources, personal productivity, and academic analytics.

## 1.1 Main Modules

| Module | Responsibility | Priority |
|---|---|---|
| Accounts | Authentication and user preferences | P0 |
| Semesters | Academic semester management | P0 |
| Courses | Course information and timetable | P0 |
| Gradebook | Custom grading systems and score calculation | P0 |
| Calendar | Classes, exams, deadlines, and ICS imports | P0 |
| Resources | Global and course-specific links | P0 |
| Tasks | Assignment and deadline management | P1 |
| Habits | University habit tracking | P1 |
| Study Sessions | Study time tracking | P1 |
| Analytics | Academic and productivity statistics | P2 |
| Imports | AI-assisted bulk import of semesters and courses | P1 |

P0 represents the initial usable product. P1 and P2 can be implemented after the core application works.

## 1.2 Design Principles

1. Every piece of academic information should belong to an appropriate semester, course, or user.
2. Grade calculations must be performed by the backend, not trusted to the frontend.
3. Recurring classes should not need to be manually entered every week.
4. Calendar events should have a consistent format regardless of their source.
5. Imported calendar events must not create duplicates when the same file is imported again.
6. Old semesters and their data must remain accessible.
7. The frontend should communicate with Django exclusively through JSON APIs, except for file uploads such as ICS imports.
8. Each fact (such as a deadline) should be stored in exactly one place.

## 1.3 Important Assumptions

- The application initially has one authorized user.
- Public registration is disabled.
- All user-owned models retain ownership information so the application can support additional accounts later.
- The default timezone is `Asia/Bangkok`, configurable in user preferences.
- Grade category weights are percentages and should total 100%.
- Individual assessments use points earned and points possible.
- Ungraded assessments are different from assessments with a score of zero.
- Calendar deadlines associated with tasks and assessments are generated from those records rather than duplicated as independent events.

---

# 2. Backend Project Structure

Use a modular Django architecture.

```text
backend/
│
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── urls.py
│   ├── asgi.py
│   └── wsgi.py
│
├── apps/
│   ├── accounts/
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   │
│   ├── academics/
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   │
│   ├── gradebook/
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── services.py
│   │   ├── views.py
│   │   └── urls.py
│   │
│   ├── scheduling/          # calendar events, ICS import, agenda
│   │   ├── models.py
│   │   ├── services.py
│   │   ├── ics_parser.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   │
│   ├── resources/
│   ├── tasks/
│   ├── habits/
│   ├── study_sessions/
│   ├── imports/             # AI-assisted academic import
│   └── dashboard/
│
├── common/
│   ├── permissions.py
│   ├── pagination.py
│   └── exceptions.py
│
├── manage.py
└── requirements.txt
```

> **Why `scheduling` and not `calendar`:** a module named `calendar` can shadow Python's standard-library `calendar` module, which Django and third-party packages import. This causes confusing import errors. Set each app's `AppConfig.name` to its full dotted path (e.g. `apps.scheduling`).

### Architecture rules

- Keep models responsible for data representation and database relationships.
- Keep serializers responsible for API validation and serialization.
- Keep views responsible for HTTP requests and responses.
- Put grade calculations and calendar generation into service modules.
- Avoid putting complicated calculations directly inside serializers or views.
- Use Django transactions when several related records must be modified together.

---

# 3. Database Architecture

Use PostgreSQL with Django's default `BigAutoField` primary keys.

Use `settings.AUTH_USER_MODEL` for user relationships rather than directly referencing Django's built-in User model.

## 3.1 Entity Relationships

```text
User
│
├── UserProfile
│
├── Semester
│   └── Course
│       ├── GradeCategory
│       │   └── Assessment ◄─────────┐
│       │                            │ optional 1:1
│       ├── GradeScaleBand           │
│       └── ClassMeeting             │
│                                    │
├── Task ────────────────────────────┘
│
├── CalendarEvent
├── CalendarImport
│
├── Habit
│   └── HabitLog
│
├── StudySession
│
├── ResourceCategory
└── ResourceLink
     └── Optional Course relationship
```

Some records are associated through their parent object. For example, an Assessment belongs to a GradeCategory, which belongs to a Course, which belongs to a Semester, which belongs to a User.

This ownership chain must be respected by all API queries.

---

# 4. Database Models

## 4.1 Accounts

### UserProfile

One-to-one extension of the Django User model.

| Field | Type | Description |
|---|---|---|
| id | BigAutoField | Primary key |
| user | OneToOneField | Account owner |
| display_name | CharField(100) | Display name |
| timezone | CharField(50) | Default: Asia/Bangkok |
| week_starts_on | SmallIntegerField | 0 = Monday |
| created_at | DateTimeField | Creation timestamp |
| updated_at | DateTimeField | Last modification |

**Constraints:**
- One profile per user.
- `timezone` must be a valid IANA timezone.

## 4.2 Academic Management

### Semester

Represents an academic semester.

| Field | Type | Description |
|---|---|---|
| id | BigAutoField | Primary key |
| user | ForeignKey(User) | Owner |
| name | CharField(100) | e.g. Semester 1 / 2026 |
| academic_year | CharField(20) | e.g. 2026/2027 |
| term | CharField(30) | e.g. Semester 1 |
| start_date | DateField | Semester start |
| end_date | DateField | Semester end |
| is_active | BooleanField | Current semester |
| is_archived | BooleanField | Hidden from default lists; default false |
| created_at | DateTimeField | Creation timestamp |
| updated_at | DateTimeField | Last modification |

**Constraints:**
- `end_date` must be greater than or equal to `start_date`.
- Only one active semester per user.
- A semester cannot be both active and archived (database `CheckConstraint`).
- Archiving the active semester clears `is_active`.
- An archived semester cannot be activated; unarchive it first.
- Deleting a semester is not allowed while it contains courses; archive it instead. The API returns `409 Conflict` with code `semester_not_empty`.
- Archived semesters and all their data remain fully readable and editable.

### Course

Represents a university course.

| Field | Type | Description |
|---|---|---|
| id | BigAutoField | Primary key |
| semester | ForeignKey(Semester) | Parent semester |
| code | CharField(30) | Course code |
| name | CharField(150) | Course name |
| credits | DecimalField(4,1) | Credit value |
| description | TextField | Optional description |
| color | CharField(7) | Hex color |
| instructor | CharField(150) | Optional instructor |
| created_at | DateTimeField | Creation timestamp |
| updated_at | DateTimeField | Last modification |

**Constraints:**
- Course code should be unique within a semester.
- Course must belong to a semester owned by the authenticated user.
- Course credits must be non-negative.
- `color` must match `^#[0-9A-Fa-f]{6}$`.

### ClassMeeting

Represents a recurring weekly class.

| Field | Type | Description |
|---|---|---|
| id | BigAutoField | Primary key |
| course | ForeignKey(Course) | Associated course |
| weekday | SmallIntegerField | 0 = Monday, 6 = Sunday |
| start_time | TimeField | Start time |
| end_time | TimeField | End time |
| starts_on | DateField | Optional first applicable date |
| ends_on | DateField | Optional last applicable date |
| timezone | CharField(50) | IANA timezone; defaults to the user's profile timezone |
| location | CharField(150) | Classroom |
| created_at | DateTimeField | Creation timestamp |
| updated_at | DateTimeField | Last modification |

**Effective date range:**

```text
effective_starts_on = starts_on if set, otherwise semester.start_date
effective_ends_on   = ends_on   if set, otherwise semester.end_date
```

Leaving the fields blank means the meeting follows the semester. If the semester dates change later, those meetings follow automatically. Set explicit dates only when a class starts late or ends early.

**Constraints:**
- `end_time` must be later than `start_time`.
- If both are set, `ends_on` must be later than or equal to `starts_on`.
- If set, `starts_on` and `ends_on` must fall within the parent semester's dates.
- Weekday must be between 0 and 6.

The API returns both the stored fields and the computed `effective_starts_on` / `effective_ends_on`.

One ClassMeeting represents one weekly occurrence pattern. A course can have multiple ClassMeeting records.

Example:

```text
Computer Programming

Monday:
09:00 - 12:00
Engineering Building, Room 301

Wednesday:
13:00 - 16:00
Engineering Building, Room 301
```

The backend generates the corresponding calendar occurrences within each meeting's effective date range.

---

# 5. Gradebook System

This module must be flexible enough to support different grading configurations for every course.

The core relationship is:

```text
Course
  │
  ├── GradeCategory
  │      │
  │      └── Assessment
  │
  └── GradeScaleBand
```

## 5.1 GradeCategory

Represents a weighted grading component.

Examples:
- Grader: 55%
- Midterm: 20%
- Final: 20%
- Labwork: 5%

| Field | Type | Description |
|---|---|---|
| id | BigAutoField | Primary key |
| course | ForeignKey(Course) | Parent course |
| name | CharField(100) | Category name |
| weight_percent | DecimalField(5,2) | Percentage of final grade |
| display_order | PositiveIntegerField | Sorting |
| created_at | DateTimeField | Creation timestamp |
| updated_at | DateTimeField | Last modification |

**Constraints:**
- Weight must be between 0 and 100.
- Total category weights must not exceed 100.
- Categories can temporarily total less than 100 while the user is configuring the gradebook.
- Letter grades (final or projected) are only available when category weights total exactly 100%.

Default aggregation method: `SUM_POINTS`.

## 5.2 Assessment

An individual graded item within a category.

Examples:
- Programming Assignment 1
- Programming Assignment 2
- Midterm Examination
- Final Examination

| Field | Type | Description |
|---|---|---|
| id | BigAutoField | Primary key |
| category | ForeignKey(GradeCategory) | Parent category |
| title | CharField(150) | Assessment name |
| points_possible | DecimalField(9,2) | Maximum points |
| points_earned | DecimalField(9,2) | Earned points, nullable |
| due_at | DateTimeField | Optional deadline |
| graded_at | DateTimeField | Optional grading timestamp |
| display_order | PositiveIntegerField | Sorting |
| notes | TextField | Optional notes |
| created_at | DateTimeField | Creation timestamp |
| updated_at | DateTimeField | Last modification |

**Important validation:**
- `points_possible` must be greater than zero.
- `points_earned` must be greater than or equal to zero.
- `points_earned` cannot exceed `points_possible` in version 1.
- A null `points_earned` means ungraded.
- A value of zero means graded with zero points.

The backend must never convert null scores into zero.

`Assessment.due_at` is the single source of truth for the deadline of a graded item. If a Task is linked to this assessment (see Section 7), the task uses this deadline.

## 5.3 Grade Calculation Rules

### Decimal precision

- All calculations use Python `Decimal`, never `float`.
- Calculate at full precision. Do not round intermediate values.
- Serialize results as JSON strings without rounding. The frontend rounds for display.
- Letter-grade lookups use the unrounded percentage.

### Category calculation

For `SUM_POINTS`:

```text
category_percentage =
    SUM(graded points_earned)
    /
    SUM(graded points_possible)
    * 100
```

Only graded assessments are included. A category with no graded assessments (including a category with no assessments at all) has `category_percentage: null` and contributes nothing.

Then:

```text
weighted_contribution =
    category_percentage
    * category_weight
    / 100
```

Example:

```text
Grader:
    Assignment 1: 95 / 100
    Assignment 2: 80 / 100
    Assignment 3: 170 / 200

Total earned: 345
Total possible: 400

Category percentage = 86.25%

Category weight = 55%

Weighted contribution = 47.4375
```

### Overall course calculation

Suppose a course contains:

| Category | Weight | Category score | Contribution |
|---|---:|---:|---:|
| Grader | 55% | 86.25% | 47.4375 |
| Midterm | 20% | 80% | 16 |
| Final | 20% | Ungraded | — |
| Labwork | 5% | 90% | 4.5 |

Weighted contribution earned toward the final grade:

```text
47.4375 + 16 + 4.5 = 67.9375
```

The graded category weight is:

```text
55 + 20 + 5 = 80%
```

The provisional grade across categories with scores is:

```text
67.9375 / 80 * 100 = 84.921875%
```

Display both figures. Do not show 67.94% as the student's current grade without explaining that 20% of the category weight is not yet graded.

### Final vs. provisional

A course grade is **final** (`is_final: true`) only when all of the following hold:

1. `weight_status` is `valid` (weights total exactly 100%).
2. Every category with a weight above zero has at least one graded assessment.
3. There are no ungraded assessments in the course.

Otherwise the grade is provisional (`is_final: false`).

### Letter grades

| Field | Returned when | Based on |
|---|---|---|
| `projected_letter_grade` | `weight_status` is `valid`, `current_grade` is not null, and a grade scale exists | `current_grade` (normalized provisional grade) |
| `letter_grade` | `is_final` is true and a grade scale exists | `current_grade` (which equals the final grade when complete) |

Otherwise each field is `null`. The frontend should label `projected_letter_grade` clearly as projected (e.g. "Projected: A").

### Weight status values

| Value | Meaning |
|---|---|
| `valid` | Weights total exactly 100.00 |
| `underweight` | Weights total less than 100.00 |
| `invalid` | Weights total more than 100.00 (should be prevented by validation, but reported if it occurs) |
| `empty` | Course has no categories |

### Required grade summary fields

For the four-category example above, with the default grade scale from 5.4:

```json
{
  "weight_total": "100.00",
  "weight_status": "valid",
  "weighted_contribution": "67.9375",
  "graded_category_weight": "80.00",
  "current_grade": "84.921875",
  "is_final": false,
  "ungraded_assessments": 1,
  "projected_letter_grade": "A",
  "letter_grade": null
}
```

`current_grade` represents the normalized result across categories with graded assessments.

If no categories have grades, return `current_grade: null`.

These calculations must live in `gradebook/services.py`.

## 5.4 GradeScaleBand

Stores custom letter-grade boundaries for each course.

| Field | Type | Description |
|---|---|---|
| id | BigAutoField | Primary key |
| course | ForeignKey(Course) | Parent course |
| grade_label | CharField(10) | A, B+, B, C, etc. |
| minimum_percentage | DecimalField(5,2) | Inclusive minimum |
| grade_point | DecimalField(4,2) | GPA equivalent |
| display_order | PositiveIntegerField | Sorting |

Example:

| Grade | Minimum percentage | Grade point |
|---|---:|---:|
| A | 80 | 4.0 |
| B+ | 75 | 3.5 |
| B | 70 | 3.0 |
| C+ | 65 | 2.5 |
| C | 60 | 2.0 |
| D+ | 55 | 1.5 |
| D | 50 | 1.0 |
| F | 0 | 0.0 |

Rules:
- Minimum percentage must be between 0 and 100.
- Minimum percentage values must be unique within a course.
- Grade labels must be unique within a course.
- A non-empty scale must include a band with `minimum_percentage` of `0.00`, so every percentage maps to a grade.
- Higher minimum percentages must have grade points greater than or equal to lower ones.
- The backend selects the band with the highest minimum threshold not greater than the percentage.
- GPA is not automatically calculated using assumed university rules. The user must configure the appropriate scale.

---

# 6. Calendar System

Implemented in the `scheduling` app.

The calendar combines these sources:

1. Recurring class schedules (ClassMeeting).
2. Manually created calendar events.
3. Imported ICS events.
4. Task deadlines.
5. Assessment deadlines that have no linked task.

Task and assessment deadlines appear in calendar output but remain owned by their own models.

## 6.1 CalendarEvent

Represents an individual event or an imported calendar event.

| Field | Type | Description |
|---|---|---|
| id | BigAutoField | Primary key |
| user | ForeignKey(User) | Owner |
| course | ForeignKey(Course) | Optional course |
| title | CharField(200) | Event title |
| description | TextField | Optional description |
| event_type | CharField(30) | Event classification |
| start_at | DateTimeField | Start datetime |
| end_at | DateTimeField | End datetime |
| is_all_day | BooleanField | All-day event |
| timezone | CharField(50) | IANA timezone |
| location | CharField(200) | Optional location |
| source | CharField(20) | MANUAL or ICS |
| external_uid | CharField(255) | Optional ICS UID |
| recurrence_rule | TextField | Optional RRULE |
| exdates | JSONField | Recurrence exclusions |
| import_batch | ForeignKey(CalendarImport) | Optional import source |
| created_at | DateTimeField | Creation timestamp |
| updated_at | DateTimeField | Last modification |

Event types:

```text
EXAM
QUIZ
EVENT
PERSONAL
OTHER
```

**Constraints:**
- `end_at` must not precede `start_at`.
- Course must belong to the authenticated user.
- Manual events have no external UID.
- Imported event UIDs must be unique per user.
- All-day event end dates follow the iCalendar exclusive-end convention.

For recurring ICS events, the backend stores the recurrence rule and exclusions and expands occurrences within requested calendar ranges.

## 6.2 CalendarImport

Tracks ICS imports.

| Field | Type | Description |
|---|---|---|
| id | BigAutoField | Primary key |
| user | ForeignKey(User) | Owner |
| original_filename | CharField(255) | Uploaded filename |
| status | CharField(20) | Processing status |
| imported_count | PositiveIntegerField | New events |
| updated_count | PositiveIntegerField | Existing events updated |
| skipped_count | PositiveIntegerField | Skipped events |
| warnings | JSONField | Import warnings |
| created_at | DateTimeField | Import timestamp |

Statuses:

```text
PROCESSING
COMPLETED
FAILED
```

### ICS import behavior

- Accept `.ics` files through multipart/form-data.
- Validate file contents before importing.
- Extract VEVENT records.
- Preserve event timestamps and timezones.
- Preserve recurrence rules where supported.
- Deduplicate events using their iCalendar UID.
- Re-importing the same calendar should update matching events instead of creating duplicates.
- Do not automatically delete existing events when importing a new file.
- Return warnings for unsupported recurrence features or invalid events.

For the first version, support recurring VEVENT records with RRULE and EXDATE. Detached recurrence exceptions (VEVENTs with `RECURRENCE-ID`) are skipped with a warning; they and other advanced calendar features can be added later.

Suggested parsing dependencies: `icalendar` and a recurrence expansion library such as `python-dateutil`.

## 6.3 Calendar Occurrence API

The frontend should not independently implement recurring-event generation.

The backend provides a unified list of occurrences from all sources listed in Section 6.

### Occurrence source types

| `source_type` | Origin | ID format |
|---|---|---|
| `class_meeting` | ClassMeeting expanded per date | `class-{meeting_id}-{YYYYMMDD}` |
| `calendar_event` | Non-recurring CalendarEvent | `event-{event_id}` |
| `calendar_event` | Recurring CalendarEvent occurrence | `event-{event_id}-{YYYYMMDD}` |
| `task_deadline` | Task with an effective due date | `task-{task_id}` |
| `assessment_deadline` | Assessment with `due_at` and no linked task | `assessment-{assessment_id}` |

An assessment with a linked task appears only once, as a `task_deadline`, so it is never shown twice.

Example:

```json
{
  "date": "2026-11-25",
  "events": [
    {
      "id": "class-12-20261125",
      "source_type": "class_meeting",
      "title": "Calculus I",
      "start_at": "2026-11-25T09:00:00+07:00",
      "end_at": "2026-11-25T12:00:00+07:00",
      "location": "Engineering Building",
      "course_id": 1
    },
    {
      "id": "event-22",
      "source_type": "calendar_event",
      "title": "Calculus I Midterm",
      "start_at": "2026-11-25T13:00:00+07:00",
      "end_at": "2026-11-25T15:00:00+07:00",
      "location": "Exam Room",
      "course_id": 1
    },
    {
      "id": "task-41",
      "source_type": "task_deadline",
      "title": "Problem Set 3",
      "start_at": "2026-11-25T23:59:00+07:00",
      "end_at": "2026-11-25T23:59:00+07:00",
      "location": null,
      "course_id": 1
    }
  ]
}
```

Generated occurrence IDs are not database primary keys.

All calendar queries must accept a date range to avoid generating an entire semester at once.

---

# 7. Task Management

## 7.1 Task

| Field | Type | Description |
|---|---|---|
| id | BigAutoField | Primary key |
| user | ForeignKey(User) | Owner |
| course | ForeignKey(Course) | Optional course |
| assessment | OneToOneField(Assessment) | Optional linked gradebook item; nullable, `on_delete=SET_NULL` |
| title | CharField(200) | Task name |
| description | TextField | Optional description |
| task_type | CharField(30) | ASSIGNMENT, LAB, QUIZ, EXAM, READING, OTHER |
| priority | CharField(20) | LOW, MEDIUM, HIGH |
| status | CharField(20) | TODO, IN_PROGRESS, COMPLETED |
| due_at | DateTimeField | Optional deadline (only for unlinked tasks) |
| estimated_minutes | PositiveIntegerField | Estimated work time |
| completed_at | DateTimeField | Completion timestamp |
| created_at | DateTimeField | Creation timestamp |
| updated_at | DateTimeField | Last modification |

### Linking a task to an assessment

A graded assignment often needs both a gradebook entry and a to-do item. To keep the deadline in one place:

- When `assessment` is set, the deadline comes from `Assessment.due_at`. The task's own `due_at` must be null; the API rejects a `due_at` value on a linked task with a validation error.
- When `assessment` is set, `course` is set automatically to the assessment's course. A conflicting `course` value is rejected.
- The assessment must belong to the authenticated user.
- Each assessment can have at most one linked task.
- If the linked assessment is deleted, the task remains and becomes unlinked (with no due date).
- The API returns a read-only `effective_due_at`: the assessment's `due_at` for linked tasks, or the task's own `due_at` otherwise.

All due-date filtering, calendar output, and dashboard deadlines use `effective_due_at`.

Completion and assessment grading are separate concepts. Completing a task does not assign a grade, and grading an assessment does not complete its task.

---

# 8. Habit Tracking

## 8.1 Habit

| Field | Type | Description |
|---|---|---|
| id | BigAutoField | Primary key |
| user | ForeignKey(User) | Owner |
| course | ForeignKey(Course) | Optional course |
| name | CharField(120) | Habit name |
| description | TextField | Optional description |
| frequency_type | CharField(20) | DAILY or WEEKLY |
| target_per_week | PositiveSmallIntegerField | Weekly target |
| days_of_week | JSONField | Optional scheduled weekdays |
| target_minutes | PositiveIntegerField | Optional duration goal |
| starts_on | DateField | Start date |
| ends_on | DateField | Optional end date |
| is_active | BooleanField | Active status |
| created_at | DateTimeField | Creation timestamp |

## 8.2 HabitLog

| Field | Type | Description |
|---|---|---|
| id | BigAutoField | Primary key |
| habit | ForeignKey(Habit) | Parent habit |
| date | DateField | Completion date |
| status | CharField(20) | COMPLETED or SKIPPED |
| duration_minutes | PositiveIntegerField | Optional duration |
| note | TextField | Optional note |
| created_at | DateTimeField | Creation timestamp |

**Constraint:** Unique combination of `(habit, date)`.

A user must not be able to accidentally create multiple completion logs for the same habit and date.

---

# 9. Study Session Tracking

## StudySession

| Field | Type | Description |
|---|---|---|
| id | BigAutoField | Primary key |
| user | ForeignKey(User) | Owner |
| course | ForeignKey(Course) | Optional course |
| task | ForeignKey(Task) | Optional task |
| started_at | DateTimeField | Starting timestamp |
| ended_at | DateTimeField | Ending timestamp, nullable |
| note | TextField | Optional description |
| created_at | DateTimeField | Creation timestamp |

Duration is calculated from `ended_at - started_at`.

A null `ended_at` represents an active session.

Constraints:
- End time cannot be earlier than start time.
- At most one active session per user.
- The user cannot stop another user's session.

---

# 10. Resource Hub

The Resource Hub supports both global university links and course-specific resources.

## 10.1 ResourceCategory

| Field | Type | Description |
|---|---|---|
| id | BigAutoField | Primary key |
| user | ForeignKey(User) | Owner |
| name | CharField(100) | Category name |
| icon | CharField(50) | Optional icon |
| display_order | PositiveIntegerField | Sorting |
| created_at | DateTimeField | Creation timestamp |

Example categories:

```text
University
Learning Platforms
Programming
Development Tools
Personal
```

## 10.2 ResourceLink

| Field | Type | Description |
|---|---|---|
| id | BigAutoField | Primary key |
| user | ForeignKey(User) | Owner |
| category | ForeignKey(ResourceCategory) | Optional category |
| course | ForeignKey(Course) | Optional course |
| title | CharField(150) | Link title |
| url | URLField | Destination URL |
| description | TextField | Optional description |
| icon | CharField(100) | Optional icon |
| is_favorite | BooleanField | Favorite status |
| display_order | PositiveIntegerField | Sorting |
| created_at | DateTimeField | Creation timestamp |
| updated_at | DateTimeField | Last modification |

Rules:

- A resource with `course = null` is global.
- A resource with a course belongs to that specific course.
- Resource categories are user-owned.
- A resource can be filtered by category, course, or favorite status.
- Validate the URL scheme and accept only HTTP and HTTPS.
- Opening links happens through the frontend, not the backend.
- Deleting a category sets `category` to null on its links (`on_delete=SET_NULL`).

---

# 11. Database Constraints and Indexes

Use database-level constraints wherever possible.

| Model | Constraint / Index |
|---|---|
| Semester | Unique active semester per user (conditional `UniqueConstraint` where `is_active=True`) |
| Semester | Check: not (`is_active` and `is_archived`) |
| Course | Unique `(semester, code)` |
| GradeCategory | Index by course and display order |
| Assessment | Index by category |
| GradeScaleBand | Unique `(course, minimum_percentage)` |
| GradeScaleBand | Unique `(course, grade_label)` |
| ClassMeeting | Index by course and weekday |
| CalendarEvent | Index by user and start_at |
| CalendarEvent | Unique `(user, external_uid)` when `external_uid` is non-null |
| Task | Index by user and due_at |
| Task | Unique `assessment` when non-null (implicit with OneToOneField) |
| Task | Check: `due_at` is null when `assessment` is set |
| HabitLog | Unique `(habit, date)` |
| StudySession | At most one active session per user (conditional `UniqueConstraint` where `ended_at` is null) |
| ResourceCategory | Unique `(user, name)` |
| ResourceLink | Index by user, category, and course |

Use Django `UniqueConstraint`, `CheckConstraint`, and conditional constraints where appropriate.

Some rules, such as total grade-category weights not exceeding 100%, ClassMeeting dates falling within the semester, and grade scales including a 0% band, involve multiple rows or tables. Validate them in the service layer inside a database transaction rather than with a row-level check constraint.

---

# 12. REST API Specification

Base URL:

```text
/api/v1/
```

All endpoints return JSON except file upload requests.

Use:
- `GET` to retrieve.
- `POST` to create.
- `PATCH` to partially update.
- `PUT` to replace a resource.
- `DELETE` to delete.

Use decimal values as JSON strings to preserve precision.

## 12.1 Authentication

Since this is a personal application, public registration is disabled.

Use Django SessionAuthentication for the React frontend, with HTTPS, secure HttpOnly session cookies, and CSRF protection.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/auth/csrf/` | Obtain CSRF cookie |
| POST | `/auth/login/` | Log in |
| POST | `/auth/logout/` | Log out |
| GET | `/auth/me/` | Current user information |

### GET `/auth/me/`

Response:

```json
{
  "id": 1,
  "username": "freyr",
  "display_name": "Freyr",
  "timezone": "Asia/Bangkok"
}
```

Do not implement a public registration endpoint in version 1.

## 12.2 Semesters

| Method | Endpoint | Description |
|---|---|---|
| GET | `/semesters/` | List semesters |
| POST | `/semesters/` | Create semester |
| GET | `/semesters/{id}/` | Get semester |
| PATCH | `/semesters/{id}/` | Update semester |
| DELETE | `/semesters/{id}/` | Delete empty semester (409 if it has courses) |
| POST | `/semesters/{id}/activate/` | Set active semester (400 if archived) |
| POST | `/semesters/{id}/archive/` | Archive semester (also deactivates it) |
| POST | `/semesters/{id}/unarchive/` | Restore archived semester |

Filters:

```text
GET /semesters/                  # non-archived only (default)
GET /semesters/?archived=true    # archived only
GET /semesters/?archived=all     # everything
```

Example POST:

```json
{
  "name": "Semester 1 / 2026",
  "academic_year": "2026/2027",
  "term": "Semester 1",
  "start_date": "2026-08-01",
  "end_date": "2026-12-15"
}
```

## 12.3 Courses

| Method | Endpoint | Description |
|---|---|---|
| GET | `/courses/` | List courses |
| POST | `/courses/` | Create course |
| GET | `/courses/{id}/` | Get course |
| PATCH | `/courses/{id}/` | Update course |
| DELETE | `/courses/{id}/` | Delete course without dependent data (409 otherwise) |

Filters:

```text
GET /courses/?semester=1
GET /courses/?search=calculus
```

Example POST:

```json
{
  "semester": 1,
  "code": "CP101",
  "name": "Computer Programming",
  "credits": "3.0",
  "color": "#3567FF"
}
```

## 12.4 Class Meetings

| Method | Endpoint | Description |
|---|---|---|
| GET | `/courses/{course_id}/class-meetings/` | List class meetings |
| POST | `/courses/{course_id}/class-meetings/` | Create class meeting |
| PATCH | `/class-meetings/{id}/` | Update meeting |
| DELETE | `/class-meetings/{id}/` | Delete meeting |

Example POST (follows semester dates):

```json
{
  "weekday": 0,
  "start_time": "09:00:00",
  "end_time": "12:00:00",
  "location": "Engineering Building 301"
}
```

Example POST (class starts late):

```json
{
  "weekday": 2,
  "start_time": "13:00:00",
  "end_time": "16:00:00",
  "starts_on": "2026-09-01",
  "timezone": "Asia/Bangkok",
  "location": "Engineering Building 301"
}
```

Example response:

```json
{
  "id": 12,
  "course": 1,
  "weekday": 2,
  "start_time": "13:00:00",
  "end_time": "16:00:00",
  "starts_on": "2026-09-01",
  "ends_on": null,
  "effective_starts_on": "2026-09-01",
  "effective_ends_on": "2026-12-15",
  "timezone": "Asia/Bangkok",
  "location": "Engineering Building 301"
}
```

## 12.5 Gradebook

### Grade Categories

| Method | Endpoint | Description |
|---|---|---|
| GET | `/courses/{course_id}/grade-categories/` | List categories |
| POST | `/courses/{course_id}/grade-categories/` | Create category |
| PATCH | `/grade-categories/{id}/` | Update category |
| DELETE | `/grade-categories/{id}/` | Delete category |

Example POST:

```json
{
  "name": "Grader",
  "weight_percent": "55.00",
  "display_order": 1
}
```

### Assessments

| Method | Endpoint | Description |
|---|---|---|
| GET | `/grade-categories/{category_id}/assessments/` | List assessments |
| POST | `/grade-categories/{category_id}/assessments/` | Create assessment |
| GET | `/assessments/{id}/` | Get assessment |
| PATCH | `/assessments/{id}/` | Update assessment or score |
| DELETE | `/assessments/{id}/` | Delete assessment |

Example POST:

```json
{
  "title": "Problem Set 1",
  "points_possible": "100.00",
  "points_earned": "95.00",
  "display_order": 1
}
```

For an ungraded assignment with a deadline:

```json
{
  "title": "Problem Set 2",
  "points_possible": "100.00",
  "points_earned": null,
  "due_at": "2026-11-20T23:59:00+07:00",
  "display_order": 2
}
```

Assessment responses include `linked_task_id` (or `null`).

### Grade Summary

| Method | Endpoint | Description |
|---|---|---|
| GET | `/courses/{course_id}/grade-summary/` | Calculate course grade |

Example response — a course with weights totalling 100% where only Grader has graded work (the other categories have only ungraded assessments):

```json
{
  "course_id": 1,
  "course_name": "Computer Programming",
  "weight_total": "100.00",
  "weight_status": "valid",
  "weighted_contribution": "47.4375",
  "graded_category_weight": "55.00",
  "current_grade": "86.25",
  "is_final": false,
  "ungraded_assessments": 5,
  "projected_letter_grade": "A",
  "letter_grade": null,
  "categories": [
    {
      "id": 1,
      "name": "Grader",
      "weight_percent": "55.00",
      "points_earned": "345.00",
      "points_possible": "400.00",
      "category_percentage": "86.25",
      "weighted_contribution": "47.4375",
      "graded_assessments": 3,
      "ungraded_assessments": 2
    },
    {
      "id": 2,
      "name": "Midterm",
      "weight_percent": "20.00",
      "points_earned": null,
      "points_possible": null,
      "category_percentage": null,
      "weighted_contribution": null,
      "graded_assessments": 0,
      "ungraded_assessments": 1
    }
  ]
}
```

(Remaining categories omitted for brevity.) Since only Grader is graded, `current_grade` equals Grader's percentage: 47.4375 / 55 × 100 = 86.25.

### Grade Scale

| Method | Endpoint | Description |
|---|---|---|
| GET | `/courses/{course_id}/grade-scale/` | Get grade boundaries |
| PUT | `/courses/{course_id}/grade-scale/` | Replace all grade boundaries |

Example PUT:

```json
{
  "bands": [
    {
      "grade_label": "A",
      "minimum_percentage": "80.00",
      "grade_point": "4.00"
    },
    {
      "grade_label": "B+",
      "minimum_percentage": "75.00",
      "grade_point": "3.50"
    },
    {
      "grade_label": "B",
      "minimum_percentage": "70.00",
      "grade_point": "3.00"
    },
    {
      "grade_label": "F",
      "minimum_percentage": "0.00",
      "grade_point": "0.00"
    }
  ]
}
```

Use a database transaction when replacing the scale. Reject the request if no band has `minimum_percentage` of `0.00`. Sending `{"bands": []}` clears the scale.

## 12.6 Calendar

| Method | Endpoint | Description |
|---|---|---|
| GET | `/calendar/agenda/` | Get unified calendar occurrences |
| GET | `/calendar/events/` | List calendar event records |
| POST | `/calendar/events/` | Create calendar event |
| GET | `/calendar/events/{id}/` | Get event |
| PATCH | `/calendar/events/{id}/` | Update event |
| DELETE | `/calendar/events/{id}/` | Delete event |

### Calendar agenda query

```text
GET /calendar/agenda/?start=2026-11-01&end=2026-11-30
```

Return class occurrences, calendar events, task deadlines, and unlinked assessment deadlines in the requested range. Limit the range to a maximum of 92 days; longer ranges return 400.

Example manual exam POST:

```json
{
  "course": 1,
  "title": "Calculus I Midterm",
  "event_type": "EXAM",
  "start_at": "2026-11-25T13:00:00+07:00",
  "end_at": "2026-11-25T15:00:00+07:00",
  "is_all_day": false,
  "timezone": "Asia/Bangkok",
  "location": "Engineering Building"
}
```

### ICS Imports

| Method | Endpoint | Description |
|---|---|---|
| GET | `/calendar/imports/` | List import history |
| POST | `/calendar/imports/` | Upload ICS file |
| GET | `/calendar/imports/{id}/` | Get import report |

Request:

```text
POST /api/v1/calendar/imports/
Content-Type: multipart/form-data

file: timetable.ics
```

Example response:

```json
{
  "id": 5,
  "status": "COMPLETED",
  "original_filename": "timetable.ics",
  "imported_count": 12,
  "updated_count": 0,
  "skipped_count": 1,
  "warnings": [
    "One event contained an unsupported recurrence exception."
  ]
}
```

The import process should use a transaction where possible. Invalid calendar files must not leave partially imported records.

## 12.7 Resource Hub

### Resource Categories

| Method | Endpoint | Description |
|---|---|---|
| GET | `/resource-categories/` | List categories |
| POST | `/resource-categories/` | Create category |
| PATCH | `/resource-categories/{id}/` | Update category |
| DELETE | `/resource-categories/{id}/` | Delete category |

### Resource Links

| Method | Endpoint | Description |
|---|---|---|
| GET | `/resources/` | List resources |
| POST | `/resources/` | Create resource |
| GET | `/resources/{id}/` | Get resource |
| PATCH | `/resources/{id}/` | Update resource |
| DELETE | `/resources/{id}/` | Delete resource |
| POST | `/resources/{id}/favorite/` | Toggle favorite |

Filters:

```text
GET /resources/?course=1
GET /resources/?course=global
GET /resources/?category=2
GET /resources/?favorite=true
GET /resources/?search=mycourseville
```

Example POST — Global resource:

```json
{
  "category": 1,
  "course": null,
  "title": "MyCourseVille",
  "url": "https://mycourseville.com/",
  "description": "University learning platform",
  "is_favorite": true
}
```

Example POST — Course-specific resource:

```json
{
  "category": 2,
  "course": 1,
  "title": "Course Programming Materials",
  "url": "https://example.com/",
  "description": "Reference materials for this course",
  "is_favorite": false
}
```

## 12.8 Tasks

| Method | Endpoint | Description |
|---|---|---|
| GET | `/tasks/` | List tasks |
| POST | `/tasks/` | Create task |
| GET | `/tasks/{id}/` | Get task |
| PATCH | `/tasks/{id}/` | Update task |
| DELETE | `/tasks/{id}/` | Delete task |
| POST | `/tasks/{id}/complete/` | Mark complete |
| POST | `/assessments/{id}/task/` | Create a task linked to this assessment |

Filters (all due-date filters use `effective_due_at`):

```text
GET /tasks/?course=1
GET /tasks/?status=TODO
GET /tasks/?due_before=2026-11-30T23:59:59+07:00
GET /tasks/?linked=true
```

Example POST — standalone task:

```json
{
  "course": 1,
  "title": "Read chapter 4",
  "task_type": "READING",
  "priority": "MEDIUM",
  "due_at": "2026-11-18T09:00:00+07:00"
}
```

Example POST — task linked to an assessment:

```json
{
  "assessment": 7,
  "title": "Problem Set 2",
  "task_type": "ASSIGNMENT",
  "priority": "HIGH",
  "estimated_minutes": 180
}
```

Example response (linked):

```json
{
  "id": 41,
  "course": 1,
  "assessment": 7,
  "title": "Problem Set 2",
  "task_type": "ASSIGNMENT",
  "priority": "HIGH",
  "status": "TODO",
  "due_at": null,
  "effective_due_at": "2026-11-20T23:59:00+07:00",
  "estimated_minutes": 180,
  "completed_at": null
}
```

`POST /assessments/{id}/task/` creates a linked task using the assessment's title, with `task_type` defaulting to `ASSIGNMENT`. It returns 409 if the assessment already has a linked task.

## 12.9 Habits

| Method | Endpoint | Description |
|---|---|---|
| GET | `/habits/` | List habits |
| POST | `/habits/` | Create habit |
| GET | `/habits/{id}/` | Get habit |
| PATCH | `/habits/{id}/` | Update habit |
| DELETE | `/habits/{id}/` | Delete habit |
| GET | `/habits/{id}/logs/` | List habit logs |
| POST | `/habits/{id}/logs/` | Create habit log |
| PATCH | `/habit-logs/{id}/` | Update log |
| DELETE | `/habit-logs/{id}/` | Delete log |

Example habit log:

```json
{
  "date": "2026-11-08",
  "status": "COMPLETED",
  "duration_minutes": 30,
  "note": "Reviewed lecture notes"
}
```

## 12.10 Study Sessions

| Method | Endpoint | Description |
|---|---|---|
| GET | `/study-sessions/` | List sessions |
| POST | `/study-sessions/start/` | Start session (409 if one is already active) |
| POST | `/study-sessions/{id}/stop/` | Stop session |
| PATCH | `/study-sessions/{id}/` | Update notes or associations |
| DELETE | `/study-sessions/{id}/` | Delete session |

Start request:

```json
{
  "course": 1,
  "task": null,
  "note": "Reviewing lecture 3"
}
```

The backend sets `started_at` automatically.

Stop request:

```text
POST /study-sessions/15/stop/
```

The backend records `ended_at` using the current server time.

## 12.11 Dashboard

### GET `/dashboard/summary/`

Returns the information required for the main Today screen.

Optional query:

```text
GET /dashboard/summary/?date=2026-11-08
```

Example response:

```json
{
  "date": "2026-11-08",
  "active_semester": {
    "id": 1,
    "name": "Semester 1 / 2026",
    "start_date": "2026-08-01",
    "end_date": "2026-12-15"
  },
  "courses": [
    { "id": 1, "code": "MATH101", "name": "Calculus I", "color": "#D8693A" }
  ],
  "today": {
    "classes": [],
    "events": [],
    "tasks": []
  },
  "upcoming_exams": [],
  "upcoming_deadlines": [],
  "habits": {
    "completed": 3,
    "total": 5,
    "items": [
      { "id": 1, "name": "Review lecture notes", "target_minutes": 30, "completed": true, "streak_days": 12 }
    ]
  },
  "study": {
    "today_minutes": 120,
    "week_minutes": 335,
    "week_by_day": [215, 120, 0, 0, 0, 0, 0],
    "weekly_target_minutes": 1200
  },
  "grade_standing": [
    {
      "course_id": 1,
      "current_grade": "84.921875",
      "graded_category_weight": "80.00",
      "weight_status": "valid",
      "projected_letter_grade": "A",
      "letter_grade": null,
      "is_final": false,
      "ungraded_assessments": 1
    }
  ]
}
```

- `courses` lists the active semester's courses so the frontend can show codes and colors.
- `week_by_day` is Monday-first (or follows `UserProfile.week_starts_on`).
- `weekly_target_minutes` comes from a new optional `UserProfile.weekly_study_target_minutes` (PositiveIntegerField, default 1200).
- `grade_standing` holds one compact grade summary per active course, calculated by `GradeCalculationService`.
- `today.events`, `upcoming_exams` and `upcoming_deadlines` items may include `event_type`, `status` and `priority` where the source has them.

`upcoming_deadlines` includes task deadlines and unlinked assessment deadlines, using the same occurrence format as the calendar agenda.

The frontend should use this endpoint to render the initial dashboard rather than making many unrelated API calls.

## 12.12 AI-Assisted Import

Lets the user paste a JSON file written by an AI chat from their timetable or syllabus. The format, the AI prompt and the user guide are in `docs/AI_IMPORT_GUIDE.md`; the frontend validates the file first for instant feedback, and the backend re-validates everything.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/imports/academic/` | Validate and import a `university-os/v1` file |

Request:

```json
{
  "config": { "format": "university-os/v1", "semester": { }, "courses": [ ] },
  "make_active": true,
  "dry_run": false
}
```

Rules:

- Implemented by `AcademicImportService` in `imports/services.py`.
- All records are created inside **one transaction**. Any validation error rolls the whole import back.
- `dry_run: true` validates and returns the summary without saving.
- If `config.semester` is present, a new semester is created; `make_active` decides whether it becomes the active semester. Otherwise courses go into the active semester (400 if there is none).
- A course whose code already exists in the target semester is skipped and reported in `skipped`, so re-importing a file never duplicates courses.
- Creates: Semester, Course, ClassMeeting, GradeCategory, Assessment, GradeScaleBand, CalendarEvent (exams and quizzes, `source=MANUAL`), ResourceLink. All owned by `request.user`.
- Applies the same model rules as the normal endpoints: weights ≤ 100, `points_earned` ≤ `points_possible`, null ≠ 0, grade scale includes a 0% band (otherwise the scale is skipped with a warning), ClassMeeting dates within the semester, http/https URLs only.
- Datetimes without an offset are interpreted in the user's profile timezone, with a warning.
- Request body limit: 1 MB.

Response `201` (or `200` for a dry run):

```json
{
  "semester": { "id": 3, "name": "Semester 2 / 2026", "is_active": true, "created": true },
  "courses_created": 4,
  "skipped": [{ "code": "MATH101", "reason": "already_exists" }],
  "counts": { "class_meetings": 7, "grade_categories": 12, "assessments": 31, "exams": 6, "resources": 3 },
  "warnings": [{ "path": "CP102.grade_categories", "message": "Weights add up to 90%." }]
}
```

Validation errors return `400` in the standard error structure, with `fields` keyed by path, for example `"courses[1].class_meetings[0].end_time": ["must be later than start_time."]`.

---

# 13. API Response and Error Conventions

## 13.1 Standard Success Responses

Use normal REST response codes:

| Status | Meaning |
|---|---|
| 200 | Successful retrieval or update |
| 201 | Successfully created |
| 204 | Successfully deleted |
| 400 | Validation failure |
| 401 | Not authenticated |
| 403 | Permission denied |
| 404 | Resource not found |
| 409 | Resource conflict, where appropriate |
| 413 | Upload too large |
| 500 | Unexpected server error |

For objects owned by another user, return 404 rather than 403 so the API does not reveal that the object exists.

## 13.2 Standard Error Structure

Use a consistent error response:

```json
{
  "detail": "Validation failed.",
  "code": "validation_error",
  "fields": {
    "points_earned": [
      "Earned points cannot exceed maximum points."
    ]
  }
}
```

For errors without field-level validation, return an empty `fields` object.

## 13.3 Pagination

Use pagination for list endpoints that may grow.

Recommended default:

```json
{
  "count": 100,
  "next": "?page=2",
  "previous": null,
  "results": []
}
```

Start with 20 records per page and allow a configurable `page_size` up to 100.

Small nested lists that are always shown together (grade categories, assessments in a category, class meetings, grade scale bands) are returned unpaginated.

## 13.4 Filtering and Ordering

Support common filters:

- `search`
- `ordering`
- `page`
- `page_size`

Only expose filters relevant to each endpoint.

---

# 14. Security and Data Ownership

Although the app initially supports only one personal account, all data access must go through authenticated ownership checks.

Requirements:

1. Use Django SessionAuthentication and CSRF protection.
2. Disable public registration.
3. Do not expose the Django admin publicly without additional protection.
4. Filter every user-owned queryset using `request.user`.
5. Validate ownership of related objects before assigning foreign keys (including `Task.assessment`).
6. Never trust a `user_id` sent by the frontend.
7. Validate uploaded ICS files and impose a file size limit, initially 5 MB.
8. Do not expose database ports publicly.
9. Use environment variables for secrets.
10. Use HTTPS for remote access.
11. Implement regular PostgreSQL backups.
12. Rate-limit the login endpoint.

For React, serve the frontend and API through the same site origin when possible:

```text
https://university.example.com/
https://university.example.com/api/v1/
```

This simplifies session authentication and CSRF handling.

---

# 15. Backend Business Logic Requirements

The following operations must be implemented in dedicated services.

| Service | Location | Responsibility |
|---|---|---|
| `GradeCalculationService` | `gradebook/services.py` | Calculate category and course grades, final/projected letters |
| `CalendarService` | `scheduling/services.py` | Generate unified calendar occurrences |
| `ICSImportService` | `scheduling/services.py` | Parse and import ICS files |
| `DashboardService` | `dashboard/services.py` | Aggregate dashboard information |
| `HabitStatisticsService` | `habits/services.py` | Calculate habit consistency |
| `StudyStatisticsService` | `study_sessions/services.py` | Calculate study durations and summaries |
| `AcademicImportService` | `imports/services.py` | Validate and import AI-generated `university-os/v1` files |

Avoid recalculating and saving course grades in separate database columns every time an assessment changes.

For the initial application, calculate grade summaries dynamically from the gradebook records. This keeps results consistent and avoids stale cached grades.

---

# 16. API Documentation

Use `drf-spectacular` to generate OpenAPI documentation.

Required documentation endpoints:

| Endpoint | Purpose |
|---|---|
| `/api/schema/` | OpenAPI JSON |
| `/api/docs/` | Swagger UI |
| `/api/redoc/` | ReDoc documentation |

Every endpoint should document:

- HTTP method.
- URL parameters.
- Query parameters.
- Request body.
- Response body.
- Authentication requirements.
- Possible error responses.

The OpenAPI specification should serve as the contract between the backend and the React frontend. Generate TypeScript types for the frontend from it (e.g. with `openapi-typescript`).

---

# 17. Implementation Roadmap

Build the backend in the following order.

## Phase 1 — Foundation

- Django project setup.
- PostgreSQL connection.
- Authentication.
- UserProfile.
- Standard API responses.
- OpenAPI documentation.
- Docker configuration.

**Deliverable:** A working authenticated Django API deployed on ZimaOS.

## Phase 2 — Academic Management

- Semester model and API (including archive/unarchive).
- Course model and API.
- ClassMeeting model and API (with effective-date fallback).

**Deliverable:** Users can create semesters, organize courses, and define recurring classes.

## Phase 3 — Gradebook

- GradeCategory model.
- Assessment model.
- GradeScaleBand model.
- Validation services.
- Grade calculation service (final vs. projected).
- Grade summary endpoint.

**Deliverable:** Users can configure completely different grading structures for individual courses and automatically calculate scores.

## Phase 4 — Calendar

- CalendarEvent model.
- CalendarImport model.
- Class occurrence generation.
- Calendar aggregation (including assessment deadlines).
- ICS parsing and import.
- Duplicate detection.

**Deliverable:** All academic events can appear in one unified calendar.

## Phase 5 — Resource Hub and Tasks

- ResourceCategory and ResourceLink.
- Task model and API, including the assessment link.
- Dashboard integration.
- AI-assisted academic import endpoint.

**Deliverable:** University resources and assignments are organized in one place.

## Phase 6 — Productivity

- Habit and HabitLog.
- StudySession.
- Statistics services.

**Deliverable:** Users can track university habits and study time.

## Phase 7 — Final Integration

- Complete dashboard API.
- Security review.
- Database backup strategy.
- API tests.
- Deployment testing.

**Deliverable:** A usable first version of University OS.

---

# 18. Testing Requirements

Do not consider an API feature finished merely because it successfully returns a response.

At minimum, test the following.

### Academics
- Only one active semester per user.
- Archiving the active semester deactivates it.
- Activating an archived semester is rejected.
- Deleting a semester with courses returns 409.
- ClassMeeting effective dates fall back to the semester.
- ClassMeeting dates outside the semester are rejected.
- Changing semester dates moves occurrences of meetings without explicit dates.

### Gradebook
- Different course grading structures.
- Multiple assessments in a category.
- Null and zero scores.
- Points greater than maximum.
- Category weights below and above 100%.
- Categories with no assessments.
- Grade boundary calculations, including exact boundary values (e.g. 80.00 → A, 79.99 → B+).
- `letter_grade` is null and `projected_letter_grade` is set while grading is incomplete.
- `letter_grade` is set once every assessment is graded and weights total 100%.
- Grade scale without a 0% band is rejected.
- Updating and deleting assessments.
- Correct decimal arithmetic (verify the 84.921875 example exactly).

### Calendar
- Weekly recurring class generation.
- Semester boundaries.
- Timezone handling.
- Overlapping events.
- Valid and invalid ICS files.
- Duplicate ICS imports.
- Recurring imported events.
- All-day events.
- Calendar date-range filtering and the maximum range limit.
- Unlinked assessment deadlines appear; linked ones appear only once, as task deadlines.

### Tasks
- Linking a task to an assessment sets its course and effective due date.
- Setting `due_at` on a linked task is rejected.
- Linking a second task to the same assessment is rejected.
- Linking to another user's assessment is rejected.
- Deleting an assessment leaves its task unlinked.

### Imports
- A valid file creates every record in one transaction.
- Any invalid field rolls back the whole import.
- `dry_run` saves nothing.
- Re-importing the same file skips existing course codes.
- Weights over 100 and `points_earned` over `points_possible` are rejected.
- A grade scale without a 0% band is skipped with a warning.
- Datetimes without an offset use the profile timezone.
- Imported records belong to the requesting user only.

### Resources
- Global links.
- Course-specific links.
- Invalid URLs.
- Search and filtering.
- User ownership.

### Security
- Unauthenticated requests.
- Invalid CSRF requests.
- Cross-user object access returns 404.
- Invalid foreign-key ownership.
- Unauthorized modifications.

---

# 19. Definition of Done

The initial backend is considered complete when:

- Authentication works.
- A semester can be created, activated, and archived.
- Courses can be created under semesters.
- Each course can have its own grading configuration.
- Assessments can be added and scored.
- The backend returns mathematically correct grade summaries, distinguishing final from projected grades.
- Grade boundaries can be customized.
- Recurring classes appear automatically in the calendar.
- Exams and other events can be created manually.
- ICS files can be imported without duplicate events.
- Global and course-specific resources work.
- Tasks and assessment deadlines appear in the calendar, each exactly once.
- Every API enforces ownership.
- API documentation is available.
- The application runs reliably through Docker Compose on ZimaOS.

**Final architectural principle:** Keep University OS as a modular Django monolith for version 1. There is no need to introduce microservices, separate databases, or complicated distributed infrastructure for a personal university management application. A single Django backend and PostgreSQL database are more than sufficient for the initial requirements.
