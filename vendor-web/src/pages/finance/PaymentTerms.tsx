/**
 * Payment Terms — Finance master data
 *
 * Allows finance admins to create and manage reusable payment terms
 * (due date rules, payment stages, early-payment discounts) that are
 * referenced across procurement, sales, and AR/AP.
 */
import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  SelectRoot as Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CalendarClock, Plus, Trash2, Pencil, Eye, EyeOff, Percent, Info,
} from 'lucide-react'
import {
  usePaymentTerms,
  useCreatePaymentTerm,
  useUpdatePaymentTerm,
  useTogglePaymentTermActive,
  useDeletePaymentTerm,
  usePreviewPaymentTerm,
} from '@/hooks/useFinance'
import type { PaymentTerm, PaymentTermStage, PaymentTermDiscount, PaymentTermPreviewResult } from '@/api/finance'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STARTS_FROM_OPTIONS = [
  { value: 'invoice_date',      label: 'Invoice date' },
  { value: 'posting_date',      label: 'Posting date' },
  { value: 'received_date',     label: 'Received date' },
  { value: 'delivery_date',     label: 'Delivery date' },
  { value: 'goods_receipt_date', label: 'Goods receipt date' },
]

const USAGE_OPTIONS = [
  { value: 'both',    label: 'Buying & Selling' },
  { value: 'buying',  label: 'Buying only (Procurement)' },
  { value: 'selling', label: 'Selling only (Sales / AR)' },
]

