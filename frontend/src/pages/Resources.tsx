import { Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/FormField'
import { Modal } from '../components/ui/Overlay'
import { EmptyState, PageHeader, RecordCard } from '../components/ui/Panels'
import { SelectField, TextAreaField } from '../components/ui/SelectField'
import type { LLink } from '../lib/localDb'
import { useAppData } from '../lib/store'

const UNCATEGORIZED = '__none__'
const GLOBAL_ONLY = '__global__'

const controlCls =
  'h-10 px-3 bg-surface border border-border-strong rounded-xs text-ink placeholder:text-ink-faint ' +
  'focus:outline-none focus:border-accent focus:shadow-[0_0_0_1px_var(--color-accent)]'

/** Returns a normalized http(s) URL, or null if the input is not acceptable. */
function normalizeUrl(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  let candidate = v
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^[a-z0-9.-]+:\d+(\/|$)/i.test(v)) {
    if (!/^https?:\/\//i.test(v)) return null
  } else if (!/^https?:\/\//i.test(v)) {
    candidate = `https://${v}`
  }
  try {
    const u = new URL(candidate)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!u.hostname) return null
    return candidate
  } catch {
    return null
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

const blank = { title: '', url: '', description: '', course: '', category: '', favorite: false }

interface LinkFormProps {
  open: boolean
  onClose: () => void
  link: LLink | null
  categories: string[]
}

function LinkFormModal({ open, onClose, link, categories }: LinkFormProps) {
  const { db, mutate } = useAppData()
  const [f, setF] = useState(blank)
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setF(
      link
        ? {
            title: link.title,
            url: link.url,
            description: link.description,
            course: link.course_id === null ? '' : String(link.course_id),
            category: link.category,
            favorite: link.favorite,
          }
        : blank,
    )
  }, [open, link])

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  const save = (e?: FormEvent) => {
    e?.preventDefault()
    const next: { title?: string; url?: string } = {}
    if (!f.title.trim()) next.title = 'Give the link a title.'
    const url = normalizeUrl(f.url)
    if (!f.url.trim()) next.url = 'Enter a URL.'
    else if (!url) next.url = 'Use a web address starting with http:// or https://.'
    setErrors(next)
    if (next.title || next.url || !url) return
    const values = {
      title: f.title.trim(),
      url,
      description: f.description.trim(),
      course_id: f.course ? Number(f.course) : null,
      category: f.category.trim(),
      favorite: f.favorite,
    }
    mutate((d, nid) => {
      if (link) {
        const x = d.links.find((y) => y.id === link.id)
        if (x) Object.assign(x, values)
      } else {
        d.links.push({ id: nid(), ...values })
      }
    })
    onClose()
  }

  const listId = 'resource-categories'

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="FORM R-1"
      title={link ? 'Edit link' : 'New link'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => save()}>
            {link ? 'Save' : 'File link'}
          </Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={save} noValidate>
        <FormField
          label="Title"
          placeholder="e.g. Lecture slides"
          autoFocus
          value={f.title}
          onChange={(e) => set('title', e.target.value)}
          error={errors.title}
        />
        <FormField
          label="URL"
          mono
          placeholder="https://example.com"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={f.url}
          onChange={(e) => set('url', e.target.value)}
          error={errors.url}
        />
        <TextAreaField
          label="Description"
          placeholder="Optional"
          value={f.description}
          onChange={(e) => set('description', e.target.value)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            label="Course"
            value={f.course}
            onChange={(e) => set('course', e.target.value)}
            options={[{ value: '', label: 'Global' }, ...db.courses.map((c) => ({ value: String(c.id), label: `${c.code} · ${c.name}` }))]}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="resource-category" className="micro !text-ink">
              Category
            </label>
            <input
              id="resource-category"
              list={listId}
              className={controlCls}
              placeholder="e.g. Lecture notes"
              value={f.category}
              onChange={(e) => set('category', e.target.value)}
            />
            <datalist id={listId}>
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-[14px] text-ink cursor-pointer">
          <input
            type="checkbox"
            checked={f.favorite}
            onChange={(e) => set('favorite', e.target.checked)}
            className="w-4 h-4 accent-[var(--color-accent)]"
          />
          Favorite
        </label>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

export function ResourcesPage() {
  const { db, mutate } = useAppData()
  const [editing, setEditing] = useState<LLink | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [favOnly, setFavOnly] = useState(false)

  const courses = useMemo(() => new Map(db.courses.map((c) => [c.id, c])), [db.courses])
  const categories = useMemo(
    () => Array.from(new Set(db.links.map((l) => l.category.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [db.links],
  )
  const favCount = db.links.filter((l) => l.favorite).length

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return db.links
      .filter((l) => {
        if (favOnly && !l.favorite) return false
        if (courseFilter === GLOBAL_ONLY && l.course_id !== null) return false
        if (courseFilter && courseFilter !== GLOBAL_ONLY && String(l.course_id) !== courseFilter) return false
        if (categoryFilter === UNCATEGORIZED && l.category.trim()) return false
        if (categoryFilter && categoryFilter !== UNCATEGORIZED && l.category.trim() !== categoryFilter) return false
        if (q) {
          const hay = `${l.title} ${l.url} ${l.description} ${l.category}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.title.localeCompare(b.title))
  }, [db.links, query, courseFilter, categoryFilter, favOnly])

  const filtersActive = query.trim() !== '' || courseFilter !== '' || categoryFilter !== '' || favOnly
  const clearFilters = () => {
    setQuery('')
    setCourseFilter('')
    setCategoryFilter('')
    setFavOnly(false)
  }

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const toggleFav = (l: LLink) =>
    mutate((d) => {
      const x = d.links.find((y) => y.id === l.id)
      if (x) x.favorite = !x.favorite
    })

  const remove = (l: LLink) => {
    if (!window.confirm(`Delete "${l.title}"?`)) return
    mutate((d) => {
      d.links = d.links.filter((x) => x.id !== l.id)
    })
  }

  const card = (l: LLink) => {
    const course = l.course_id !== null ? courses.get(l.course_id) : undefined
    return (
      <li key={l.id} className="bg-surface border border-border rounded-sm flex flex-col min-w-0">
        <div className="p-4 flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <h3 className="font-display text-[16px] font-medium leading-snug text-ink min-w-0 flex-1 break-words">
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent-strong hover:underline underline-offset-2"
              >
                {l.title}
              </a>
            </h3>
            <button
              type="button"
              onClick={() => toggleFav(l)}
              aria-pressed={l.favorite}
              aria-label={l.favorite ? `Remove "${l.title}" from favorites` : `Add "${l.title}" to favorites`}
              className="shrink-0 p-1 -m-1 text-ink-muted hover:text-mustard-ink"
            >
              <Star size={18} className={l.favorite ? 'fill-mustard text-mustard' : ''} />
            </button>
          </div>
          <p className="tabular text-[12px] text-ink-muted break-all">{hostOf(l.url)}</p>
          {l.description && <p className="mt-2 text-[13px] text-ink-muted whitespace-pre-line break-words">{l.description}</p>}
        </div>
        <div className="flex items-center gap-2 border-t border-rule px-4 py-2">
          <span className="inline-flex items-center gap-1.5 tabular text-[12px] text-ink-muted min-w-0">
            {course ? (
              <>
                <span className="w-2 h-2 rounded-[1px] shrink-0" style={{ background: course.color }} aria-hidden="true" />
                <span className="truncate">{course.code}</span>
              </>
            ) : (
              <span>Global</span>
            )}
          </span>
          {l.category.trim() && (
            <span className="micro border border-border px-1.5 py-0.5 rounded-xs truncate max-w-[40%]">{l.category}</span>
          )}
          <div className="ml-auto flex shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditing(l)
                setFormOpen(true)
              }}
              className="p-1.5 text-ink-muted hover:text-ink"
              aria-label={`Edit "${l.title}"`}
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              onClick={() => remove(l)}
              className="p-1.5 text-ink-muted hover:text-danger"
              aria-label={`Delete "${l.title}"`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </li>
    )
  }

  return (
    <>
      <PageHeader
        division="Division 08 · Directory"
        title="Internal Directory"
        subtitle={`${db.links.length} ${db.links.length === 1 ? 'link' : 'links'} · ${favCount} ${favCount === 1 ? 'favorite' : 'favorites'}`}
        aside={
          <Button variant="primary" icon={<Plus size={16} />} onClick={openNew}>
            New link
          </Button>
        }
      />

      {db.links.length === 0 ? (
        <RecordCard>
          <EmptyState
            code="DIRECTORY EMPTY"
            title="No links yet"
            body="Save lecture slides, course pages and anything else you keep coming back to."
            action={
              <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openNew}>
                New link
              </Button>
            }
          />
        </RecordCard>
      ) : (
        <div className="flex flex-col gap-4 lg:gap-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5 w-full sm:w-auto sm:flex-1 sm:min-w-[220px]">
              <label htmlFor="resource-search" className="micro !text-ink">
                Search
              </label>
              <input
                id="resource-search"
                type="search"
                className={controlCls}
                placeholder="Title, URL, description, category"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <SelectField
              label="Course"
              className="w-full sm:w-auto sm:min-w-[170px]"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              options={[
                { value: '', label: 'All' },
                { value: GLOBAL_ONLY, label: 'Global only' },
                ...db.courses.map((c) => ({ value: String(c.id), label: c.code })),
              ]}
            />
            <SelectField
              label="Category"
              className="w-full sm:w-auto sm:min-w-[170px]"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[
                { value: '', label: 'All' },
                ...categories.map((c) => ({ value: c, label: c })),
                { value: UNCATEGORIZED, label: 'Uncategorized' },
              ]}
            />
            <label className="inline-flex items-center gap-2 h-10 text-[14px] text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={favOnly}
                onChange={(e) => setFavOnly(e.target.checked)}
                className="w-4 h-4 accent-[var(--color-accent)]"
              />
              Favorites only
            </label>
          </div>

          {filtered.length === 0 ? (
            <RecordCard>
              <EmptyState
                code="NO MATCHES"
                title="No links match these filters"
                action={
                  filtersActive && (
                    <Button size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  )
                }
              />
            </RecordCard>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">{filtered.map(card)}</ul>
          )}
        </div>
      )}

      <LinkFormModal open={formOpen} onClose={() => setFormOpen(false)} link={editing} categories={categories} />
    </>
  )
}
