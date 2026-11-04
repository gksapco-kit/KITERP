import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { errMessage, reApi } from '@/api/realestate'
import type { ActionMeta, ActionParam, FieldMeta, ResourceMeta, Row } from '@/api/realestate'
import { EmptyState, fieldClass, fmtMoney, humanize, renderCell, useREMeta } from './shared'

// ── field editor ────────────────────────────────────────────────────────────────────────────

type EditorField = Pick<FieldMeta, 'name' | 'label' | 'type' | 'choices' | 'ref' | 'shape'> & { required?: boolean; max?: number }

function RefSelect({
  refKey, value, onChange, label,
}: { refKey: string; value: string; onChange: (v: string) => void; label?: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ['re-ref', refKey],
    queryFn: () => reApi.list(refKey, { size: 200 }),
    staleTime: 30_000,
  })
  const items = data?.items ?? []
  const known = items.some((i) => i.id === value)
  return (
    <select className={fieldClass} value={value} onChange={(e) => onChange(e.target.value)} disabled={isLoading}>
      <option value="">{isLoading ? 'Loading…' : '— none —'}</option>
      {value && !known && <option value={value}>{label || value}</option>}
      {items.map((i) => (
        <option key={i.id} value={i.id}>{i._label || i.id}</option>
      ))}
    </select>
  )
}

// ── list editor (chip/tag style) ────────────────────────────────────────────────────────────

function parseJsonList(value: string): string[] {
  if (!value) return []
  try {
    const v = JSON.parse(value)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return value.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean)
  }
}

