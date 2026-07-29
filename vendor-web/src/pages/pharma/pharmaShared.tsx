import { useEffect, useState, type ReactNode } from 'react'
import { Pill } from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: string | null | undefined): boolean {
  return !!value && UUID_RE.test(value.trim())
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

const STATUS_STYLES: Record<string, string> = {
  unrestricted: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  quality_inspection: 'bg-amber-50 text-amber-900 ring-amber-600/20',
  blocked: 'bg-red-50 text-red-800 ring-red-600/20',
  open: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  testing: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  pending_release: 'bg-amber-50 text-amber-900 ring-amber-600/20',
  released: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  rejected: 'bg-red-50 text-red-800 ring-red-600/20',
  draft: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  approved: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  superseded: 'bg-slate-100 text-slate-500 ring-slate-400/20',
  in_progress: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  closed: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  investigating: 'bg-amber-50 text-amber-900 ring-amber-600/20',
  notified: 'bg-violet-50 text-violet-800 ring-violet-600/20',
  in_review: 'bg-amber-50 text-amber-900 ring-amber-600/20',
  implemented: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  cancelled: 'bg-slate-100 text-slate-500 ring-slate-400/20',
  pending: 'bg-slate-100 text-slate-600 ring-slate-400/20',
  skipped: 'bg-slate-100 text-slate-500 ring-slate-400/20',
  done: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  enforced: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  partial: 'bg-amber-50 text-amber-900 ring-amber-600/20',
  scaffold: 'bg-slate-100 text-slate-600 ring-slate-400/20',
  active: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  shipped: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  recalled: 'bg-red-50 text-red-800 ring-red-600/20',
  destroyed: 'bg-slate-100 text-slate-600 ring-slate-400/20',
  wholesaler: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  dispenser: 'bg-violet-50 text-violet-800 ring-violet-600/20',
  manufacturer: 'bg-indigo-50 text-indigo-800 ring-indigo-600/20',
  in_transit: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  minor: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  major: 'bg-amber-50 text-amber-900 ring-amber-600/20',
  critical: 'bg-red-50 text-red-800 ring-red-600/20',
}

export function PharmaStatusBadge({
  status,
  className,
}: {
  status: string | null | undefined
  className?: string
}) {
  const key = (status || '').toLowerCase()
  const label = (status || '—').replace(/_/g, ' ')
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset',
        STATUS_STYLES[key] || 'bg-muted text-muted-foreground ring-border',
        className,
      )}
    >
      {label}
    </span>
  )
}

export function PharmaExpiryCell({ date }: { date?: string | null }) {
  const days = daysUntil(date)
  if (!date) return <span className="text-muted-foreground">—</span>
  let tone = 'text-foreground'
  let hint = ''
  if (days != null && days < 0) {
    tone = 'text-red-700 font-medium'
    hint = ` (${Math.abs(days)}d overdue)`
  } else if (days != null && days <= 30) {
    tone = 'text-amber-800 font-medium'
    hint = ` (${days}d)`
  }
  return (
    <span className={tone}>
      {date}
      {hint ? <span className="text-xs font-normal opacity-80">{hint}</span> : null}
    </span>
  )
}

export function PharmaProgress({
  done,
  total,
  label,
}: {
  done: number
  total: number
  label?: string
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="min-w-[120px]">
      {label ? <div className="mb-1 text-xs text-muted-foreground">{label}</div> : null}
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">
        {done}/{total} ({pct}%)
      </div>
    </div>
  )
}

/** Product dropdown for Pharma forms — prefers batch-managed products. */
export function PharmaProductSelect({
  value,
  onChange,
  className,
  placeholder = 'Select product…',
  batchManagedOnly = true,
  pharmaManagedOnly = false,
  storeId,
  allowEmpty = true,
  emptyLabel,
}: {
  value: string
  onChange: (id: string) => void
  className?: string
  placeholder?: string
  batchManagedOnly?: boolean
  /** Restrict to products enrolled in pharma manufacturing. */
  pharmaManagedOnly?: boolean
  /** Scope to a business unit / branch store id. */
  storeId?: string | null
  allowEmpty?: boolean
  emptyLabel?: string
}) {
  const [options, setOptions] = useState<{ value: string; label: string; hint?: string }[]>([])

  useEffect(() => {
    vendorApi
      .listProducts({
        limit: 200,
        product_type: 'physical',
        ...(pharmaManagedOnly ? { pharma_managed: true } : {}),
        ...(storeId ? { store_id: storeId } : {}),
      })
      .then((res) => {
        const items = (res?.items || []) as {
          id: string
          name: string
          sku?: string | null
          batch_managed?: boolean
        }[]
        const filtered = batchManagedOnly
          ? items.filter((p) => p.batch_managed)
          : items
        const source = filtered.length || !batchManagedOnly ? filtered : items
        const rows = source.map((p) => ({
          value: p.id,
          label: p.name,
          hint: p.sku || undefined,
        }))
        const empty = allowEmpty
          ? [{ value: '', label: emptyLabel || placeholder }]
          : []
        setOptions([...empty, ...rows])
      })
      .catch(() =>
        setOptions(allowEmpty ? [{ value: '', label: emptyLabel || placeholder }] : []),
      )
  }, [batchManagedOnly, pharmaManagedOnly, storeId, placeholder, allowEmpty, emptyLabel])

  return (
    <Select
      className={className}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      aria-label={placeholder}
    />
  )
}

