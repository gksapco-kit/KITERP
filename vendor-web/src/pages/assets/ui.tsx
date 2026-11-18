/** Shared building blocks for the Asset Management pages. */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { STATUS_LABEL, useAm, type Row } from './api'

/* ── formatting ─────────────────────────────────────────────────────────────── */
export function fmtDate(v?: string | null): string {
  if (!v) return '—'
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}
export function fmtDateTime(v?: string | null): string {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
export function money(n?: number | string | null): string {
  const v = Number(n ?? 0)
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number.isFinite(v) ? v : 0)
}
export function titleCase(s?: string | null): string {
  return (s ?? '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}
/** Value for <input type="datetime-local"> from an ISO string. */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
export function localInputToIso(v: string): string | undefined {
  if (!v) return undefined
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

/* ── badges ─────────────────────────────────────────────────────────────────── */
const TONES: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
}
const STATUS_TONE: Record<string, string> = {
  in_stock: 'green', assigned: 'blue', in_transit: 'violet', under_maintenance: 'amber', reserved: 'violet',
  lost: 'red', retired: 'gray', disposed: 'gray',
  // transfers / requests / audits / work orders / coverage
  draft: 'gray', requested: 'amber', approved: 'blue', received: 'green', rejected: 'red', cancelled: 'gray',
  pending: 'amber', fulfilled: 'green', in_progress: 'blue', completed: 'green', open: 'amber',
  found: 'green', missing: 'red', damaged: 'red', wrong_location: 'amber',
  active: 'green', expiring: 'amber', expired: 'red', inactive: 'gray', booked: 'blue',
  low: 'gray', medium: 'blue', high: 'amber', urgent: 'red',
  new: 'green', good: 'green', fair: 'amber', poor: 'amber',
}
export function Pill({ children, tone = 'gray', className }: { children: ReactNode; tone?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', TONES[tone] ?? TONES.gray, className)}>
      {children}
    </span>
  )
}
export function StatusBadge({ value }: { value?: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  return <Pill tone={STATUS_TONE[value] ?? 'gray'}>{STATUS_LABEL[value] ?? titleCase(value)}</Pill>
}

/* ── layout ─────────────────────────────────────────────────────────────────── */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-border bg-card', className)}>
      {title || actions ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {actions}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Stat({ label, value, hint, tone, to }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'red' | 'amber' | 'green'; to?: () => void }) {
  const color = tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : tone === 'green' ? 'text-emerald-600' : 'text-foreground'
  const body = (
    <>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-2xl font-bold', color)}>{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </>
  )
  return to ? (
    <button type="button" onClick={to} className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent">{body}</button>
  ) : (
    <div className="rounded-xl border border-border bg-card p-4">{body}</div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">{children}</div>
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
    </div>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  const e = error as { response?: { data?: { detail?: unknown } }; message?: string }
  const d = e?.response?.data?.detail
  const msg = typeof d === 'string' ? d : e?.message || 'Could not load data'
  return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{msg}</div>
}

/** Simple tab strip (controlled). */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; badge?: number | null }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            value === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
          {t.badge ? <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 text-xs text-primary">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function Pager({ page, size, total, onPage }: { page: number; size: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size))
  if (total <= size) return null
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
      <span>{total} items</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span>Page {page} of {pages}</span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  )
}

/* ── tables ─────────────────────────────────────────────────────────────────── */
export type Col<T = Row> = { key: string; header: ReactNode; render?: (r: T) => ReactNode; className?: string }

export function DataTable<T extends Row = Row>({ cols, rows, onRow, empty = 'Nothing here yet.' }: { cols: Col<T>[]; rows: T[]; onRow?: (r: T) => void; empty?: ReactNode }) {
  if (!rows.length) return <Empty>{empty}</Empty>
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>{cols.map((c) => <th key={c.key} className={cn('px-3 py-2 font-medium', c.className)}>{c.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={(r.id as string) ?? i} className={cn(onRow && 'cursor-pointer hover:bg-accent/50')} onClick={onRow ? () => onRow(r) : undefined}>
              {cols.map((c) => <td key={c.key} className={cn('px-3 py-2 align-middle', c.className)}>{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── forms ──────────────────────────────────────────────────────────────────── */
export function Field({ label, children, hint, required, className }: { label: string; children: ReactNode; hint?: ReactNode; required?: boolean; className?: string }) {
  return (
    <label className={cn('block space-y-1', className)}>
      <span className="text-sm font-medium text-foreground">{label}{required ? <span className="text-red-500"> *</span> : null}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn('flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50', props.className)}
    />
  )
}

export function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" className="h-4 w-4 rounded border-input" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function Sel({ value, onChange, options, placeholder, blank, disabled }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
  placeholder?: string; blank?: string; disabled?: boolean
}) {
  const opts = useMemo(() => (blank !== undefined ? [{ value: '', label: blank }, ...options] : options), [options, blank])
  return <Select value={value} onChange={onChange} options={opts} placeholder={placeholder} disabled={disabled} />
}

export const optList = (xs: string[]) => xs.map((x) => ({ value: x, label: titleCase(x) }))

/* ── dialog ─────────────────────────────────────────────────────────────────── */
export function Dialog({ title, subtitle, onClose, children, footer, wide }: { title: string; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  return (
    <ModalOverlay onClose={onClose}>
      <ModalPanel className={wide ? 'max-w-3xl' : 'max-w-lg'}>
        <ModalHeader title={title} subtitle={subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : undefined} onClose={onClose} />
        <ModalBody className="space-y-3">{children}</ModalBody>
        {footer ? <ModalFooter>{footer}</ModalFooter> : null}
      </ModalPanel>
    </ModalOverlay>
  )
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/* ── pickers ────────────────────────────────────────────────────────────────── */
export function EmployeeSelect({ value, onChange, blank = 'Select employee…' }: { value: string; onChange: (v: string) => void; blank?: string }) {
  const { data = [] } = useAm<Row[]>('/pickers/employees', undefined, { staleTime: 60_000 })
  const options = useMemo(() => data.map((e) => ({ value: e.id, label: `${e.name}${e.code ? ` (${e.code})` : ''}${e.department ? ` · ${e.department}` : ''}` })), [data])
  return <Sel value={value} onChange={onChange} options={options} blank={blank} />
}
export function DepartmentSelect({ value, onChange, blank = 'Select department…' }: { value: string; onChange: (v: string) => void; blank?: string }) {
  const { data = [] } = useAm<Row[]>('/pickers/departments', undefined, { staleTime: 60_000 })
  return <Sel value={value} onChange={onChange} options={data.map((d) => ({ value: d.id, label: d.name }))} blank={blank} />
}
export function StoreSelect({ value, onChange, blank = 'Select store…' }: { value: string; onChange: (v: string) => void; blank?: string }) {
  const { data = [] } = useAm<Row[]>('/pickers/stores', undefined, { staleTime: 60_000 })
  return <Sel value={value} onChange={onChange} options={data.map((d) => ({ value: d.id, label: d.name }))} blank={blank} />
}
export function LocationSelect({ value, onChange, blank = 'Select location…' }: { value: string; onChange: (v: string) => void; blank?: string }) {
  const { data = [] } = useAm<Row[]>('/locations', undefined, { staleTime: 60_000 })
  return <Sel value={value} onChange={onChange} options={data.filter((l) => l.is_active !== false).map((l) => ({ value: l.id, label: l.path || l.name }))} blank={blank} />
}
export function CategorySelect({ value, onChange, blank = 'Select category…' }: { value: string; onChange: (v: string) => void; blank?: string }) {
  const { data = [] } = useAm<Row[]>('/categories', undefined, { staleTime: 60_000 })
  return <Sel value={value} onChange={onChange} options={data.filter((c) => c.is_active !== false).map((c) => ({ value: c.id, label: c.name }))} blank={blank} />
}

/** A service provider: ``id`` is set when picked from the supplier master, empty for a typed-in name. */
export type Provider = { id: string; name: string }
export const NO_PROVIDER: Provider = { id: '', name: '' }

/**
 * Search-as-you-type supplier chooser backed by the Supplier master. A name that is not in the master can still be
 * used as typed, so a technician who has not been set up yet never blocks the form.
 */
export function ProviderPicker({ value, onChange }: { value: Provider; onChange: (p: Provider) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const dq = useDebounced(q, 250)
  const active = !value.name && open
  const { data, isFetching } = useAm<Row[]>('/pickers/suppliers', { q: dq || undefined }, { enabled: active })
  if (value.name) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
        <span className="min-w-0 truncate">
          {value.name} <Pill tone={value.id ? 'green' : 'gray'} className="ml-1">{value.id ? 'Supplier master' : 'Typed in'}</Pill>
        </span>
        <Button variant="ghost" size="xs" onClick={() => onChange(NO_PROVIDER)}>Change</Button>
      </div>
    )
  }
  const typed = q.trim()
  return (
    <div className="space-y-1" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false) }}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search supplier by name, code, GSTIN or phone…" value={q}
          onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} />
      </div>
      {open ? (
        <div className="max-h-52 overflow-y-auto rounded-md border border-border bg-card">
          {isFetching && !data ? <div className="p-2 text-xs text-muted-foreground">Searching…</div> : null}
          {(data ?? []).map((s) => (
            <button key={s.id} type="button" onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange({ id: s.id, name: s.name }); setQ(''); setOpen(false) }}
              className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent">
              <span className="font-medium">{s.name}{s.code ? <span className="ml-1 font-mono text-xs text-muted-foreground">{s.code}</span> : null}</span>
              {[s.gstin, s.phone, s.email].filter(Boolean).length ? (
                <span className="text-xs text-muted-foreground">{[s.gstin, s.phone, s.email].filter(Boolean).join(' · ')}</span>
              ) : null}
            </button>
          ))}
          {data && !data.length ? <div className="p-2 text-xs text-muted-foreground">{dq ? 'No matching supplier.' : 'No suppliers yet.'}</div> : null}
          {typed ? (
            <button type="button" onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange({ id: '', name: typed }); setQ(''); setOpen(false) }}
              className="w-full border-t border-border px-3 py-2 text-left text-sm text-primary hover:bg-accent">
              Use “{typed}” as typed (not in the supplier master)
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Purchase order and supplier bill pickers for one supplier. Picking a bill that is against a PO fills in the PO. */
export function SupplierDocLinks({ supplierId, poId, billId, onPo, onBill }: {
  supplierId: string; poId: string; billId: string; onPo: (v: string) => void; onBill: (v: string) => void
}) {
  const enabled = !!supplierId
  const { data: pos = [] } = useAm<Row[]>('/pickers/purchase-orders', { supplier_id: supplierId }, { enabled, staleTime: 30_000 })
  const { data: bills = [] } = useAm<Row[]>('/pickers/vendor-bills', { supplier_id: supplierId }, { enabled, staleTime: 30_000 })
  const poOpts = useMemo(() => pos.map((p) => ({ value: p.id, label: `${p.po_number} · ${titleCase(p.status)} · ${money(p.total)} ${p.currency ?? ''}`.trim() })), [pos])
  const billOpts = useMemo(() => bills.map((b) => ({ value: b.id, label: `${b.bill_no} · ${titleCase(b.status)} · ${money(b.total)} ${b.currency ?? ''}`.trim() })), [bills])
  if (!enabled) {
    return <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
      Pick a supplier from the master to link its purchase order or bill.</p>
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Purchase order" hint={pos.length ? undefined : 'No purchase orders for this supplier.'}>
        <Sel value={poId} onChange={onPo} options={poOpts} blank="No PO" />
      </Field>
      <Field label="Supplier bill / invoice" hint={bills.length ? 'The bill books the cost, so it is not posted to the ledger again.' : 'No bills for this supplier.'}>
        <Sel value={billId} onChange={(v) => {
          onBill(v)
          const b = bills.find((x) => x.id === v)
          if (b?.po_id && !poId) onPo(b.po_id)
        }} options={billOpts} blank="No bill" />
      </Field>
    </div>
  )
}

/** Search-as-you-type asset chooser. Shows matching assets on focus (empty query = first page). */
export function AssetPicker({ value, onChange, status, label }: {
  value: Row | null; onChange: (a: Row | null) => void; status?: string; label?: string
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const dq = useDebounced(q, 250)
  const active = !value && open
  const { data, isFetching } = useAm<{ items: Row[] }>(
    '',
    { q: dq || undefined, status, size: 8 },
    { enabled: active },
  )
  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
        <span><span className="font-mono font-semibold">{value.asset_tag}</span> · {value.name}</span>
        <Button variant="ghost" size="xs" onClick={() => onChange(null)}>Change</Button>
      </div>
    )
  }
  return (
    <div className="space-y-1" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false) }}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={label ?? 'Search by tag, name or serial…'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open ? (
        <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-card">
          {isFetching && !data ? <div className="p-2 text-xs text-muted-foreground">Searching…</div> : null}
          {(data?.items ?? []).map((a) => (
            <button
              key={a.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(a); setQ(''); setOpen(false) }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <span><span className="font-mono font-semibold">{a.asset_tag}</span> · {a.name}</span>
              <StatusBadge value={a.status} />
            </button>
          ))}
          {data && !data.items.length ? (
            <div className="p-2 text-xs text-muted-foreground">
              {dq ? 'No matching assets.' : status === 'in_stock' ? 'No assets in stock.' : 'No assets found.'}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
