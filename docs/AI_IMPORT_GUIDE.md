# Import courses with AI

Too lazy to type in a whole semester? Let an AI do it. You give any AI chat (ChatGPT, Claude, Gemini…) the prompt below plus your timetable or syllabus. It replies with a JSON file. You paste that into **Import with AI** in University OS, review it, and import.

Nothing is saved until you press **Import**, and every field is checked first.

---

## 1. How to use it

1. In University OS, click **Import with AI** (on the briefing, or the **Import** icon in the header).
2. Click **Copy prompt**.
3. Open an AI chat and paste the prompt. Under the line *"Here is my information:"* attach or paste what you have:
   - a screenshot of your registration timetable,
   - the course syllabus or outline (PDF or text),
   - the grading breakdown ("Homework 20%, Midterm 30%…"),
   - your scores so far, if you want them in the gradebook,
   - exam dates.
4. Copy the AI's whole reply. Extra words or ```json fences around it are fine; University OS strips them.
5. Back in University OS, click **I have the JSON**, paste it (or upload a `.json` file) and check the preview.
   - **Red** problems must be fixed first. Usually you can just tell the AI *"Fix this: …"* and paste the new reply.
   - **Yellow** notes are fine to import. Read them anyway.
   - **Questions from the AI** list things it wasn't sure about.
6. Press **Import**.

### Tips

- **Whole semester at once:** send the timetable screenshot and every course's grading breakdown in one message.
- **One course at a time works too.** Courses whose code already exists in your current semester are skipped, so re-importing the same file never makes duplicates.
- **New semester:** tell the AI the semester name and its start and end dates. The preview then offers *"Make it my current semester"*.
- **Scores:** `null` means not graded yet and `0` means you actually got zero. The prompt tells the AI this, but check it in the preview.
- **Check the times.** AIs occasionally misread a screenshot. The preview lists every class time so you can spot mistakes before importing.

---

## 2. The prompt (copy this into the AI)

The app's **Copy prompt** button copies exactly this text.

```text
You are helping me fill in my university planner app, "University OS".
I will give you my timetable, syllabus, course outline, screenshots or notes. Read them and reply with ONE JSON object in the format below, so I can import it.

RULES
1. Reply with the JSON only. No explanation before or after it.
2. Use only information that is actually in what I gave you. Never invent courses, times, rooms, weights, scores or dates. If an optional field is unknown, leave it out.
3. "weekday" is one of: MON, TUE, WED, THU, FRI, SAT, SUN. If a course meets on several days, add one class_meetings entry per day.
4. Times are 24-hour "HH:MM". Dates are "YYYY-MM-DD". Exam and deadline date-times are "YYYY-MM-DDTHH:MM:00+07:00" (Thailand time) unless I say otherwise.
5. grade_categories are the parts of the final grade (e.g. Homework 20%, Midterm 30%, Final 50%). weight_percent is that part's share of the final grade; together they should add up to 100.
6. If a category has several graded items (e.g. 5 homework sets), list each one under "assessments" with its maximum points. If the syllabus doesn't split it, add one assessment with points_possible 100.
7. points_earned is my score. Use null for anything not graded yet. Use 0 only if I actually scored 0.
8. Put exams and quizzes that have a date and time in "exams" (type "EXAM" or "QUIZ"). Put assignment deadlines in the matching assessment's "due_at".
9. Only add "grade_scale" if the syllabus gives letter-grade cut-offs. It must include a band starting at 0 (usually F).
10. Only add "semester" if I tell you the semester's name and its start and end dates. Without it, the courses go into my current semester.
11. If something is unclear or missing, still give the JSON, and list your questions in "notes".

FORMAT (fields marked optional can be left out)
{
  "format": "university-os/v1",
  "semester": {                              // optional
    "name": "Semester 2 / 2026",
    "academic_year": "2026/2027",            // optional
    "term": "Semester 2",                    // optional
    "start_date": "2027-01-06",
    "end_date": "2027-05-10"
  },
  "courses": [
    {
      "code": "CP102",
      "name": "Data Structures",
      "credits": 3,                          // optional
      "instructor": "Dr. Somchai P.",        // optional
      "class_meetings": [
        { "weekday": "MON", "start_time": "09:00", "end_time": "12:00", "location": "Eng 3 Rm 301" }
      ],
      "grade_categories": [
        {
          "name": "Grader",
          "weight_percent": 40,
          "assessments": [
            { "title": "Grader 1", "points_possible": 100, "points_earned": null, "due_at": "2027-01-20T23:59:00+07:00" }
          ]
        }
      ],
      "grade_scale": [                       // optional
        { "grade_label": "A", "minimum_percentage": 80, "grade_point": 4 },
        { "grade_label": "F", "minimum_percentage": 0, "grade_point": 0 }
      ],
      "exams": [                             // optional
        { "title": "Midterm", "type": "EXAM", "start_at": "2027-03-02T13:00:00+07:00", "end_at": "2027-03-02T16:00:00+07:00", "location": "Main Exam Hall" }
      ],
      "resources": [                         // optional
        { "title": "Course page", "url": "https://...", "description": "Slides" }
      ]
    }
  ],
  "notes": ["Questions or anything you were unsure about"]   // optional
}

(The // comments above are only for you. Don't put comments in your reply.)

Here is my information:
```

