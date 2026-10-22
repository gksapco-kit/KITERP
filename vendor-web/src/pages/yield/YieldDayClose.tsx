import { useState } from 'react'
import { CalendarCheck, Loader2, Lock, RefreshCw, Unlock, AlertTriangle, Scissors } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { askConfirm } from '@/components/common/ConfirmProvider'
import { CuttingSheet } from '@/components/yield/CuttingSheet'
import { useYieldDay, useCloseYieldDay, useReopenYieldDay } from '@/hooks/useYield'
import { browserTzOffset, type YieldDayRow } from '@/api/yield'
import { formatQty, formatMoney } from '@/lib/yieldCalc'
import { cn } from '@/lib/utils'

const todayIso = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

function Line({ label, value, strong, tone, hint }: {
  label: string; value: string; strong?: boolean; tone?: 'warn' | 'good'; hint?: string
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-1', strong && 'border-t border-border pt-2 mt-1')}>
      <span className={cn('text-sm', strong ? 'font-semibold' : 'text-muted-foreground')}>
        {label}
        {hint && <span className="block text-[0.7rem] text-muted-foreground/80">{hint}</span>}
      </span>
      <span className={cn(
        'tabular-nums text-sm', strong && 'font-semibold',
        tone === 'warn' && 'text-amber-600', tone === 'good' && 'text-emerald-600',
      )}>{value}</span>
    </div>
  )
}

