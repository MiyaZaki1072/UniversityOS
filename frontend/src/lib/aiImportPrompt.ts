/**
 * The prompt the user copies into any AI chat (ChatGPT, Claude, Gemini…), together with
 * their timetable / syllabus / screenshots. The AI answers with a JSON file in
 * University OS import format v1, which the Import dialog reads.
 * Keep in sync with docs/AI_IMPORT_GUIDE.md.
 */

export const EXAMPLE_CONFIG = {
  format: 'university-os/v1',
  semester: {
    name: 'Semester 2 / 2026',
    academic_year: '2026/2027',
    term: 'Semester 2',
    start_date: '2027-01-06',
    end_date: '2027-05-10',
  },
  courses: [
    {
      code: 'CP102',
      name: 'Data Structures',
      credits: 3,
      instructor: 'Dr. Somchai P.',
      class_meetings: [
        { weekday: 'MON', start_time: '09:00', end_time: '12:00', location: 'Engineering Bldg 3 Rm 301' },
        { weekday: 'THU', start_time: '13:00', end_time: '15:00', location: 'Computer Lab 2' },
      ],
      grade_categories: [
        {
          name: 'Grader',
          weight_percent: 40,
          assessments: [
            { title: 'Grader 1', points_possible: 100, points_earned: null, due_at: '2027-01-20T23:59:00+07:00' },
            { title: 'Grader 2', points_possible: 100, points_earned: null },
          ],
        },
        { name: 'Midterm', weight_percent: 30, assessments: [{ title: 'Midterm Exam', points_possible: 100, points_earned: null }] },
        { name: 'Final', weight_percent: 30, assessments: [{ title: 'Final Exam', points_possible: 100, points_earned: null }] },
      ],
      grade_scale: [
        { grade_label: 'A', minimum_percentage: 80, grade_point: 4 },
        { grade_label: 'B+', minimum_percentage: 75, grade_point: 3.5 },
        { grade_label: 'B', minimum_percentage: 70, grade_point: 3 },
        { grade_label: 'C+', minimum_percentage: 65, grade_point: 2.5 },
        { grade_label: 'C', minimum_percentage: 60, grade_point: 2 },
        { grade_label: 'D+', minimum_percentage: 55, grade_point: 1.5 },
        { grade_label: 'D', minimum_percentage: 50, grade_point: 1 },
        { grade_label: 'F', minimum_percentage: 0, grade_point: 0 },
      ],
      exams: [
        { title: 'Data Structures Midterm', type: 'EXAM', start_at: '2027-03-02T13:00:00+07:00', end_at: '2027-03-02T16:00:00+07:00', location: 'Main Exam Hall' },
      ],
      resources: [{ title: 'Course page', url: 'https://example.com/cp102', description: 'Slides and lab sheets' }],
    },
  ],
  notes: ['The syllabus does not say where the final exam is held.'],
}

export const AI_IMPORT_PROMPT = `You are helping me fill in my university planner app, "University OS".
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
9. Only add "grade_scale" if the syllabus gives letter-grade cut-offs. It must include a band starting at 0 (usually F). If a course is graded pass/fail (S/U, satisfactory/unsatisfactory), set "grading": "S/U" instead and, if the syllabus gives it, "su_pass_percentage" (the minimum % for S); leave out "grade_scale" for that course.
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
      "grading": "letter",                   // optional: "letter" (default) or "S/U" for pass/fail courses
      "su_pass_percentage": 50,              // optional, S/U courses only: minimum % for S
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
`