---

## 3. Format reference — `university-os/v1`

| Field | Required | Notes |
|---|---|---|
| `format` | recommended | `"university-os/v1"` |
| `semester` | no | Leave out to add courses to the current semester. |
| `semester.name`, `start_date`, `end_date` | yes, if `semester` given | Dates `YYYY-MM-DD`; end ≥ start. |
| `semester.academic_year`, `term` | no | |
| `courses[]` | yes | At least one. |
| `courses[].code` | yes | Up to 30 chars, stored uppercase, unique in the file. |
| `courses[].name` | yes | Up to 150 chars. |
| `courses[].credits` | no | Number ≥ 0. |
| `courses[].instructor` | no | |
| `courses[].color` | no | `#RRGGBB`; otherwise a palette color is assigned. |
| `class_meetings[].weekday` | yes | `MON`…`SUN` (full names and 0–6 also accepted). |
| `class_meetings[].start_time`, `end_time` | yes | 24-hour `HH:MM`; end after start. |
| `class_meetings[].location` | no | |
| `class_meetings[].starts_on`, `ends_on` | no | Only if the class doesn't run the whole semester. |
| `grade_categories[].name` | yes | |
| `grade_categories[].weight_percent` | yes | 0–100. All categories together may not exceed 100. Under 100 imports with a warning. |
| `assessments[].title` | yes | |
| `assessments[].points_possible` | yes | > 0 |
| `assessments[].points_earned` | no | `null` = ungraded. Can't exceed `points_possible`. |
| `assessments[].due_at` | no | `YYYY-MM-DDTHH:MM:00+07:00`. A missing timezone is treated as Bangkok time; a date alone means 23:59. |
| `grade_scale[]` | no | `grade_label`, `minimum_percentage`, `grade_point`. Must include a band at 0, or the scale is skipped. |
| `exams[]` | no | `title`, `type` (`EXAM`/`QUIZ`), `start_at`, `end_at`, `location`. |
| `resources[]` | no | `title`, `url` (http/https only), `description`. |
| `notes[]` | no | The AI's questions; shown in the preview, not saved. |

Numbers may be written as numbers or strings (`40`, `"40"`, `"40%"`).

### Full example

