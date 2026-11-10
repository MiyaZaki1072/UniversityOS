import { AlertTriangle, ArrowLeft, ArrowRight, Check, ClipboardCopy, FileUp, Sparkles } from 'lucide-react'
import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { AI_IMPORT_PROMPT, EXAMPLE_CONFIG } from '../../lib/aiImportPrompt'
import { extractJson, parseImport, type ImportPlan, type Issue, type PlanCourse } from '../../lib/importConfig'
import { useAppData, type ImportOutcome } from '../../lib/store'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Overlay'
import { StatusStamp } from '../ui/StatusStamp'

type Step = 'ask' | 'paste' | 'done'

const DAY = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const hhmm = (t: string) => t.slice(0, 5)

/* ------------------------------------------------------------------ */

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (key: string, text: string, fallbackEl?: HTMLElement | null) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      window.setTimeout(() => setCopied(null), 1800)
    } catch {
      // Clipboard refused: select the text so the user can press Ctrl/Cmd+C.
      if (fallbackEl) {
        const range = document.createRange()
        range.selectNodeContents(fallbackEl)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
      setCopied(`${key}-manual`)
    }
  }
  return { copied, copy }
}

function StepTabs({ step, canPaste }: { step: Step; canPaste: boolean }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'ask', label: 'Ask an AI' },
    { id: 'paste', label: 'Paste & check' },
    { id: 'done', label: 'Filed' },
  ]
  const idx = steps.findIndex((s) => s.id === step)
  return (
    <ol className="grid grid-cols-3 border border-border rounded-xs overflow-hidden mb-5" aria-label="Import steps">
      {steps.map((s, i) => (
        <li
          key={s.id}
          aria-current={s.id === step ? 'step' : undefined}
          className={
            'flex items-center gap-2 px-3 h-10 text-[13px] border-r last:border-r-0 border-border ' +
            (s.id === step ? 'bg-surface-2 text-ink' : i < idx || (s.id === 'paste' && canPaste) ? 'text-ink-muted' : 'text-ink-faint')
          }
        >
          <span className={`tabular text-[11px] font-semibold ${s.id === step ? 'text-accent-strong' : ''}`}>
            {String(i + 1).padStart(2, '0')}
          </span>
          <span className="truncate">{s.label}</span>
        </li>
      ))}
    </ol>
  )
}

