/**
 * LineDetailPanel — per-line item detail with inline-editable tabs.
 *
 * Tabs (all in sync between display, edit, and the Create modal draft):
 *   Overview          item info, quantity ladder, rejection
 *   Pricing           list/net/discount/tax, charges & discounts
 *   Delivery schedule commitment rows (requested / promised date+qty)
 *   Warehouse & stock warehouse, storage area, batch, serial numbers
 *   Cost allocation   cost centre, profit centre
 *   Notes             line notes
 *   History           field-level change log
 */
import { useState } from 'react'
import { toast } from 'sonner'
import {
  Package, Tag, Calendar, Warehouse, BarChart3, FileText, History,
  Pencil, Check, X, Plus, Trash2, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type { Order, OrderLine, OrderLineSchedule } from '@/types'
import {
  useUpdateOrderLine,
  useDeleteOrderLine,
  useAddLineSchedule,
  useUpdateLineSchedule,
  useDeleteLineSchedule,
  useLineHistory,
} from '@/hooks/useVendor'

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',  label: 'Overview',           icon: Package },
  { id: 'pricing',   label: 'Pricing',             icon: Tag },
  { id: 'schedule',  label: 'Delivery schedule',   icon: Calendar },
  { id: 'warehouse', label: 'Warehouse & stock',   icon: Warehouse },
  { id: 'cost',      label: 'Cost allocation',     icon: BarChart3 },
  { id: 'notes',     label: 'Notes',               icon: FileText },
  { id: 'history',   label: 'History',             icon: History },
] as const

type TabId = typeof TABS[number]['id']

const QTY_BADGE = 'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium'

const LINE_TYPE_LABELS: Record<string, string> = {
  standard:       'Standard',
  free_of_charge: 'Sample / Free',
  return:         'Return',
  text_line:      'Text line',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isLocked(line: OrderLine): boolean {
  return (line.shipped_qty ?? 0) > 0 || (line.invoiced_qty ?? 0) > 0
}

function isTerminalOrder(order: Order): boolean {
  return ['delivered', 'cancelled', 'refunded', 'returned', 'exchanged',
    'return_requested', 'exchange_requested'].includes(order.status)
}

// ── Small field component for display/edit toggle ─────────────────────────────

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value ?? <span className="text-muted-foreground">—</span>}</p>
    </div>
  )
}

// ── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  line,
  orderId,
  editable,
}: {
  line: OrderLine
  orderId: string
  editable: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    item_name: line.item_name,
    item_sku: line.item_sku ?? '',
    line_type: line.line_type,
    rejection_reason: line.rejection_reason ?? '',
  })
  const update = useUpdateOrderLine(orderId)

  const save = () => {
    update.mutate(
      { lineId: line.id, data: {
        item_name: draft.item_name.trim() || undefined,
        item_sku: draft.item_sku.trim() || undefined,
        line_type: draft.line_type,
        rejection_reason: draft.rejection_reason.trim() || undefined,
      }},
      {
        onSuccess: () => { setEditing(false); toast.success('Line updated') },
      },
    )
  }

  const hasOpen = (line.ordered_qty ?? 0) - (line.shipped_qty ?? 0) - (line.rejected_qty ?? 0) > 0

  return (
    <div className="space-y-4">
      {editable && (
        <div className="flex justify-end">
          {editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setEditing(false)} disabled={update.isPending}>
                <X className="h-3 w-3" /> Cancel
              </Button>
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={save} disabled={update.isPending}>
                {update.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => setEditing(true)}>
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {editing ? (
          <>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Item name</Label>
              <Input className="h-8 text-sm" value={draft.item_name} onChange={(e) => setDraft((p) => ({ ...p, item_name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">SKU</Label>
              <Input className="h-8 text-sm" value={draft.item_sku} onChange={(e) => setDraft((p) => ({ ...p, item_sku: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Line type</Label>
              <select
                className="w-full h-8 rounded-md border border-border bg-background px-2 text-sm"
                value={draft.line_type}
                onChange={(e) => setDraft((p) => ({ ...p, line_type: e.target.value }))}
              >
                {Object.entries(LINE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Rejection reason</Label>
              <Input className="h-8 text-sm" value={draft.rejection_reason} onChange={(e) => setDraft((p) => ({ ...p, rejection_reason: e.target.value }))} placeholder="Only if this line was rejected" />
            </div>
          </>
        ) : (
          <>
            <Field label="Item name" value={line.item_name} />
            <Field label="SKU" value={line.item_sku} />
            <Field label="Type" value={LINE_TYPE_LABELS[line.line_type] ?? line.line_type} />
            <Field label="Item category" value={line.item_type === 'service' ? 'Service' : 'Product'} />
          </>
        )}
      </div>

      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Quantity</p>
        <div className="flex flex-wrap gap-1.5">
          <span className={cn(QTY_BADGE, 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300')}>
            Ordered {line.ordered_qty} {line.unit_of_measure}
          </span>
          {(line.committed_qty ?? 0) > 0 && (
            <span className={cn(QTY_BADGE, 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300')}>
              Promised {line.committed_qty}
            </span>
          )}
          {(line.shipped_qty ?? 0) > 0 && (
            <span className={cn(QTY_BADGE, 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300')}>
              Dispatched {line.shipped_qty}
            </span>
          )}
          {(line.invoiced_qty ?? 0) > 0 && (
            <span className={cn(QTY_BADGE, 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300')}>
              Invoiced {line.invoiced_qty}
            </span>
          )}
          {(line.returned_qty ?? 0) > 0 && (
            <span className={cn(QTY_BADGE, 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300')}>
              Returned {line.returned_qty}
            </span>
          )}
          {(line.rejected_qty ?? 0) > 0 && (
            <span className={cn(QTY_BADGE, 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300')}>
              Rejected {line.rejected_qty}
            </span>
          )}
          {hasOpen && (
            <span className={cn(QTY_BADGE, 'bg-muted text-muted-foreground')}>
              Open {(line.ordered_qty ?? 0) - (line.shipped_qty ?? 0) - (line.rejected_qty ?? 0)}
            </span>
          )}
        </div>
      </div>

      {line.rejection_reason && !editing && (
        <p className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-2.5 py-1.5">
          Rejection: {line.rejection_reason}
        </p>
      )}
    </div>
  )
}

// ── Pricing tab ───────────────────────────────────────────────────────────────

function PricingTab({ line, orderId, editable }: { line: OrderLine; orderId: string; editable: boolean }) {
  const [editing, setEditing] = useState(false)
  const locked = isLocked(line)
  const [draft, setDraft] = useState({
    list_price: String(line.list_price ?? 0),
    net_price: String(line.net_price ?? 0),
    discount_pct: String(line.discount_pct ?? 0),
    tax_rate: String(line.tax_rate ?? 0),
  })
  const update = useUpdateOrderLine(orderId)

  const save = () => {
    update.mutate(
      { lineId: line.id, data: {
        list_price: parseFloat(draft.list_price) || undefined,
        net_price: parseFloat(draft.net_price) || undefined,
        discount_pct: parseFloat(draft.discount_pct) || undefined,
        tax_rate: parseFloat(draft.tax_rate) || undefined,
      }},
      { onSuccess: () => { setEditing(false); toast.success('Pricing updated') } },
    )
  }

  return (
    <div className="space-y-4">
      {editable && !locked && (
        <div className="flex justify-end">
          {editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setEditing(false)} disabled={update.isPending}>
                <X className="h-3 w-3" /> Cancel
              </Button>
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={save} disabled={update.isPending}>
                {update.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => setEditing(true)}>
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          )}
        </div>
      )}
      {locked && (
        <p className="text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 rounded px-2.5 py-1.5">
          Pricing is locked — this line has already been dispatched or invoiced.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {editing && !locked ? (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Catalogue price (per unit)</Label>
              <Input type="number" min={0} step="0.01" className="h-8 text-sm" value={draft.list_price} onChange={(e) => setDraft((p) => ({ ...p, list_price: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Net price (per unit, after discount)</Label>
              <Input type="number" min={0} step="0.01" className="h-8 text-sm" value={draft.net_price} onChange={(e) => setDraft((p) => ({ ...p, net_price: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Discount %</Label>
              <Input type="number" min={0} max={100} step="0.01" className="h-8 text-sm" value={draft.discount_pct} onChange={(e) => setDraft((p) => ({ ...p, discount_pct: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tax rate %</Label>
              <Input type="number" min={0} step="0.01" className="h-8 text-sm" value={draft.tax_rate} onChange={(e) => setDraft((p) => ({ ...p, tax_rate: e.target.value }))} />
            </div>
          </>
        ) : (
          <>
            <Field label="Catalogue price" value={formatCurrency(line.list_price ?? 0)} />
            <Field label="Net price (per unit)" value={formatCurrency(line.net_price ?? 0)} />
            <Field label="Discount" value={line.discount_pct > 0 ? `${line.discount_pct}% (${formatCurrency(line.discount_amount ?? 0)} each)` : '—'} />
            <Field label="Tax rate" value={line.tax_rate > 0 ? `${line.tax_rate}%` : '—'} />
          </>
        )}
      </div>
      <div className="border-t border-border/50 pt-2 space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground text-xs">
          <span>Tax</span><span>{formatCurrency(line.tax_amount ?? 0)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Line total</span><span>{formatCurrency(line.line_total ?? 0)}</span>
        </div>
        {line.price_rule_type && (
          <p className="text-[10px] text-muted-foreground pt-1">
            Price rule applied: <Badge className="text-[9px] px-1 py-0 bg-muted text-muted-foreground">{line.price_rule_type}</Badge>
          </p>
        )}
      </div>
    </div>
  )
}

// ── Delivery schedule tab ─────────────────────────────────────────────────────

const COMMITMENT_SOURCE_LABELS: Record<string, string> = {
  in_stock:       'In stock',
  purchase_order: 'On order',
  lead_time:      'Lead time',
  manual:         'Manual',
  none:           'Not set',
}

const SCHEDULE_STATUS_STYLE: Record<string, string> = {
  committed: 'text-emerald-700 dark:text-emerald-400',
  partial:   'text-amber-700 dark:text-amber-400',
  open:      'text-muted-foreground',
  shipped:   'text-blue-700 dark:text-blue-400',
  closed:    'text-muted-foreground line-through',
  cancelled: 'text-destructive line-through',
}

function ScheduleTab({ line, orderId, editable }: { line: OrderLine; orderId: string; editable: boolean }) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newRow, setNewRow] = useState({ requested_date: '', confirmed_date: '', requested_qty: '', confirmed_qty: '', commitment_source: 'manual' })
  const addSchedule = useAddLineSchedule(orderId)
  const updateSchedule = useUpdateLineSchedule(orderId)
  const deleteSchedule = useDeleteLineSchedule(orderId)
  const schedules = line.schedules ?? []

  const saveNew = () => {
    addSchedule.mutate(
      { lineId: line.id, data: {
        requested_date: newRow.requested_date || undefined,
        confirmed_date: newRow.confirmed_date || undefined,
        requested_qty: parseFloat(newRow.requested_qty) || 0,
        confirmed_qty: parseFloat(newRow.confirmed_qty) || 0,
        commitment_source: newRow.commitment_source,
      }},
      { onSuccess: () => { setAdding(false); setNewRow({ requested_date: '', confirmed_date: '', requested_qty: '', confirmed_qty: '', commitment_source: 'manual' }); toast.success('Schedule added') } },
    )
  }

  return (
    <div className="space-y-3">
      {schedules.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground py-2 text-center">No delivery schedule commitments yet.</p>
      )}
      {schedules.map((s) => {
        const isEdit = editingId === s.id
        const [editDraft, setEditDraft] = useState<Record<string, string>>({
          confirmed_date: s.confirmed_date ?? '',
          confirmed_qty: String(s.confirmed_qty ?? 0),
          commitment_source: s.commitment_source ?? 'manual',
          status: s.status,
        })
        return (
          <div key={s.id} className="rounded-lg border border-border/60 px-3 py-2.5 space-y-2">
            {isEdit ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Promised date</Label>
                  <Input type="date" className="h-7 text-xs" value={editDraft.confirmed_date} onChange={(e) => setEditDraft((p) => ({ ...p, confirmed_date: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Promised qty</Label>
                  <Input type="number" min={0} className="h-7 text-xs" value={editDraft.confirmed_qty} onChange={(e) => setEditDraft((p) => ({ ...p, confirmed_qty: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Source</Label>
                  <select className="w-full h-7 rounded-md border border-border bg-background px-2 text-xs" value={editDraft.commitment_source} onChange={(e) => setEditDraft((p) => ({ ...p, commitment_source: e.target.value }))}>
                    {Object.entries(COMMITMENT_SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <select className="w-full h-7 rounded-md border border-border bg-background px-2 text-xs" value={editDraft.status} onChange={(e) => setEditDraft((p) => ({ ...p, status: e.target.value }))}>
                    {['open','committed','partial','shipped','closed','cancelled'].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="col-span-2 flex justify-end gap-2">
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setEditingId(null)}>Cancel</Button>
                  <Button size="sm" className="h-6 text-xs px-2" disabled={updateSchedule.isPending}
                    onClick={() => updateSchedule.mutate(
                      { lineId: line.id, scheduleId: s.id, data: { confirmed_date: editDraft.confirmed_date || undefined, confirmed_qty: parseFloat(editDraft.confirmed_qty) || 0, commitment_source: editDraft.commitment_source, status: editDraft.status } },
                      { onSuccess: () => { setEditingId(null); toast.success('Schedule updated') } },
                    )}>
                    {updateSchedule.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-[11px] font-medium capitalize', SCHEDULE_STATUS_STYLE[s.status] ?? 'text-muted-foreground')}>{s.status}</span>
                    <span className="text-[11px] text-muted-foreground">{COMMITMENT_SOURCE_LABELS[s.commitment_source] ?? s.commitment_source}</span>
                  </div>
                  <div className="flex gap-3 text-[11px] text-muted-foreground flex-wrap">
                    {s.requested_date && <span>Requested: {formatDate(s.requested_date)}</span>}
                    {s.confirmed_date && <span>Promised: {formatDate(s.confirmed_date)}</span>}
                    <span>Requested qty: {s.requested_qty}</span>
                    {(s.confirmed_qty ?? 0) > 0 && <span>Promised qty: {s.confirmed_qty}</span>}
                    {(s.shipped_qty ?? 0) > 0 && <span>Dispatched qty: {s.shipped_qty}</span>}
                  </div>
                </div>
                {editable && (
                  <div className="flex gap-1 shrink-0">
                    <button className="p-1 text-muted-foreground hover:text-foreground rounded" onClick={() => setEditingId(s.id)}><Pencil className="h-3.5 w-3.5" /></button>
                    <button className="p-1 text-muted-foreground hover:text-destructive rounded" disabled={deleteSchedule.isPending}
                      onClick={() => deleteSchedule.mutate({ lineId: line.id, scheduleId: s.id }, { onSuccess: () => toast.success('Schedule removed') })}>
                      {deleteSchedule.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {editable && (
        adding ? (
          <div className="rounded-lg border border-primary/30 bg-muted/20 px-3 py-2.5 space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground">Add commitment</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Requested date</Label>
                <Input type="date" className="h-7 text-xs" value={newRow.requested_date} onChange={(e) => setNewRow((p) => ({ ...p, requested_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Promised date</Label>
                <Input type="date" className="h-7 text-xs" value={newRow.confirmed_date} onChange={(e) => setNewRow((p) => ({ ...p, confirmed_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Requested qty</Label>
                <Input type="number" min={0} className="h-7 text-xs" value={newRow.requested_qty} onChange={(e) => setNewRow((p) => ({ ...p, requested_qty: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Promised qty</Label>
                <Input type="number" min={0} className="h-7 text-xs" value={newRow.confirmed_qty} onChange={(e) => setNewRow((p) => ({ ...p, confirmed_qty: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Availability source</Label>
                <select className="w-full h-7 rounded-md border border-border bg-background px-2 text-xs" value={newRow.commitment_source} onChange={(e) => setNewRow((p) => ({ ...p, commitment_source: e.target.value }))}>
                  {Object.entries(COMMITMENT_SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setAdding(false)}>Cancel</Button>
              <Button size="sm" className="h-6 text-xs px-2" disabled={addSchedule.isPending} onClick={saveNew}>
                {addSchedule.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs w-full" onClick={() => setAdding(true)}>
            <Plus className="h-3 w-3" /> Add commitment
          </Button>
        )
      )}
    </div>
  )
}

// ── Warehouse & stock tab ─────────────────────────────────────────────────────

function WarehouseTab({ line, orderId, editable }: { line: OrderLine; orderId: string; editable: boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    batch_number: line.batch_number ?? '',
    serial_numbers: (line.serial_numbers ?? []).join(', '),
  })
  const update = useUpdateOrderLine(orderId)

  const save = () => {
    update.mutate(
      { lineId: line.id, data: {
        batch_number: draft.batch_number.trim() || undefined,
        serial_numbers: draft.serial_numbers ? draft.serial_numbers.split(',').map((s) => s.trim()).filter(Boolean) : [],
      }},
      { onSuccess: () => { setEditing(false); toast.success('Warehouse info updated') } },
    )
  }

  return (
    <div className="space-y-4">
      {editable && (
        <div className="flex justify-end">
          {editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setEditing(false)} disabled={update.isPending}><X className="h-3 w-3" /> Cancel</Button>
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={save} disabled={update.isPending}>
                {update.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /> Edit</Button>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {editing ? (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Batch number</Label>
              <Input className="h-8 text-sm" value={draft.batch_number} onChange={(e) => setDraft((p) => ({ ...p, batch_number: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Serial numbers (comma-separated)</Label>
              <Input className="h-8 text-sm" value={draft.serial_numbers} onChange={(e) => setDraft((p) => ({ ...p, serial_numbers: e.target.value }))} placeholder="SN001, SN002, …" />
            </div>
          </>
        ) : (
          <>
            <Field label="Warehouse" value={line.plant_id} />
            <Field label="Storage area" value={line.storage_location_id} />
            <Field label="Batch" value={line.batch_number} />
            {(line.serial_numbers ?? []).length > 0 && (
              <div className="col-span-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Serial numbers</p>
                <div className="flex flex-wrap gap-1">
                  {line.serial_numbers!.map((sn) => (
                    <Badge key={sn} variant="secondary" className="text-[10px] font-mono">{sn}</Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Cost allocation tab ───────────────────────────────────────────────────────

function CostTab({ line, orderId, editable }: { line: OrderLine; orderId: string; editable: boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    cost_center_id: line.cost_center_id ?? '',
    profit_center_id: line.profit_center_id ?? '',
  })
  const update = useUpdateOrderLine(orderId)

  const save = () => {
    update.mutate(
      { lineId: line.id, data: {
        cost_center_id: draft.cost_center_id.trim() || undefined,
        profit_center_id: draft.profit_center_id.trim() || undefined,
      }},
      { onSuccess: () => { setEditing(false); toast.success('Cost allocation updated') } },
    )
  }

  return (
    <div className="space-y-4">
      {editable && (
        <div className="flex justify-end">
          {editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setEditing(false)} disabled={update.isPending}><X className="h-3 w-3" /> Cancel</Button>
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={save} disabled={update.isPending}>
                {update.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /> Edit</Button>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {editing ? (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Cost centre ID</Label>
              <Input className="h-8 text-sm" value={draft.cost_center_id} onChange={(e) => setDraft((p) => ({ ...p, cost_center_id: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Profit centre ID</Label>
              <Input className="h-8 text-sm" value={draft.profit_center_id} onChange={(e) => setDraft((p) => ({ ...p, profit_center_id: e.target.value }))} placeholder="Optional" />
            </div>
          </>
        ) : (
          <>
            <Field label="Cost centre" value={line.cost_center_id} />
            <Field label="Profit centre" value={line.profit_center_id} />
          </>
        )}
      </div>
    </div>
  )
}

// ── Notes tab ─────────────────────────────────────────────────────────────────

function NotesTab({ line, orderId, editable }: { line: OrderLine; orderId: string; editable: boolean }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(line.line_notes ?? '')
  const update = useUpdateOrderLine(orderId)

  const save = () => {
    update.mutate(
      { lineId: line.id, data: { line_notes: text.trim() || undefined } },
      { onSuccess: () => { setEditing(false); toast.success('Notes saved') } },
    )
  }

  return (
    <div className="space-y-3">
      {editable && (
        <div className="flex justify-end">
          {editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setEditing(false)} disabled={update.isPending}><X className="h-3 w-3" /> Cancel</Button>
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={save} disabled={update.isPending}>
                {update.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /> Edit</Button>
          )}
        </div>
      )}
      {editing ? (
        <textarea
          rows={5}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Line-specific notes…"
        />
      ) : (
        line.line_notes
          ? <p className="text-sm text-foreground whitespace-pre-wrap">{line.line_notes}</p>
          : <p className="text-sm text-muted-foreground text-center py-4">No notes for this line.</p>
      )}
    </div>
  )
}

// ── History tab ───────────────────────────────────────────────────────────────

function HistoryTab({ orderId, lineId }: { orderId: string; lineId: string }) {
  const { data: rows = [], isLoading } = useLineHistory(orderId, lineId)

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  if (rows.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">No changes recorded yet.</p>

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="rounded-lg border border-border/50 px-3 py-2.5 text-[11px]">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-medium text-foreground capitalize">{r.field_name.replace(/_/g, ' ')}</span>
            <span className="text-muted-foreground">{r.timestamp ? new Date(r.timestamp).toLocaleString() : '—'}</span>
          </div>
          <div className="mt-1 flex gap-2 flex-wrap">
            <span className="text-muted-foreground line-through">{r.old_value ?? 'empty'}</span>
            <span>→</span>
            <span className="text-foreground">{r.new_value ?? 'empty'}</span>
          </div>
          {r.notes && <p className="mt-1 italic text-muted-foreground">{r.notes}</p>}
        </div>
      ))}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface LineDetailPanelProps {
  order: Order
  line: OrderLine
  onClose: () => void
}

export function LineDetailPanel({ order, line, onClose }: LineDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const orderId = order.id
  const editable = !isTerminalOrder(order)
  const deleteLineHook = useDeleteOrderLine(orderId)

  const handleDeleteLine = () => {
    if (!window.confirm('Remove this line item? This cannot be undone.')) return
    deleteLineHook.mutate(line.id, { onSuccess: () => { toast.success('Line removed'); onClose() } })
  }

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b bg-muted/20 shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Line {line.line_no}</p>
          <p className="text-sm font-semibold text-foreground truncate">{line.item_name}</p>
          {line.item_sku && <p className="text-[11px] text-muted-foreground">SKU: {line.item_sku}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {editable && !isLocked(line) && (
            <button
              className="p-1.5 text-muted-foreground hover:text-destructive rounded"
              onClick={handleDeleteLine}
              disabled={deleteLineHook.isPending}
              title="Remove line"
            >
              {deleteLineHook.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          )}
          <button className="p-1.5 text-muted-foreground hover:text-foreground rounded" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b shrink-0 scrollbar-none">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors',
              activeTab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {activeTab === 'overview' && <OverviewTab line={line} orderId={orderId} editable={editable} />}
        {activeTab === 'pricing' && <PricingTab line={line} orderId={orderId} editable={editable} />}
        {activeTab === 'schedule' && <ScheduleTab line={line} orderId={orderId} editable={editable} />}
        {activeTab === 'warehouse' && <WarehouseTab line={line} orderId={orderId} editable={editable} />}
        {activeTab === 'cost' && <CostTab line={line} orderId={orderId} editable={editable} />}
        {activeTab === 'notes' && <NotesTab line={line} orderId={orderId} editable={editable} />}
        {activeTab === 'history' && <HistoryTab orderId={orderId} lineId={line.id} />}
      </div>
    </div>
  )
}