function ProductDay({ row, date }: { row: YieldDayRow; date: string }) {
  const uom = row.pool_uom || 'kg'
  const [physical, setPhysical] = useState('')
  const [rawCost, setRawCost] = useState(row.raw_cost_per_unit != null ? String(row.raw_cost_per_unit) : '')
  const [adjust, setAdjust] = useState(true)
  const close = useCloseYieldDay()
  const reopen = useReopenYieldDay(date)

  const physicalNum = physical === '' ? null : Number(physical)
  const variance = row.closed ? row.variance_qty : physicalNum != null ? row.closing_system_qty - physicalNum : null
  const varianceTone = variance != null && Math.abs(variance) > 0.0005 ? 'warn' : 'good'

  const submit = () => {
    if (physicalNum == null || physicalNum < 0) return
    close.mutate({
      product_id: row.product_id,
      business_date: date,
      closing_physical_qty: physicalNum,
      raw_cost_per_unit: rawCost === '' ? null : Number(rawCost),
      tz_offset: browserTzOffset(),
      adjust_stock: adjust,
    })
  }

  const handleReopen = async () => {
    if (!row.id) return
    if (await askConfirm('Reopen this day? The stock correction posted at close stays in place.')) reopen.mutate(row.id)
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            {row.product_name}
            {row.closed
              ? <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Closed</Badge>
              : <Badge variant="outline">Open</Badge>}
          </CardTitle>
          {row.category && <p className="text-xs text-muted-foreground">{row.category}</p>}
        </div>
        {row.closed && row.id && (
          <Button variant="ghost" size="sm" onClick={handleReopen} disabled={reopen.isPending}>
            <Unlock className="h-4 w-4 mr-1" /> Reopen
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!row.shared_stock && (
          <p className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Turn on product-level stock for this product (Price &amp; Variants → stock) so raw stock is counted in one balance.
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Raw stock ({uom})</h4>
            <Line label="Opening" value={formatQty(row.opening_qty, uom)} />
            <Line label="+ Purchased / received" value={formatQty(row.purchased_qty, uom)} />
            <Line label="− Raw cut for sales" value={formatQty(row.raw_cut_qty, uom)} />
            {row.returned_qty !== 0 && <Line label="+ Customer returns" value={formatQty(row.returned_qty, uom)} />}
            {row.wastage_qty !== 0 && <Line label="− Wastage / write-off" value={formatQty(row.wastage_qty, uom)} />}
            {Math.abs(row.other_qty) > 0.0005 && <Line label="± Other adjustments" value={formatQty(row.other_qty, uom)} />}
            <Line label="Closing (system)" value={formatQty(row.closing_system_qty, uom)} strong />
            {row.closed ? (
              <Line label="Closing (physical count)" value={formatQty(row.closing_physical_qty, uom)} />
            ) : (
              <label className="flex items-center justify-between gap-3 py-1">
                <span className="text-sm text-muted-foreground">Closing (physical count)</span>
                <Input
                  type="number" min="0" step="0.01" inputMode="decimal"
                  value={physical} onChange={(e) => setPhysical(e.target.value)}
                  placeholder="Weigh & enter" className="h-8 w-36 text-right"
                />
              </label>
            )}
            {variance != null && (
              <Line
                label="Variance (missing)"
                hint="System − physical. Positive = more meat left the shop than was sold."
                value={formatQty(variance, uom)}
                tone={varianceTone}
                strong
              />
            )}
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Sales &amp; yield</h4>
            <Line label="Output sold" value={formatQty(row.output_sold_qty, uom)} />
            <Line label="Cutting loss (bones, skin…)" hint="Raw cut − output sold" value={formatQty(row.cutting_loss_qty, uom)} />
            <Line label="Sales (before tax)" value={formatMoney(row.sales_amount)} strong />
            {row.closed ? (
              <Line label="Raw cost / unit" value={row.raw_cost_per_unit != null ? formatMoney(row.raw_cost_per_unit) : '—'} />
            ) : (
              <label className="flex items-center justify-between gap-3 py-1">
                <span className="text-sm text-muted-foreground">Raw cost per {uom}</span>
                <Input
                  type="number" min="0" step="0.01"
                  value={rawCost} onChange={(e) => setRawCost(e.target.value)}
                  placeholder="₹ per kg" className="h-8 w-36 text-right"
                />
              </label>
            )}
            <Line label="Cost of raw used" value={formatMoney(row.cogs_amount)} />
            <Line
              label="Gross margin"
              value={formatMoney(row.gross_margin)}
              tone={row.gross_margin < 0 ? 'warn' : 'good'}
              strong
            />
          </div>
        </div>

        {row.cuts.length > 0 && (
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Cut</th>
                  <th className="text-right px-3 py-2 font-medium">Sold</th>
                  <th className="text-right px-3 py-2 font-medium">Output</th>
                  <th className="text-right px-3 py-2 font-medium">Raw cut</th>
                  <th className="text-right px-3 py-2 font-medium">Factor set / actual</th>
                  <th className="text-right px-3 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {row.cuts.map((c) => {
                  const drift = c.set_factor && c.effective_factor ? c.effective_factor - c.set_factor : 0
                  return (
                    <tr key={c.variant_id ?? c.name} className="border-t border-border">
                      <td className="px-3 py-1.5">{c.cut || c.name}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {c.units_sold}{c.units_returned > 0 && <span className="text-muted-foreground"> (−{c.units_returned})</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatQty(c.output_qty, uom)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatQty(c.raw_qty, uom)}</td>
                      <td className={cn('px-3 py-1.5 text-right tabular-nums', Math.abs(drift) > 0.01 && 'text-amber-600')}>
                        {c.set_factor?.toFixed(2) ?? '—'} / {c.effective_factor?.toFixed(2) ?? '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatMoney(c.sales_amount)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!row.closed && row.shared_stock && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={adjust} onCheckedChange={setAdjust} />
              Correct system stock to the physical count (tomorrow opens at {physicalNum != null ? formatQty(physicalNum, uom) : 'the count'})
            </label>
            <Button onClick={submit} disabled={physicalNum == null || physicalNum < 0 || close.isPending}>
              {close.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Lock className="h-4 w-4 mr-1" />}
              Close day
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function YieldDayClosePage() {
  const [date, setDate] = useState(todayIso())
  const [showSheet, setShowSheet] = useState(false)
  const { data, isLoading, refetch, isFetching } = useYieldDay(date)
  const rows = data?.products ?? []

  const totals = rows.reduce(
    (t, r) => ({
      sales: t.sales + r.sales_amount,
      cogs: t.cogs + r.cogs_amount,
      raw: t.raw + r.raw_cut_qty - r.returned_qty,
      output: t.output + r.output_sold_qty,
    }),
    { sales: 0, cogs: 0, raw: 0, output: 0 },
  )

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarCheck className="h-6 w-6" /> Day Close — Cutting Yield
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Raw stock cut, output sold, cutting loss and the physical-count variance for every product sold after cutting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" />
          <Button variant="outline" size="sm" onClick={() => setShowSheet((s) => !s)}>
            <Scissors className="h-4 w-4 mr-1" /> Cutting sheet
          </Button>
          <Button variant="ghost" size="icon" onClick={() => refetch()} aria-label="Refresh">
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {showSheet && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Cutting sheet</CardTitle></CardHeader>
          <CardContent><CuttingSheet /></CardContent>
        </Card>
      )}

      {rows.length > 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['Sales (before tax)', formatMoney(totals.sales)],
            ['Cost of raw used', formatMoney(totals.cogs)],
            ['Gross margin', formatMoney(totals.sales - totals.cogs)],
            ['Raw cut → output', `${totals.raw.toFixed(2)} → ${totals.output.toFixed(2)}`],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-bold tabular-nums">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No products use cutting yield yet. Open a product's Yield &amp; Cutting tab and turn on "Sold after cutting".
          </CardContent>
        </Card>
      ) : (
        rows.map((r) => <ProductDay key={`${r.product_id}-${date}-${r.closed}`} row={r} date={date} />)
      )}
    </div>
  )
}
