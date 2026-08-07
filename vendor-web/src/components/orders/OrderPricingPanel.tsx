/**
 * OrderPricingPanel — Phase-7
 *
 * Shows the pricing breakdown for an order:
 *  • Per-line: list_price → rule discount → net_price
 *  • Header-level conditions (header discount, freight, surcharges)
 *  • Reprice button to re-run the pricing engine
 *  • Add/remove header conditions
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Tag, Plus, Trash2, Loader2, RefreshCw, X, ChevronDown, ChevronUp,
  TrendingDown, TrendingUp, Truck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn, formatCurrency } from '@/lib/utils'
import { vendorApi } from '@/api/vendor'
import type { Order, OrderPricingCondition } from '@/types'

interface Props {
  order: Order
  isTerminal: boolean
}

// ── Condition type metadata ───────────────────────────────────────────────────

const COND_META: Record<string, { label: string; icon: React.ReactNode; sign: number; cls: string }> = {
  header_discount: { label: 'Header Discount', icon: <TrendingDown className="h-3 w-3" />, sign: -1, cls: 'text-emerald-600 dark:text-emerald-400' },
  freight:         { label: 'Freight',          icon: <Truck className="h-3 w-3" />,        sign:  1, cls: 'text-amber-600 dark:text-amber-400' },
  surcharge:       { label: 'Surcharge',         icon: <TrendingUp className="h-3 w-3" />,   sign:  1, cls: 'text-destructive' },
  special:         { label: 'Special',           icon: <Tag className="h-3 w-3" />,          sign: -1, cls: 'text-blue-600 dark:text-blue-400' },
  tax_override:    { label: 'Tax Override',      icon: <Tag className="h-3 w-3" />,          sign:  1, cls: 'text-muted-foreground' },
}

// ── Add condition form ────────────────────────────────────────────────────────

function AddConditionModal({
  orderId,
  onClose,
}: {
  orderId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    condition_type: 'header_discount',
    description: '',
    calc_type: 'percent' as 'percent' | 'fixed',
    value: '',
    notes: '',
  })

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      vendorApi.addPricingCondition(orderId, {
        condition_type: form.condition_type,
        description: form.description,
        calc_type: form.calc_type,
        value: parseFloat(form.value || '0'),
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Pricing condition added')
      qc.invalidateQueries({ queryKey: ['order', orderId] })
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Could not add condition'
      toast.error(msg)
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Add Pricing Condition</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <Label className="text-xs">Condition Type</Label>
            <select
              value={form.condition_type}
              onChange={(e) => setForm((p) => ({ ...p, condition_type: e.target.value }))}
              className="w-full h-8 rounded-md border border-border bg-background px-2 text-sm mt-1"
            >
              {Object.entries(COND_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="e.g. 10% project discount approved by GM"
              className="h-8 text-sm mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Calculation Type</Label>
              <select
                value={form.calc_type}
                onChange={(e) => setForm((p) => ({ ...p, calc_type: e.target.value as 'percent' | 'fixed' }))}
                className="w-full h-8 rounded-md border border-border bg-background px-2 text-sm mt-1"
              >
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">{form.calc_type === 'percent' ? 'Percent (%)' : 'Amount'}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.value}
                onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
                className="h-8 text-sm mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="h-8 text-sm mt-1" />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button size="sm" onClick={() => mutate()} disabled={isPending || !form.description || !form.value}>
            {isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Condition row ────────────────────────────────────────────────────────────

function ConditionRow({
  cond,
  orderId,
  isTerminal,
}: {
  cond: OrderPricingCondition
  orderId: string
  isTerminal: boolean
}) {
  const qc = useQueryClient()
  const meta = COND_META[cond.condition_type] || COND_META.special
  const isNegative = meta.sign < 0

  const { mutate: remove, isPending } = useMutation({
    mutationFn: () => vendorApi.removePricingCondition(orderId, cond.id),
    onSuccess: () => {
      toast.success('Condition removed')
      qc.invalidateQueries({ queryKey: ['order', orderId] })
    },
    onError: () => toast.error('Could not remove condition'),
  })

  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className={cn('flex items-center gap-1 text-[11px]', meta.cls)}>
        {meta.icon}
        <span className="font-medium">{meta.label}</span>
      </span>
      <span className="flex-1 text-[12px] text-muted-foreground truncate">{cond.description}</span>
      <span className="text-[11px] text-muted-foreground">
        {cond.calc_type === 'percent' ? `${cond.value}%` : formatCurrency(cond.value)}
      </span>
      <span className={cn('text-[12px] font-semibold tabular-nums', meta.cls)}>
        {isNegative ? '−' : '+'}{formatCurrency(Math.abs(cond.condition_amount))}
      </span>
      {!isTerminal && (
        <button onClick={() => remove()} disabled={isPending} className="text-muted-foreground hover:text-destructive">
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function OrderPricingPanel({ order, isTerminal }: Props) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [linesExpanded, setLinesExpanded] = useState(false)

  const conditions = order.pricing_conditions ?? []
  const lines = order.order_lines ?? []

  const { mutate: reprice, isPending: repricing } = useMutation({
    mutationFn: () => vendorApi.repriceOrder(order.id),
    onSuccess: () => {
      toast.success('Order repriced')
      qc.invalidateQueries({ queryKey: ['order', order.id] })
    },
    onError: () => toast.error('Reprice failed'),
  })

  // Lines that had a price rule applied
  const pricedLines = lines.filter((l) => l.price_rule_id || (l.list_price && l.list_price !== l.unit_price))

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Pricing</span>
          {conditions.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{conditions.length} conditions</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isTerminal && (
            <>
              <Button
                size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground"
                onClick={() => reprice()} disabled={repricing}
              >
                {repricing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Reprice
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5" /> Add Condition
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Per-line rule summary */}
        {pricedLines.length > 0 && (
          <div>
            <button
              className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1"
              onClick={() => setLinesExpanded((v) => !v)}
            >
              Line Pricing Rules
              {linesExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {linesExpanded && (
              <div className="space-y-1 pl-1">
                {pricedLines.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 text-[11px]">
                    <span className="flex-1 truncate text-muted-foreground">{l.product_name || `Line ${l.line_no}`}</span>
                    {l.list_price && l.list_price !== l.unit_price ? (
                      <>
                        <span className="line-through text-muted-foreground">{formatCurrency(l.list_price)}</span>
                        <span className="font-medium">{formatCurrency(l.unit_price)}</span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          −{((1 - l.unit_price / l.list_price) * 100).toFixed(1)}%
                        </span>
                      </>
                    ) : (
                      <span>{formatCurrency(l.unit_price)}</span>
                    )}
                    {l.price_rule_type && (
                      <Badge className="text-[9px] px-1 py-0 bg-muted text-muted-foreground">{l.price_rule_type}</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Header conditions */}
        {conditions.length > 0 && (
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Header Conditions</p>
            <div className="divide-y divide-border/50">
              {conditions.map((c) => (
                <ConditionRow key={c.id} cond={c} orderId={order.id} isTerminal={isTerminal} />
              ))}
            </div>
          </div>
        )}

        {conditions.length === 0 && pricedLines.length === 0 && (
          <p className="text-xs text-muted-foreground py-1 text-center">No pricing rules or conditions applied.</p>
        )}

        {/* Totals summary */}
        <div className="border-t border-border/50 pt-2 space-y-0.5 text-[12px]">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span>
          </div>
          {order.discount_amount > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Discount</span><span>−{formatCurrency(order.discount_amount)}</span>
            </div>
          )}
          {order.shipping_amount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Shipping</span><span>+{formatCurrency(order.shipping_amount)}</span>
            </div>
          )}
          {order.tax_amount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span><span>+{formatCurrency(order.tax_amount)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-[13px] pt-0.5">
            <span>Total</span><span>{formatCurrency(order.total)}</span>
          </div>
        </div>
      </div>

      {showAdd && <AddConditionModal orderId={order.id} onClose={() => setShowAdd(false)} />}
    </div>
  )
}