/** Batch dropdown — search by batch number; value is batch UUID. */
export function PharmaBatchSelect({
  value,
  onChange,
  className,
  placeholder = 'Select batch…',
  qualityStatus,
}: {
  value: string
  onChange: (id: string, batch?: any) => void
  className?: string
  placeholder?: string
  qualityStatus?: string
}) {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([])
  const [byId, setById] = useState<Record<string, any>>({})

  useEffect(() => {
    import('@/api/pharma')
      .then(({ pharmaApi }) =>
        pharmaApi.batches({
          quality_status: qualityStatus,
          limit: 100,
        }),
      )
      .then((res) => {
        const map: Record<string, any> = {}
        const rows = (res?.batches || []).map((b: any) => {
          map[b.id] = b
          return {
            value: b.id,
            label: `${b.batch_number}${b.product_name ? ` · ${b.product_name}` : ''} · ${b.quality_status}`,
          }
        })
        setById(map)
        setOptions([{ value: '', label: placeholder }, ...rows])
      })
      .catch(() => setOptions([{ value: '', label: placeholder }]))
  }, [placeholder, qualityStatus])

  return (
    <Select
      className={className}
      value={value}
      onChange={(id) => onChange(id, byId[id])}
      options={options}
      placeholder={placeholder}
    />
  )
}

export function PharmaPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Pill className="h-3.5 w-3.5" />
          Pharmaceutical Manufacturing
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function PharmaCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4 shadow-sm', className)}>
      {children}
    </div>
  )
}

export function PharmaEmpty({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p> : null}
    </div>
  )
}

export function PharmaLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

export function PharmaPhaseBadge({ phase }: { phase: number }) {
  return (
    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
      Phase {phase}
    </span>
  )
}

export function PharmaSectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold text-foreground">{children}</h2>
}

export function PharmaToolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>
}

export function GenealogyNode({
  node,
  depth = 0,
}: {
  node: any
  depth?: number
}) {
  const [open, setOpen] = useState(true)
  if (!node) return null
  const kids: any[] = node.children || node.upstream || node.downstream || []
  const hasKids = kids.length > 0
  const label =
    node.batch_number || (node.batch_id ? String(node.batch_id).slice(0, 8) : '—')

  return (
    <div className={cn('relative', depth > 0 && 'ml-5 before:absolute before:-left-3 before:top-0 before:h-full before:border-l before:border-border/60')}>
      {/* node row */}
      <div
        className={cn(
          'relative flex flex-wrap items-center gap-1.5 py-1.5 text-sm',
          depth > 0 &&
            'before:absolute before:-left-3 before:top-[15px] before:w-3 before:border-t before:border-border/60',
        )}
      >
        {hasKids ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border/60 bg-background text-xs text-muted-foreground hover:bg-muted"
          >
            {open ? '−' : '+'}
          </button>
        ) : (
          <span className="h-5 w-5 shrink-0" />
        )}
        <span className="font-mono text-xs font-semibold">{label}</span>
        {node.txn_type ? <PharmaStatusBadge status={node.txn_type} /> : null}
        {node.quality_status ? <PharmaStatusBadge status={node.quality_status} /> : null}
        {node.qty != null ? (
          <span className="text-xs text-muted-foreground">qty {node.qty}</span>
        ) : null}
        {node.quantity_available != null ? (
          <span className="text-xs text-muted-foreground">avail {node.quantity_available}</span>
        ) : null}
      </div>

      {/* children */}
      {open && hasKids && (
        <div>
          {kids.map((c: any, i: number) => (
            <GenealogyNode
              key={`${c.batch_id || c.batch_number || c.txn_type || i}-${i}`}
              node={c}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function downloadPharmaBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export type PharmaESignPayload = {
  password: string
  meaning: 'author' | 'reviewer' | 'approver'
  totp_code?: string
  notes?: string
}

/** Modal for Part 11 password re-auth + meaning-of-signature. */
export function PharmaESignDialog({
  open,
  title,
  description,
  defaultMeaning = 'approver',
  confirmLabel = 'Sign & continue',
  showNotes = false,
  notesLabel = 'Decision notes',
  notesRequired = false,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  description?: string
  defaultMeaning?: 'author' | 'reviewer' | 'approver'
  confirmLabel?: string
  showNotes?: boolean
  notesLabel?: string
  notesRequired?: boolean
  onClose: () => void
  onConfirm: (payload: PharmaESignPayload) => Promise<void> | void
}) {
  const [password, setPassword] = useState('')
  const [meaning, setMeaning] = useState<'author' | 'reviewer' | 'approver'>(defaultMeaning)
  const [totp, setTotp] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setPassword('')
      setTotp('')
      setNotes('')
      setMeaning(defaultMeaning)
      setError('')
      setBusy(false)
    }
  }, [open, defaultMeaning])

  if (!open) return null

  const submit = async () => {
    if (!password.trim()) {
      setError('Password is required to sign')
      return
    }
    if (notesRequired && !notes.trim()) {
      setError(`${notesLabel} required`)
      return
    }
    setBusy(true)
    setError('')
    try {
      await onConfirm({
        password,
        meaning,
        totp_code: totp.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Signature failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-lg">
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Meaning of signature</label>
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={meaning}
              onChange={(e) => setMeaning(e.target.value as typeof meaning)}
            >
              <option value="author">Author</option>
              <option value="reviewer">Reviewer</option>
              <option value="approver">Approver</option>
            </select>
          </div>
          {showNotes ? (
            <div>
              <label className="text-xs font-medium text-muted-foreground">{notesLabel}</label>
              <textarea
                className="mt-1 min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional unless required"
              />
            </div>
          ) : null}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Password (re-authenticate)</label>
            <input
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">TOTP (if 2FA enabled)</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
              placeholder="Optional"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-input px-3 py-1.5 text-sm"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            onClick={submit}
            disabled={busy}
          >
            {busy ? 'Signing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Lightweight destructive-action confirm dialog.
 * Usage: maintain `confirm` state as `{ open, title, description, onConfirm } | null`.
 */
export function PharmaConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => { onConfirm(); onClose() }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