```json
{
  "format": "university-os/v1",
  "semester": {
    "name": "Semester 2 / 2026",
    "academic_year": "2026/2027",
    "term": "Semester 2",
    "start_date": "2027-01-06",
    "end_date": "2027-05-10"
  },
  "courses": [
    {
      "code": "CP102",
      "name": "Data Structures",
      "credits": 3,
      "instructor": "Dr. Somchai P.",
      "class_meetings": [
        {
          "weekday": "MON",
          "start_time": "09:00",
          "end_time": "12:00",
          "location": "Engineering Bldg 3 Rm 301"
        },
        {
          "weekday": "THU",
          "start_time": "13:00",
          "end_time": "15:00",
          "location": "Computer Lab 2"
        }
      ],
      "grade_categories": [
        {
          "name": "Grader",
          "weight_percent": 40,
          "assessments": [
            {
              "title": "Grader 1",
              "points_possible": 100,
              "points_earned": null,
              "due_at": "2027-01-20T23:59:00+07:00"
            },
            {
              "title": "Grader 2",
              "points_possible": 100,
              "points_earned": null
            }
          ]
        },
        {
          "name": "Midterm",
          "weight_percent": 30,
          "assessments": [
            {
              "title": "Midterm Exam",
              "points_possible": 100,
              "points_earned": null
            }
          ]
        },
        {
          "name": "Final",
          "weight_percent": 30,
          "assessments": [
            {
              "title": "Final Exam",
              "points_possible": 100,
              "points_earned": null
            }
          ]
        }
      ],
      "grade_scale": [
        {
          "grade_label": "A",
          "minimum_percentage": 80,
          "grade_point": 4
        },
        {
          "grade_label": "B+",
          "minimum_percentage": 75,
          "grade_point": 3.5
        },
        {
          "grade_label": "B",
          "minimum_percentage": 70,
          "grade_point": 3
        },
        {
          "grade_label": "C+",
          "minimum_percentage": 65,
          "grade_point": 2.5
        },
        {
          "grade_label": "C",
          "minimum_percentage": 60,
          "grade_point": 2
        },
        {
          "grade_label": "D+",
          "minimum_percentage": 55,
          "grade_point": 1.5
        },
        {
          "grade_label": "D",
          "minimum_percentage": 50,
          "grade_point": 1
        },
        {
          "grade_label": "F",
          "minimum_percentage": 0,
          "grade_point": 0
        }
      ],
      "exams": [
        {
          "title": "Data Structures Midterm",
          "type": "EXAM",
          "start_at": "2027-03-02T13:00:00+07:00",
          "end_at": "2027-03-02T16:00:00+07:00",
          "location": "Main Exam Hall"
        }
      ],
      "resources": [
        {
          "title": "Course page",
          "url": "https://example.com/cp102",
          "description": "Slides and lab sheets"
        }
      ]
    }
  ],
  "notes": [
    "The syllabus does not say where the final exam is held."
  ]
}
```

---

## 4. Backend endpoint (for the Django side)

```text
POST /api/v1/imports/academic/
Content-Type: application/json

{ "config": { …the AI's JSON… }, "make_active": true, "dry_run": false }
```

- Re-run the same validation server-side (`apps/imports/services.py` → `AcademicImportService`). Never trust the browser's check.
- `dry_run: true` validates and returns the summary without saving.
- Everything is created in **one transaction**: semester (if given), courses, class meetings, grade categories, assessments, grade scale bands, exam `CalendarEvent`s (`source=MANUAL`, `event_type` EXAM/QUIZ), resource links. Any error rolls the whole import back.
- Courses whose code already exists in the target semester are skipped and listed in `skipped`.
- `make_active` only applies when the file creates a semester.
- Ownership: everything is created for `request.user`.

Response `201`:

```json
{
  "semester": { "id": 3, "name": "Semester 2 / 2026", "is_active": true, "created": true },
  "courses_created": 4,
  "skipped": [{ "code": "MATH101", "reason": "already_exists" }],
  "counts": { "class_meetings": 7, "grade_categories": 12, "assessments": 31, "exams": 6, "resources": 3 },
  "warnings": [{ "path": "CP102.grade_categories", "message": "Weights add up to 90%." }]
}
```

Response `400` uses the standard error shape, with `fields` keyed by path, e.g. `"courses[1].class_meetings[0].end_time": ["must be later than start_time."]`.