const USAGE_COLOR: Record<string, string> = {
  both:    'bg-blue-100 text-blue-700',
  buying:  'bg-amber-100 text-amber-700',
  selling: 'bg-emerald-100 text-emerald-700',
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type StageForm = { label: string; share_pct: string; due_days: string; due_on_day: string }
type DiscountForm = { within_days: string; discount_pct: string }

interface TermForm {
  code: string
  name: string
  description: string
  usage: string
  starts_from: string
  start_offset_days: string
  start_on_day: string
  start_shift_months: string
  round_to_month_end: boolean
  grace_days: string
  is_default: boolean
  stages: StageForm[]
  discounts: DiscountForm[]
}

const BLANK_TERM: TermForm = {
  code: '', name: '', description: '', usage: 'both',
  starts_from: 'invoice_date', start_offset_days: '0',
  start_on_day: '', start_shift_months: '0',
  round_to_month_end: false, grace_days: '0', is_default: false,
  stages: [{ label: '', share_pct: '100', due_days: '30', due_on_day: '' }],
  discounts: [],
}

const BLANK_STAGE: StageForm = { label: '', share_pct: '', due_days: '0', due_on_day: '' }
const BLANK_DISC: DiscountForm = { within_days: '', discount_pct: '' }

const today = new Date().toISOString().slice(0, 10)

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pctTotal(stages: StageForm[]) {
  return stages.reduce((s, r) => s + Number(r.share_pct || 0), 0)
}

function termToForm(t: PaymentTerm): TermForm {
  return {
    code:               t.code,
    name:               t.name,
    description:        t.description ?? '',
    usage:              t.usage,
    starts_from:        t.starts_from,
    start_offset_days:  String(t.start_offset_days),
    start_on_day:       t.start_on_day != null ? String(t.start_on_day) : '',
    start_shift_months: String(t.start_shift_months),
    round_to_month_end: t.round_to_month_end,
    grace_days:         String(t.grace_days),
    is_default:         t.is_default,
    stages: t.stages.map(s => ({
      label:      s.label ?? '',
      share_pct:  String(s.share_pct),
      due_days:   String(s.due_days),
      due_on_day: s.due_on_day != null ? String(s.due_on_day) : '',
    })),
    discounts: t.discounts.map(d => ({
      within_days:  String(d.within_days),
      discount_pct: String(d.discount_pct),
    })),
  }
}

function formToPayload(f: TermForm) {
  return {
    code:               f.code.trim(),
    name:               f.name.trim(),
    description:        f.description.trim() || null,
    usage:              f.usage,
    starts_from:        f.starts_from,
    start_offset_days:  Number(f.start_offset_days) || 0,
    start_on_day:       f.start_on_day ? Number(f.start_on_day) : null,
    start_shift_months: Number(f.start_shift_months) || 0,
    round_to_month_end: f.round_to_month_end,
    grace_days:         Number(f.grace_days) || 0,
    is_default:         f.is_default,
    stages: f.stages.map((s, i) => ({
      sort_order: i + 1,
      label:      s.label.trim() || null,
      share_pct:  Number(s.share_pct),
      due_days:   Number(s.due_days) || 0,
      due_on_day: s.due_on_day ? Number(s.due_on_day) : null,
    })),
    discounts: f.discounts.map(d => ({
      within_days:  Number(d.within_days),
      discount_pct: Number(d.discount_pct),
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage editor
// ─────────────────────────────────────────────────────────────────────────────

function StagesEditor({
  stages, onChange,
}: { stages: StageForm[]; onChange: (s: StageForm[]) => void }) {
  const total = pctTotal(stages)
  const invalid = Math.abs(total - 100) > 0.01 && stages.length > 0

  const update = (i: number, f: Partial<StageForm>) =>
    onChange(stages.map((s, idx) => (idx === i ? { ...s, ...f } : s)))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Payment Stages
        </Label>
        <div className="flex items-center gap-2">
          {stages.length > 0 && (
            <span className={`text-xs font-medium ${invalid ? 'text-red-500' : 'text-emerald-600'}`}>
              {total.toFixed(2)}% total
            </span>
          )}
          <Button size="sm" variant="outline" onClick={() => onChange([...stages, { ...BLANK_STAGE }])}>
            <Plus className="h-3 w-3 mr-1" /> Add Stage
          </Button>
        </div>
      </div>

      {invalid && (
        <p className="text-xs text-red-500">Stage shares must add up to exactly 100%.</p>
      )}

      {stages.map((s, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 items-end sm:grid-cols-[1fr_80px_70px_70px_28px]">
          <div className="col-span-2 space-y-1 sm:col-span-1">
            {i === 0 && <Label className="text-xs text-muted-foreground">Label (optional)</Label>}
            <Input
              placeholder="e.g. Advance, On delivery"
              value={s.label}
              onChange={e => update(i, { label: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            {i === 0 && <Label className="text-xs text-muted-foreground">Share %</Label>}
            <Input
              type="number" min={0} max={100} step={0.01}
              value={s.share_pct}
              onChange={e => update(i, { share_pct: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            {i === 0 && <Label className="text-xs text-muted-foreground">Due days</Label>}
            <Input
              type="number" min={0}
              value={s.due_days}
              onChange={e => update(i, { due_days: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            {i === 0 && <Label className="text-xs text-muted-foreground">Day of month</Label>}
            <Input
              type="number" min={1} max={31}
              placeholder="—"
              value={s.due_on_day}
              onChange={e => update(i, { due_on_day: e.target.value })}
            />
          </div>
          <Button
            size="icon" variant="ghost"
            className="h-8 w-8 justify-self-end text-destructive self-end"
            disabled={stages.length <= 1}
            onClick={() => onChange(stages.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Discount editor
// ─────────────────────────────────────────────────────────────────────────────

function DiscountsEditor({
  discounts, onChange,
}: { discounts: DiscountForm[]; onChange: (d: DiscountForm[]) => void }) {
  const update = (i: number, f: Partial<DiscountForm>) =>
    onChange(discounts.map((d, idx) => (idx === i ? { ...d, ...f } : d)))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Early Payment Discounts
        </Label>
        <Button size="sm" variant="outline" onClick={() => onChange([...discounts, { ...BLANK_DISC }])}>
          <Plus className="h-3 w-3 mr-1" /> Add Discount
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Offer a percentage reduction if payment arrives within N days of the start date.
      </p>

      {discounts.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No early payment discounts.</p>
      )}

      {discounts.map((d, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_28px] gap-2 items-end">
          <div className="space-y-1">
            {i === 0 && <Label className="text-xs text-muted-foreground">Pay within (days)</Label>}
            <Input
              type="number" min={1}
              placeholder="e.g. 10"
              value={d.within_days}
              onChange={e => update(i, { within_days: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            {i === 0 && <Label className="text-xs text-muted-foreground">Discount %</Label>}
            <Input
              type="number" min={0} max={100} step={0.01}
              placeholder="e.g. 2"
              value={d.discount_pct}
              onChange={e => update(i, { discount_pct: e.target.value })}
            />
          </div>
          <Button
            size="icon" variant="ghost"
            className="h-8 w-8 text-destructive self-end"
            onClick={() => onChange(discounts.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Live preview panel
// ─────────────────────────────────────────────────────────────────────────────

function PreviewPanel({ termId }: { termId: string }) {
  const previewMut = usePreviewPaymentTerm()
  const [amount, setAmount] = useState('10000')
  const [invDate, setInvDate] = useState(today)
  const [result, setResult] = useState<PaymentTermPreviewResult | null>(null)

  const run = () =>
    previewMut.mutate(
      { id: termId, data: { amount: Number(amount), invoice_date: invDate } },
      { onSuccess: setResult },
    )

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Live Preview
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Invoice amount</Label>
          <Input value={amount} type="number" onChange={e => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Invoice date</Label>
          <Input value={invDate} type="date" onChange={e => setInvDate(e.target.value)} />
        </div>
      </div>
      <Button size="sm" variant="secondary" onClick={run} disabled={previewMut.isPending}>
        Calculate
      </Button>

      {result && (
        <div className="space-y-2 text-sm">
          <p className="font-medium text-muted-foreground">{result.summary}</p>
          <div className="space-y-1">
            {result.stages.map((s, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {s.label ?? `Stage ${s.sort_order}`} — {s.share_pct}%
                </span>
                <span className="font-mono font-medium">
                  {Number(s.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} &nbsp;due {s.due_date}
                </span>
              </div>
            ))}
          </div>
          {result.discounts.length > 0 && (
            <>
              <Separator />
              {result.discounts.map((d, i) => (
                <div key={i} className="flex justify-between text-xs text-emerald-600">
                  <span>Pay by {d.pay_by} → save {d.discount_pct}%</span>
                  <span className="font-mono">
                    Net {Number(d.net_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Term editor dialog
// ─────────────────────────────────────────────────────────────────────────────

function TermDialog({
  open, onClose, editing,
}: { open: boolean; onClose: () => void; editing: PaymentTerm | null }) {
  const [form, setForm] = useState<TermForm>(editing ? termToForm(editing) : BLANK_TERM)
  const [tab, setTab] = useState<'rules' | 'stages' | 'discounts' | 'preview'>('rules')
  const createMut = useCreatePaymentTerm()
  const updateMut = useUpdatePaymentTerm()

  const set = <K extends keyof TermForm>(k: K, v: TermForm[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const canSave = form.code.trim() && form.name.trim() && form.stages.length > 0 &&
    Math.abs(pctTotal(form.stages) - 100) <= 0.01

  const handleSave = async () => {
    const payload = formToPayload(form)
    if (editing) {
      await updateMut.mutateAsync({ id: editing.id, data: payload })
    } else {
      await createMut.mutateAsync(payload as Parameters<typeof createMut.mutateAsync>[0])
    }
    onClose()
  }

  const field = 'space-y-1'
  const labelCls = 'text-xs'
  const inputCls = 'h-8'

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl gap-3 overflow-hidden p-5">
        <DialogHeader className="static shrink-0 space-y-0 pr-8">
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-primary" />
            {editing ? 'Edit Payment Term' : 'New Payment Term'}
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={v => setTab(v as typeof tab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mb-0 h-8 w-fit shrink-0 gap-0.5">
            <TabsTrigger value="rules" className="h-6 px-3 text-xs">General</TabsTrigger>
            <TabsTrigger value="stages" className="h-6 px-3 text-xs">Stages</TabsTrigger>
            <TabsTrigger value="discounts" className="h-6 px-3 text-xs">Discounts</TabsTrigger>
            {editing && <TabsTrigger value="preview" className="h-6 px-3 text-xs">Preview</TabsTrigger>}
          </TabsList>

          {/* ── General tab ── */}
          <TabsContent value="rules" className="mt-3 space-y-2.5">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className={field}>
                <Label className={labelCls}>Code <span className="text-red-500">*</span></Label>
                <Input
                  className={inputCls}
                  placeholder="e.g. NET30, ADV50"
                  value={form.code}
                  onChange={e => set('code', e.target.value.toUpperCase())}
                />
              </div>
              <div className={field}>
                <Label className={labelCls}>Used for</Label>
                <Select value={form.usage} onValueChange={v => set('usage', v)}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {USAGE_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={field}>
                <Label className={labelCls}>Name <span className="text-red-500">*</span></Label>
                <Input
                  className={inputCls}
                  placeholder="e.g. Net 30 days"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                />
              </div>
              <div className={field}>
                <Label className={labelCls}>Description (optional)</Label>
                <Input
                  className={inputCls}
                  placeholder="Short note for this term"
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2.5 rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Due date clock
              </p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className={field}>
                  <Label className={labelCls}>Clock starts from</Label>
                  <Select value={form.starts_from} onValueChange={v => set('starts_from', v)}>
                    <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STARTS_FROM_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={field}>
                  <Label className={labelCls}>Offset (days after anchor)</Label>
                  <Input
                    className={inputCls}
                    type="number" min={0}
                    value={form.start_offset_days}
                    onChange={e => set('start_offset_days', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <div className={field}>
                  <Label className={labelCls}>Fix start to day</Label>
                  <Input
                    className={inputCls}
                    type="number" min={1} max={31}
                    placeholder="15 (31=month end)"
                    value={form.start_on_day}
                    onChange={e => set('start_on_day', e.target.value)}
                  />
                </div>
                <div className={field}>
                  <Label className={labelCls}>Shift months forward</Label>
                  <Input
                    className={inputCls}
                    type="number" min={0}
                    value={form.start_shift_months}
                    onChange={e => set('start_shift_months', e.target.value)}
                  />
                </div>
                <div className={field}>
                  <Label className={labelCls}>Grace days</Label>
                  <Input
                    className={inputCls}
                    type="number" min={0}
                    value={form.grace_days}
                    onChange={e => set('grace_days', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id="round-month-end"
                    checked={form.round_to_month_end}
                    onCheckedChange={v => set('round_to_month_end', v)}
                  />
                  <Label htmlFor="round-month-end" className="cursor-pointer text-xs">
                    Round due date to month end
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="is-default"
                    checked={form.is_default}
                    onCheckedChange={v => set('is_default', v)}
                  />
                  <Label htmlFor="is-default" className="cursor-pointer text-xs">
                    Set as default
                  </Label>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Stages tab ── */}
          <TabsContent value="stages" className="mt-3 min-h-0 overflow-y-auto">
            <StagesEditor stages={form.stages} onChange={v => set('stages', v)} />
          </TabsContent>

          {/* ── Discounts tab ── */}
          <TabsContent value="discounts" className="mt-3 min-h-0 overflow-y-auto">
            <DiscountsEditor discounts={form.discounts} onChange={v => set('discounts', v)} />
          </TabsContent>

          {/* ── Preview tab ── */}
          {editing && (
            <TabsContent value="preview" className="mt-3 min-h-0 overflow-y-auto">
              <PreviewPanel termId={editing.id} />
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter className="static shrink-0 gap-2 pt-3 sm:space-x-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || createMut.isPending || updateMut.isPending}>
            {editing ? 'Save changes' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function PaymentTerms() {
  const { data: terms = [], isLoading } = usePaymentTerms({ active_only: false })
  const toggleMut  = useTogglePaymentTermActive()
  const deleteMut  = useDeletePaymentTerm()

  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<PaymentTerm | null>(null)

  const openNew  = () => { setEditing(null); setShowDialog(true) }
  const openEdit = (t: PaymentTerm) => { setEditing(t); setShowDialog(true) }
  const close    = () => setShowDialog(false)

  const summariseTerm = (t: PaymentTerm) => {
    if (!t.stages.length) return '—'
    if (t.stages.length === 1) {
      const s = t.stages[0]
      const disc = t.discounts[0]
      if (disc) return `${disc.discount_pct}% within ${disc.within_days} d / Net ${s.due_days} days`
      return `Net ${s.due_days} days`
    }
    return t.stages.map(s => `${s.share_pct}%`).join(' + ')
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-primary" />
            Payment Terms
          </h1>
          <p className="text-muted-foreground mt-1 max-w-xl">
            Define reusable payment rules — due date schedules, multi-stage splits, and
            early-payment discounts — that procurement, sales, and AR/AP can reference.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Payment Term
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : terms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <CalendarClock className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="font-medium">No payment terms yet</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Create your first payment term to start driving due dates and early-payment
              discounts consistently across all documents.
            </p>
            <Button onClick={openNew} className="mt-2">
              <Plus className="h-4 w-4 mr-1.5" />
              Create Payment Term
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['Code', 'Name', 'Summary', 'Used for', 'Status', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {terms.map(t => (
                <tr
                  key={t.id}
                  className={`border-t transition-colors cursor-pointer ${t.is_active ? 'hover:bg-muted/30' : 'opacity-50 hover:bg-muted/20'}`}
                  onClick={() => openEdit(t)}
                >
                  <td className="px-3 py-2.5 font-mono font-semibold">{t.code}</td>
                  <td className="px-3 py-2.5">
                    {t.name}
                    {t.is_default && (
                      <Badge variant="outline" className="ml-2 text-[10px] py-0 h-4">default</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{summariseTerm(t)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${USAGE_COLOR[t.usage] ?? ''}`}>
                      {USAGE_OPTIONS.find(o => o.value === t.usage)?.label ?? t.usage}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={t.is_active ? 'default' : 'secondary'}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7"
                        title={t.is_active ? 'Deactivate' : 'Activate'}
                        onClick={() => toggleMut.mutate(t.id)}
                      >
                        {t.is_active
                          ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                          : <Eye className="h-3.5 w-3.5 text-emerald-600" />}
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7"
                        title="Edit"
                        onClick={() => openEdit(t)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7"
                        title="Delete"
                        onClick={() => { if (confirm(`Delete "${t.name}"?`)) deleteMut.mutate(t.id) }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showDialog && (
        <TermDialog open={showDialog} onClose={close} editing={editing} />
      )}
    </div>
  )
}