function ListEditor({
  value, onChange, disabled, placeholder,
}: { value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string }) {
  const items = parseJsonList(value)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const commit = (next: string[]) => onChange(next.length ? JSON.stringify(next) : '')

  const add = (raw: string) => {
    const parts = raw.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean)
    const next = [...items]
    for (const p of parts) {
      if (!next.some((i) => i.toLowerCase() === p.toLowerCase())) next.push(p)
    }
    commit(next)
    setDraft('')
  }

  return (
    <div
      className={`${fieldClass} h-auto min-h-[40px] cursor-text flex-wrap items-center gap-1.5 py-1.5 flex`}
      onClick={() => inputRef.current?.focus()}
    >
      {items.map((it, i) => (
        <span
          key={`${it}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
        >
          {it}
          {!disabled && (
            <button
              type="button"
              className="ml-0.5 text-muted-foreground hover:text-foreground leading-none"
              onClick={(e) => { e.stopPropagation(); commit(items.filter((_, j) => j !== i)) }}
              aria-label={`Remove ${it}`}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          ref={inputRef}
          className="min-w-[150px] flex-1 bg-transparent text-sm outline-none"
          value={draft}
          placeholder={items.length === 0 ? (placeholder ?? 'Type and press Enter or comma…') : 'Add more…'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',') && draft.trim()) {
              e.preventDefault()
              add(draft)
            }
            if (e.key === 'Backspace' && !draft && items.length) {
              commit(items.slice(0, -1))
            }
          }}
          onPaste={(e) => {
            const t = e.clipboardData.getData('text')
            if (/\r?\n|,/.test(t)) { e.preventDefault(); add(t) }
          }}
          onBlur={() => { if (draft.trim()) add(draft) }}
        />
      )}
    </div>
  )
}

// ── map editor (key/value rows) ─────────────────────────────────────────────────────────────

function parseJsonMap(value: string): [string, string][] {
  if (!value) return []
  try {
    const v = JSON.parse(value)
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.entries(v).map(([k, x]) => [k, String(x ?? '')])
    }
  } catch { /* ignore */ }
  return []
}

function MapEditor({
  value, onChange, disabled,
}: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [rows, setRows] = useState<[string, string][]>(() => parseJsonMap(value))

  const commit = (next: [string, string][]) => {
    setRows(next)
    const obj: Record<string, string | number> = {}
    for (const [k, v] of next) {
      if (!k.trim()) continue
      const n = Number(v)
      obj[k.trim()] = v !== '' && !Number.isNaN(n) ? n : v
    }
    onChange(Object.keys(obj).length ? JSON.stringify(obj) : '')
  }

  return (
    <div className="space-y-2">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex gap-2">
          <Input
            className="flex-1"
            placeholder="Name (e.g. East)"
            value={k}
            disabled={disabled}
            onChange={(e) => commit(rows.map((r, j): [string, string] => j === i ? [e.target.value, r[1]] : r))}
          />
          <Input
            className="flex-1"
            placeholder="Value (e.g. 150000)"
            value={v}
            disabled={disabled}
            onChange={(e) => commit(rows.map((r, j): [string, string] => j === i ? [r[0], e.target.value] : r))}
          />
          {!disabled && (
            <Button type="button" variant="ghost" size="sm" onClick={() => commit(rows.filter((_, j) => j !== i))}>
              ×
            </Button>
          )}
        </div>
      ))}
      {!disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => commit([...rows, ['', '']])}
        >
          + Add row
        </Button>
      )}
      {rows.length === 0 && disabled && (
        <p className="text-sm text-muted-foreground">—</p>
      )}
    </div>
  )
}

// ── field editor ────────────────────────────────────────────────────────────────────────────

function FieldEditor({
  field, value, onChange, refLabel, disabled,
}: {
  field: EditorField
  value: string
  onChange: (v: string) => void
  refLabel?: string | null
  disabled?: boolean
}) {
  switch (field.type) {
    case 'ref':
      return field.ref ? (
        <RefSelect refKey={field.ref} value={value} onChange={onChange} label={refLabel} />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
      )
    case 'select':
      return (
        <select className={fieldClass} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
          {!field.required && <option value="">—</option>}
          {(field.choices ?? []).map((c) => (
            <option key={c} value={c}>{humanize(c)}</option>
          ))}
        </select>
      )
    case 'boolean':
      return (
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
            disabled={disabled}
          />
          Yes
        </label>
      )
    case 'textarea':
      return (
        <textarea
          className={`${fieldClass} h-auto min-h-[84px]`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={field.max}
          disabled={disabled}
        />
      )
    case 'json':
      if (field.shape === 'list') {
        return <ListEditor value={value} onChange={onChange} disabled={disabled} />
      }
      if (field.shape === 'map') {
        return <MapEditor value={value} onChange={onChange} disabled={disabled} />
      }
      return (
        <textarea
          className={`${fieldClass} h-auto min-h-[84px] font-mono text-xs`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="{}"
          disabled={disabled}
        />
      )
    case 'integer':
      return <Input type="number" step="1" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    case 'money':
    case 'number':
    case 'percent':
    case 'decimal':
      return <Input type="number" step="any" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    case 'date':
      return <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    case 'datetime':
      return <Input type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    default:
      return <Input value={value} onChange={(e) => onChange(e.target.value)} maxLength={field.max} disabled={disabled} />
  }
}

function toInput(field: { type: string }, v: unknown): string {
  if (v === null || v === undefined) return ''
  if (field.type === 'boolean') return v ? 'true' : 'false'
  if (field.type === 'json') return typeof v === 'string' ? v : JSON.stringify(v, null, 2)
  if (field.type === 'datetime') return String(v).slice(0, 16)
  if (field.type === 'date') return String(v).slice(0, 10)
  return String(v)
}

function fromInput(field: { type: string; name: string }, raw: string): unknown {
  if (raw === '') return null
  if (field.type === 'boolean') return raw === 'true'
  if (field.type === 'integer') return parseInt(raw, 10)
  if (field.type === 'json') {
    try {
      return JSON.parse(raw)
    } catch {
      throw new Error(`${field.name}: invalid JSON`)
    }
  }
  if (field.type === 'datetime') return new Date(raw).toISOString()
  return raw
}

// ── create / edit modal ─────────────────────────────────────────────────────────────────────

function RecordForm({
  res, row, defaults, onClose, onSaved,
}: {
  res: ResourceMeta
  row: Row | null
  defaults: Record<string, string>
  onClose: () => void
  onSaved: () => void
}) {
  const fields = useMemo(() => {
    // Resources created through a dedicated endpoint (bookings, receipts ...) declare their own "New" form.
    if (!row && res.create_fields?.length) {
      return res.create_fields
        .map((n) => res.fields.find((f) => f.name === n))
        .filter((f): f is FieldMeta => !!f)
        .map((f) => ({ ...f, readonly: false, hidden: false }))
    }
    return res.fields.filter((f) => !f.hidden && !f.readonly)
  }, [res.fields, res.create_fields, row])
  const [initial] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {}
    const today = new Date().toISOString().slice(0, 10)
    for (const f of fields) {
      v[f.name] = row
        ? toInput(f, row[f.name])
        : defaults[f.name] ?? (f.type === 'boolean' ? 'false' : f.type === 'date' && f.required ? today : '')
    }
    return v
  })
  const [values, setValues] = useState<Record<string, string>>(initial)

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {}
      for (const f of fields) {
        const raw = values[f.name] ?? ''
        if (f.required && raw === '') throw new Error(`${f.label} is required`)
        if (row) {
          if (raw !== initial[f.name]) body[f.name] = fromInput(f, raw)
        } else if (raw !== '') {
          body[f.name] = fromInput(f, raw)
        }
      }
      if (row && Object.keys(body).length === 0) return row
      return row ? reApi.update(res.key, row.id, body) : reApi.create(res.key, body)
    },
    onSuccess: () => {
      toast.success(row ? 'Saved' : 'Created')
      onSaved()
    },
    onError: (e) => toast.error(errMessage(e)),
  })

  return (
    <ModalOverlay onClose={onClose}>
      <ModalPanel className="max-w-3xl">
        <ModalHeader title={`${row ? 'Edit' : 'New'} — ${res.title}`} onClose={onClose} />
        <ModalBody>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.name} className={f.type === 'textarea' || f.type === 'json' ? 'sm:col-span-2' : ''}>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {f.label}
                  {f.required && <span className="text-red-500"> *</span>}
                </label>
                <FieldEditor
                  field={f}
                  value={values[f.name] ?? ''}
                  onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
                  refLabel={row?._refs?.[f.name]}
                />
              </div>
            ))}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="cancel" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {row ? 'Save changes' : 'Create'}
          </Button>
        </ModalFooter>
      </ModalPanel>
    </ModalOverlay>
  )
}

// ── action runner ───────────────────────────────────────────────────────────────────────────

function ResultTree({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>
  if (typeof value === 'number') return <span>{Number.isInteger(value) ? value : fmtMoney(value)}</span>
  if (typeof value !== 'object') return <span>{String(value)}</span>
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-muted-foreground">none</span>
    return (
      <ul className="space-y-1">
        {value.map((v, i) => (
          <li key={i} className={depth ? 'rounded border border-border/60 px-2 py-1' : ''}>
            <ResultTree value={v} depth={depth + 1} />
          </li>
        ))}
      </ul>
    )
  }
  return (
    <dl className="grid grid-cols-[minmax(120px,max-content)_1fr] gap-x-4 gap-y-1">
      {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-xs text-muted-foreground">{humanize(k)}</dt>
          <dd className="text-sm"><ResultTree value={v} depth={depth + 1} /></dd>
        </div>
      ))}
    </dl>
  )
}

export function ResultModal({ title, data, onClose }: { title: string; data: any; onClose: () => void }) {
  const html = typeof data?.html === 'string' ? (data.html as string) : null
  return (
    <ModalOverlay onClose={onClose}>
      <ModalPanel className="max-w-4xl">
        <ModalHeader title={title} onClose={onClose} />
        <ModalBody>
          {html !== null ? (
            html ? (
              // sandboxed: letters are merge-field HTML and must never run scripts
              <iframe title={title} sandbox="" srcDoc={html} className="h-[60vh] w-full rounded border border-border bg-white" />
            ) : (
              <EmptyState title="Nothing to show yet" />
            )
          ) : (
            <ResultTree value={data} />
          )}
        </ModalBody>
        <ModalFooter>
          {html && (
            <Button
              variant="outline"
              onClick={() => {
                const w = window.open('', '_blank')
                if (w) {
                  w.document.write(html)
                  w.document.close()
                  w.focus()
                  w.print()
                }
              }}
            >
              Print
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalPanel>
    </ModalOverlay>
  )
}

export function ActionDialog({
  res, row, action, onClose, onDone,
}: {
  res: ResourceMeta
  row: Row
  action: ActionMeta
  onClose: () => void
  onDone: (result: any) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {}
    for (const p of action.params) v[p.name] = p.default !== undefined && p.default !== null ? String(p.default) : ''
    return v
  })
  const run = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {}
      for (const p of action.params) {
        const raw = values[p.name] ?? ''
        if (p.required && raw === '') throw new Error(`${p.label} is required`)
        if (raw === '') continue
        body[p.name] = fromInput({ type: p.type, name: p.name }, raw)
      }
      return reApi.runAction(res.key, row.id, action, body)
    },
    onSuccess: (data) => onDone(data),
    onError: (e) => toast.error(errMessage(e)),
  })

  const asEditor = (p: ActionParam): EditorField => ({
    name: p.name, label: p.label, required: p.required,
    type: (p.choices ? 'select' : p.type) as FieldMeta['type'], choices: p.choices, ref: p.ref,
  })

  return (
    <ModalOverlay onClose={onClose}>
      <ModalPanel className="max-w-lg">
        <ModalHeader title={action.label} subtitle={<p className="text-xs text-muted-foreground">{row._label}</p>} onClose={onClose} />
        <ModalBody>
          {action.confirm && <p className="mb-3 text-sm text-foreground">{action.confirm}</p>}
          <div className="space-y-3">
            {action.params.map((p) => (
              <div key={p.name}>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {p.label}
                  {p.required && <span className="text-red-500"> *</span>}
                </label>
                <FieldEditor
                  field={asEditor(p)}
                  value={values[p.name] ?? ''}
                  onChange={(v) => setValues((s) => ({ ...s, [p.name]: v }))}
                />
              </div>
            ))}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="cancel" onClick={onClose}>Cancel</Button>
          <Button variant={action.style === 'danger' ? 'destructive' : 'default'} onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {action.label}
          </Button>
        </ModalFooter>
      </ModalPanel>
    </ModalOverlay>
  )
}

function whenOk(row: Row, when?: Record<string, string[]> | null): boolean {
  if (!when) return true
  return Object.entries(when).every(([k, vals]) => vals.includes(row[k]))
}

// ── main table ──────────────────────────────────────────────────────────────────────────────

export default function ResourceTable({
  resourceKey, filter,
}: { resourceKey: string; filter?: Record<string, string> }) {
  const { data: meta } = useREMeta()
  const res = meta?.resources[resourceKey]
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [form, setForm] = useState<{ row: Row | null } | null>(null)
  const [pending, setPending] = useState<{ row: Row; action: ActionMeta } | null>(null)
  const [result, setResult] = useState<{ title: string; data: unknown } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => { setPage(1) }, [debounced, filters, resourceKey, filter])
  useEffect(() => { setFilters({}); setSearch('') }, [resourceKey])

  const fixedFilter = filter ?? {}
  const queryParams = { ...filters, ...fixedFilter, search: debounced || undefined, page, size: 25 }
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['re-list', resourceKey, queryParams],
    queryFn: () => reApi.list(resourceKey, queryParams),
    enabled: !!res,
    placeholderData: (prev) => prev,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['re-list', resourceKey] })

  const del = useMutation({
    mutationFn: (id: string) => reApi.remove(resourceKey, id),
    onSuccess: () => { toast.success('Deleted'); refresh() },
    onError: (e) => toast.error(errMessage(e)),
  })

  if (!res) return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>

  const fieldByName = new Map(res.fields.map((f) => [f.name, f]))
  const perms = meta?.permissions ?? []
  const canWrite = perms.includes(res.write_perm) || perms.includes('realestate.admin')
  const editable = (row: Row) => whenOk(row, res.editable_when)
  const defaults = Object.fromEntries(Object.entries(fixedFilter).filter(([k]) => !k.includes('__')))
  const filterFields = res.filters.map((n) => fieldByName.get(n)).filter(Boolean) as FieldMeta[]
  const items = data?.items ?? []

  const startAction = (row: Row, action: ActionMeta) => {
    if (action.params.length || action.confirm) setPending({ row, action })
    else void execute(row, action, {})
  }

  async function execute(row: Row, action: ActionMeta, values: Record<string, unknown>) {
    try {
      const out = await reApi.runAction(resourceKey, row.id, action, values)
      handleResult(row, action, out)
    } catch (e) {
      toast.error(errMessage(e))
    }
  }

  function handleResult(row: Row, action: ActionMeta, out: any) {
    setPending(null)
    const showsPayload = action.result === 'html' || action.method === 'GET' || typeof out?.html === 'string'
    if (showsPayload) setResult({ title: `${action.label} — ${row._label ?? ''}`, data: out })
    else toast.success(out?.message || `${action.label} done`)
    if (Array.isArray(out?.warnings)) for (const w of out.warnings) toast.warning(String(w))
    refresh()
    qc.invalidateQueries({ queryKey: ['re-ref'] })
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {res.search && (
          <div className="relative w-64 max-w-full">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 pl-8" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        )}
        {filterFields.filter((f) => !(f.name in fixedFilter)).map((f) =>
          f.type === 'ref' && f.ref ? (
            <div key={f.name} className="w-48">
              <RefSelect refKey={f.ref} value={filters[f.name] ?? ''} onChange={(v) => setFilters((s) => ({ ...s, [f.name]: v }))} />
            </div>
          ) : f.type === 'select' ? (
            <select
              key={f.name}
              className={`${fieldClass} h-9 w-44`}
              value={filters[f.name] ?? ''}
              onChange={(e) => setFilters((s) => ({ ...s, [f.name]: e.target.value }))}
              title={f.label}
            >
              <option value="">All {f.label.toLowerCase()}</option>
              {(f.choices ?? []).map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
            </select>
          ) : null,
        )}
        <div className="ml-auto flex items-center gap-2">
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {res.can_create && canWrite && (
            <Button size="sm" onClick={() => setForm({ row: null })}>
              <Plus className="h-4 w-4" /> New
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <EmptyState title="Could not load records" hint={errMessage(error)} />
      ) : isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <EmptyState title={`No ${res.title.toLowerCase()} yet`} hint={res.can_create && canWrite ? 'Use “New” to add the first record.' : undefined} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {res.columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">{fieldByName.get(c)?.label ?? humanize(c)}</th>
                ))}
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((row) => {
                const rowActions = res.actions.filter((a) => whenOk(row, a.when))
                return (
                  <tr key={row.id} className="hover:bg-muted/30">
                    {res.columns.map((c) => (
                      <td key={c} className="whitespace-nowrap px-3 py-2">{renderCell(fieldByName.get(c), row, c)}</td>
                    ))}
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {canWrite && rowActions.map((a) => (
                          <Button
                            key={a.key}
                            size="xs"
                            variant={a.style === 'primary' ? 'default' : a.style === 'danger' ? 'destructive' : 'outline'}
                            onClick={() => startAction(row, a)}
                          >
                            {a.label}
                          </Button>
                        ))}
                        {!canWrite && rowActions.filter((a) => a.method === 'GET').map((a) => (
                          <Button key={a.key} size="xs" variant="outline" onClick={() => startAction(row, a)}>{a.label}</Button>
                        ))}
                        {res.can_edit && canWrite && editable(row) && (
                          <Button size="icon-sm" variant="ghost" title="Edit" onClick={() => setForm({ row })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {res.can_delete && canWrite && editable(row) && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title="Delete"
                            onClick={() => { if (window.confirm(`Delete ${row._label ?? 'this record'}?`)) del.mutate(row.id) }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{data.total} records</span>
          <div className="flex items-center gap-2">
            <Button size="icon-sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span>Page {data.page} of {data.pages}</span>
            <Button size="icon-sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {form && (
        <RecordForm
          res={res}
          row={form.row}
          defaults={defaults}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); refresh() }}
        />
      )}
      {pending && (
        <ActionDialog
          res={res}
          row={pending.row}
          action={pending.action}
          onClose={() => setPending(null)}
          onDone={(out) => handleResult(pending.row, pending.action, out)}
        />
      )}
      {result && <ResultModal title={result.title} data={result.data} onClose={() => setResult(null)} />}
    </div>
  )
}
