## Ticket

T-xx · <title>

## What changed

-

## How I tested it

<!-- Paste the real commands and the result lines, e.g. "pytest -q → 42 passed". -->

```text
pytest -q →
ruff check . →
python manage.py makemigrations --check --dry-run →
npx tsc -b →
npm run build →
```

## Acceptance criteria

<!-- List the ticket's acceptance criteria and tick what's done; name the test that covers each. -->

- [ ]

## Spec questions

<!-- Anything unclear in docs/university-os-spec.md and the reading you chose. "None" is fine. -->

## Not done / out of scope

## Checklist

- [ ] One ticket only, no unrelated changes
- [ ] Tests added for every acceptance criterion (incl. other user's object → 404 for endpoints)
- [ ] No secrets; `.env.example` updated if a variable was added
- [ ] Frontend: design tokens only, loading/empty/error states, works at 390px