function IssueList({ issues, tone }: { issues: Issue[]; tone: 'error' | 'warn' }) {
  const color = tone === 'error' ? 'border-danger bg-danger-wash' : 'border-mustard/60 bg-mustard-wash'
  const head = tone === 'error' ? 'text-danger' : 'text-mustard-ink'
  return (
    <div role={tone === 'error' ? 'alert' : undefined} className={`border-[1.5px] rounded-xs ${color}`}>
      <div className={`flex items-center gap-2 px-3 h-9 micro ${head}`}>
        <AlertTriangle size={14} />
        {tone === 'error'
          ? `${issues.length} ${issues.length === 1 ? 'problem' : 'problems'} to fix before importing`
          : `${issues.length} ${issues.length === 1 ? 'note' : 'notes'} — import still works`}
      </div>
      <ul className="px-3 pb-2.5 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
        {issues.map((x, i) => (
          <li key={i} className="text-[13px] leading-snug text-ink">
            <span className="tabular text-[12px] text-ink-muted mr-1.5">{x.path}</span>
            {x.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

function CoursePreview({ c }: { c: PlanCourse }) {
  const assessments = c.categories.reduce((s, g) => s + g.assessments.length, 0)
  return (
    <li className="flex gap-3 px-4 py-3">
      <span className="w-[3px] self-stretch rounded-[1px] shrink-0" style={{ background: c.color }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="tabular text-[12px] text-ink-muted">{c.code}</span>
          <span className="font-medium text-ink">{c.name}</span>
          {Number(c.credits) > 0 && <span className="tabular text-[12px] text-ink-faint">{c.credits} cr</span>}
        </div>
        <div className="mt-1 tabular text-[12px] text-ink-muted">
          {c.meetings.length
            ? c.meetings.map((m) => `${DAY[m.weekday]} ${hhmm(m.start_time)}–${hhmm(m.end_time)}`).join(' · ')
            : 'No class times'}
        </div>
        {c.categories.length > 0 && (
          <div className="mt-1 text-[12.5px] text-ink-muted">
            {c.categories.map((g) => `${g.name} ${Number(g.weight_percent)}%`).join(' · ')}
          </div>
        )}
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        {c.categories.length === 0 ? (
          <StatusStamp status="UNGRADED" />
        ) : c.weight_total === 100 ? (
          <span className="tabular text-[12px] text-sage-ink">100% ✓</span>
        ) : (
          <span className="tabular text-[12px] text-mustard-ink">{c.weight_total}%</span>
        )}
        <span className="tabular text-[11px] text-ink-faint">
          {assessments} items · {c.exams.length} exams
        </span>
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ */

/** Import courses from a JSON file written by any AI chat. */
export function ImportDialog() {
  const { importOpen, closeImport, applyImport, data } = useAppData()
  const [step, setStep] = useState<Step>('ask')
  const [text, setText] = useState('')
  const [makeActive, setMakeActive] = useState(true)
  const [filing, setFiling] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<{ result: ImportOutcome; plan: ImportPlan } | null>(null)
  const promptRef = useRef<HTMLPreElement>(null)
  const { copied, copy } = useCopy()

  const existingCodes = useMemo(() => (data?.courses ?? []).map((c) => c.code), [data])
  const result = useMemo(() => (text.trim() ? parseImport(text, existingCodes) : null), [text, existingCodes])
  const plan = result?.plan ?? null

  const reset = () => {
    setStep('ask')
    setText('')
    setOutcome(null)
    setSubmitError(null)
    setMakeActive(true)
  }
  const close = () => {
    closeImport()
    window.setTimeout(reset, 200)
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setText(await file.text())
    e.target.value = ''
  }

  const file = async () => {
    if (!plan) return
    setFiling(true)
    setSubmitError(null)
    try {
      const raw = JSON.parse(extractJson(text))
      const r = await applyImport(plan, { makeActive, raw })
      setOutcome({ result: r, plan })
      setStep('done')
    } catch (e) {
      setSubmitError((e as Error).message)
    } finally {
      setFiling(false)
    }
  }

  const footer =
    step === 'ask' ? (
      <>
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => setStep('paste')} icon={<ArrowRight size={16} />}>
          I have the JSON
        </Button>
      </>
    ) : step === 'paste' ? (
      <>
        <Button variant="ghost" onClick={() => setStep('ask')} icon={<ArrowLeft size={16} />}>
          Back
        </Button>
        <Button variant="primary" disabled={!plan || filing} onClick={file} icon={<Check size={16} />}>
          {filing ? 'Filing…' : plan ? `Import ${plan.counts.courses} ${plan.counts.courses === 1 ? 'course' : 'courses'}` : 'Import'}
        </Button>
      </>
    ) : (
      <>
        <Button variant="secondary" onClick={reset}>
          Import another
        </Button>
        <Button variant="primary" onClick={close}>
          Done
        </Button>
      </>
    )

  return (
    <Modal open={importOpen} onClose={close} label="FORM I-7" title="Import with AI" size="lg" footer={footer}>
      <StepTabs step={step} canPaste={text.length > 0} />

      {step === 'ask' && (
        <div className="flex flex-col gap-5">
          <ol className="grid sm:grid-cols-3 gap-3">
            {[
              ['Copy the prompt', 'It tells the AI exactly what format University OS reads.'],
              ['Give it to any AI', 'Paste it into ChatGPT, Claude or Gemini, then attach your timetable screenshot, syllabus PDF or notes.'],
              ['Bring back the JSON', 'Copy the AI’s reply and paste it in the next step. You review everything before it’s saved.'],
            ].map(([t, b], i) => (
              <li key={t} className="border border-border rounded-xs p-3.5 bg-surface-sunken">
                <div className="tabular text-[11px] font-semibold text-accent-strong">STEP {i + 1}</div>
                <div className="mt-1 font-display font-medium text-ink">{t}</div>
                <p className="mt-1 text-[13px] text-ink-muted leading-snug">{b}</p>
              </li>
            ))}
          </ol>

          <div className="border border-border-strong rounded-xs overflow-hidden">
            <div className="flex items-center gap-2 px-3 h-10 border-b border-border bg-surface-2">
              <Sparkles size={15} className="text-mustard" aria-hidden="true" />
              <span className="micro !text-ink">AI prompt · format v1</span>
              <Button
                size="sm"
                variant="primary"
                className="ml-auto"
                icon={<ClipboardCopy size={14} />}
                onClick={() => copy('prompt', AI_IMPORT_PROMPT, promptRef.current)}
              >
                {copied === 'prompt' ? 'Copied' : 'Copy prompt'}
              </Button>
            </div>
            <pre
              ref={promptRef}
              className="max-h-64 overflow-auto p-3.5 font-mono text-[12px] leading-relaxed text-ink-muted whitespace-pre-wrap"
            >
              {AI_IMPORT_PROMPT}
            </pre>
          </div>
          {copied === 'prompt-manual' && (
            <p className="text-[13px] text-mustard-ink">Your browser blocked copying. The prompt is selected — press Ctrl+C (⌘C on Mac).</p>
          )}
          <p className="text-[13px] text-ink-muted">
            Tip: for a whole semester, send the AI your registration timetable and each course&rsquo;s grading
            breakdown in one message. You can also import one course at a time.
          </p>
        </div>
      )}

      {step === 'paste' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="import-json" className="micro !text-ink mr-auto">
                AI reply (JSON)
              </label>
              <label className="inline-flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium border border-border-strong rounded-sm cursor-pointer hover:bg-surface-2 focus-within:outline-2 focus-within:outline-accent">
                <FileUp size={14} />
                Upload .json
                <input id="import-file" type="file" accept=".json,application/json,.txt" className="sr-only" onChange={onFile} />
              </label>
              <Button size="sm" variant="ghost" onClick={() => setText(JSON.stringify(EXAMPLE_CONFIG, null, 2))}>
                Load example
              </Button>
            </div>
            <textarea
              id="import-json"
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              rows={10}
              placeholder={'Paste the whole reply here. Extra text or ```json fences around it are fine.\n\n{\n  "format": "university-os/v1",\n  "courses": [ … ]\n}'}
              className="w-full min-h-[180px] p-3 bg-surface-sunken border border-border-strong rounded-xs font-mono text-[12.5px] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent focus:shadow-[0_0_0_1px_var(--color-accent)]"
            />
          </div>

          {result && result.errors.length > 0 && <IssueList issues={result.errors} tone="error" />}

          {plan && (
            <>
              <div className="border border-border rounded-xs">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 border-b border-border bg-surface-2">
                  <span className="micro !text-ink">Will file into</span>
                  {plan.semester ? (
                    <>
                      <span className="font-medium text-ink">{plan.semester.name}</span>
                      <span className="tabular text-[12px] text-ink-muted">
                        {plan.semester.start_date} → {plan.semester.end_date} · new semester
                      </span>
                      <label className="w-full flex items-center gap-2 text-[13px] text-ink cursor-pointer">
                        <input
                          id="import-make-active"
                          type="checkbox"
                          checked={makeActive}
                          onChange={(e) => setMakeActive(e.target.checked)}
                          className="accent-[var(--color-accent)] w-4 h-4"
                        />
                        Make it my current semester
                      </label>
                    </>
                  ) : (
                    <span className="font-medium text-ink">{data?.active_semester?.name ?? 'Current semester'}</span>
                  )}
                </div>
                <ul className="divide-y divide-rule max-h-72 overflow-y-auto">
                  {plan.courses.map((c) => (
                    <CoursePreview key={c.code} c={c} />
                  ))}
                </ul>
                <div className="flex flex-wrap gap-x-5 gap-y-1 px-4 py-2.5 border-t border-border tabular text-[12px] text-ink-muted">
                  <span>{plan.counts.courses} courses</span>
                  <span>{plan.counts.meetings} weekly classes</span>
                  <span>{plan.counts.assessments} graded items</span>
                  <span>{plan.counts.exams} exams/quizzes</span>
                  <span>{plan.counts.resources} links</span>
                </div>
              </div>

              {plan.notes.length > 0 && (
                <div className="border border-border rounded-xs p-3">
                  <div className="micro mb-1.5">Questions from the AI</div>
                  <ul className="list-disc pl-5 text-[13px] text-ink flex flex-col gap-1">
                    {plan.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {result && result.warnings.length > 0 && <IssueList issues={result.warnings} tone="warn" />}
          {submitError && <IssueList issues={[{ path: 'server', message: submitError }]} tone="error" />}
        </div>
      )}

      {step === 'done' && outcome && (
        <div className="flex flex-col items-center text-center gap-4 py-6">
          <StatusStamp status="FILED" fresh className="!h-9 !px-3 !text-[15px]" />
          <p className="font-display text-xl text-ink">
            {outcome.result.courses} {outcome.result.courses === 1 ? 'course' : 'courses'} filed under {outcome.result.semesterName}.
          </p>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border border-border rounded-xs overflow-hidden w-full max-w-lg">
            {[
              ['Weekly classes', outcome.plan.counts.meetings],
              ['Grade categories', outcome.plan.counts.categories],
              ['Graded items', outcome.plan.counts.assessments],
              ['Exams/quizzes', outcome.plan.counts.exams],
            ].map(([k, v]) => (
              <div key={k} className="bg-surface p-3">
                <dt className="micro">{k}</dt>
                <dd className="tabular text-xl text-ink mt-1">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[13px] text-ink-muted max-w-md">
            {outcome.result.shownOnDashboard
              ? 'Grade standing, today’s classes and upcoming exams on the briefing now include them.'
              : 'It isn’t your current semester, so today’s briefing is unchanged. Switch semesters to see it.'}
          </p>
        </div>
      )}
    </Modal>
  )
}
