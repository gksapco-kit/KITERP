import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3, Loader2, RefreshCw, DollarSign, TrendingDown,
  Timer, Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type ReportTab = 'stock_value' | 'abc' | 'aging' | 'slow_movers' | 'fifo'

interface StockValueItem {
  product_id: string; product_name: string; sku: string | null
  category: string; quantity: number; cost_price: number; stock_value: number
}
interface CategoryGroup {
  category: string; items: StockValueItem[]
  total_value: number; total_qty: number
}
interface ABCItem {
  product_id: string; product_name: string; sku: string | null
  abc_class: 'A' | 'B' | 'C'; total_units_out: number
  movement_value: number; cumulative_pct: number
}
interface AgingItem {
  product_id: string; product_name: string; sku: string | null
  category: string; quantity_on_hand: number; stock_value: number
  last_moved: string | null; days_since_movement: number | null; aging_bucket: string
}
interface SlowMoverItem {
  product_id: string; product_name: string; sku: string | null
  category: string; quantity_on_hand: number; stock_value: number; reorder_point: number | null
}
interface FIFOItem {
  product_id: string; variant_id: string | null; product_name: string; sku: string | null
  category: string | null; remaining_qty: number; fifo_value: number
  min_unit_cost: number; max_unit_cost: number
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}
function fmtQty(n: number) {
  return new Intl.NumberFormat('en-IN').format(n)
}
const INR = '₹'

// ── Stock Value Tab ────────────────────────────────────────────────────────────

const DAYS_OPTIONS = [
  { value: 'category', label: 'By Category' },
  { value: 'all', label: 'All Products' },
]

function StockValueTab() {
  const [groupBy, setGroupBy] = useState('category')
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'report-stock-value', groupBy],
    queryFn: () => vendorApi.inventoryReportStockValue({ group_by: groupBy }),
  })
  const d = data ?? {}
  const groups: (CategoryGroup | StockValueItem)[] = d.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Select value={groupBy} onChange={setGroupBy} options={DAYS_OPTIONS} className="w-36" />
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total Inventory Value</p>
            <p className="text-2xl font-bold">{INR}{fmt(d.total_value ?? 0)}</p>
            <p className="text-xs text-muted-foreground">{fmtQty(d.total_skus ?? 0)} SKUs</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No products with cost price set</div>
      ) : groupBy === 'category' ? (
        <div className="space-y-3">
          {(groups as CategoryGroup[]).map((g) => {
            const pct = d.total_value > 0 ? (g.total_value / d.total_value * 100).toFixed(1) : '0'
            return (
              <Card key={g.category}>
                <CardHeader className="pb-2 pt-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{g.category}</CardTitle>
                    <div className="text-right">
                      <span className="text-base font-bold">{INR}{fmt(g.total_value)}</span>
                      <span className="ml-2 text-xs text-muted-foreground">({pct}%)</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <tbody>
                      {g.items.slice(0, 5).map((item) => (
                        <tr key={item.product_id} className="border-t hover:bg-muted/30">
                          <td className="px-3 py-1.5 font-medium">{item.product_name}</td>
                          <td className="px-3 py-1.5 text-muted-foreground font-mono">{item.sku}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{fmtQty(item.quantity)} units</td>
                          <td className="px-3 py-1.5 text-right font-semibold">{INR}{fmt(item.stock_value)}</td>
                        </tr>
                      ))}
                      {g.items.length > 5 && (
                        <tr className="border-t">
                          <td colSpan={4} className="px-3 py-1.5 text-muted-foreground text-center">
                            +{g.items.length - 5} more products
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/40">
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Product</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Category</th>
                <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Qty</th>
                <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Cost/unit</th>
                <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Value</th>
              </tr></thead>
              <tbody>
                {(groups as StockValueItem[]).map((item) => (
                  <tr key={item.product_id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{item.product_name}<div className="text-xs text-muted-foreground font-mono">{item.sku}</div></td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">{item.category}</td>
                    <td className="py-2 px-3 text-right font-mono">{fmtQty(item.quantity)}</td>
                    <td className="py-2 px-3 text-right font-mono">{INR}{fmt(item.cost_price)}</td>
                    <td className="py-2 px-3 text-right font-semibold">{INR}{fmt(item.stock_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── ABC Analysis Tab ──────────────────────────────────────────────────────────

const ABC_CFG = {
  A: { bg: 'bg-green-100 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-400', label: 'Class A' },
  B: { bg: 'bg-blue-100 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-400', label: 'Class B' },
  C: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Class C' },
} as const

const ABC_DAYS_OPTIONS = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
  { value: '365', label: '365 days' },
]

const ABC_CLASS_OPTIONS = [
  { value: 'all', label: 'All Classes' },
  { value: 'A', label: 'Class A' },
  { value: 'B', label: 'Class B' },
  { value: 'C', label: 'Class C' },
]

function ABCTab() {
  const [days, setDays] = useState('90')
  const [classFilter, setClassFilter] = useState('all')
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'report-abc', days],
    queryFn: () => vendorApi.inventoryReportABC({ days: parseInt(days, 10) }),
  })
  const d = data ?? {}
  const items: ABCItem[] = d.items ?? []
  const summary = d.summary ?? {}
  const visible = classFilter === 'all' ? items : items.filter((i) => i.abc_class === classFilter)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={days} onChange={setDays} options={ABC_DAYS_OPTIONS} className="w-28" />
        <Select value={classFilter} onChange={setClassFilter} options={ABC_CLASS_OPTIONS} className="w-28" />
        <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {/* Summary pills */}
      <div className="grid grid-cols-3 gap-3">
        {(['A', 'B', 'C'] as const).map((cls) => {
          const cfg = ABC_CFG[cls]
          const s = summary[cls] ?? {}
          return (
            <div key={cls} className={cn('rounded-lg border p-3', cfg.bg)}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className={cn('font-bold text-lg', cfg.text)}>{cls}</span>
                <span className="text-xs text-muted-foreground">{cfg.label}</span>
              </div>
              <p className="text-sm font-semibold">{s.count ?? 0} SKUs</p>
              <p className="text-xs text-muted-foreground">{INR}{fmt(s.value ?? 0)} movement value</p>
            </div>
          )
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/40">
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Product</th>
                  <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground">Class</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Units Out</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Movement Value</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Cumulative %</th>
                </tr></thead>
                <tbody>
                  {visible.map((item) => {
                    const cfg = ABC_CFG[item.abc_class]
                    return (
                      <tr key={item.product_id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-3">
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{item.sku}</div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={cn('font-bold text-sm px-2 py-0.5 rounded', cfg.bg, cfg.text)}>
                            {item.abc_class}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{fmtQty(item.total_units_out)}</td>
                        <td className="py-2 px-3 text-right font-mono">{INR}{fmt(item.movement_value)}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{item.cumulative_pct}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Stock Aging Tab ───────────────────────────────────────────────────────────

const AGING_BUCKETS: Record<string, { label: string; className: string }> = {
  never_moved: { label: 'Never Moved', className: 'text-red-600' },
  over_180d: { label: '> 180 days', className: 'text-orange-600' },
  '91_180d': { label: '91–180 days', className: 'text-amber-600' },
  '31_90d': { label: '31–90 days', className: 'text-blue-600' },
  '0_30d': { label: '0–30 days', className: 'text-green-600' },
}

const AGING_BUCKET_OPTIONS = [
  { value: 'all', label: 'All Buckets' },
  ...Object.entries(AGING_BUCKETS).map(([k, v]) => ({ value: k, label: v.label })),
]

function AgingTab() {
  const [bucketFilter, setBucketFilter] = useState('all')
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'report-stock-aging'],
    queryFn: () => vendorApi.inventoryReportStockAging(),
  })
  const d = data ?? {}
  const items: AgingItem[] = d.items ?? []
  const summary = d.summary ?? {}
  const visible = bucketFilter === 'all' ? items : items.filter((i) => i.aging_bucket === bucketFilter)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={bucketFilter} onChange={setBucketFilter} options={AGING_BUCKET_OPTIONS} className="w-44" />
        <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {/* Bucket summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {Object.entries(AGING_BUCKETS).map(([k, v]) => {
          const s = summary[k] ?? {}
          return (
            <button
              key={k}
              onClick={() => setBucketFilter(bucketFilter === k ? 'all' : k)}
              className={cn('rounded-lg border p-2.5 text-left hover:shadow-sm transition-all', bucketFilter === k && 'ring-2 ring-primary')}
            >
              <p className={cn('text-xs font-medium', v.className)}>{v.label}</p>
              <p className="text-lg font-bold">{s.count ?? 0}</p>
              <p className="text-xs text-muted-foreground">{INR}{fmt(s.stock_value ?? 0)}</p>
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/40">
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Product</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Category</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Qty On Hand</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Value</th>
                  <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground">Last Moved</th>
                  <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground">Days Idle</th>
                </tr></thead>
                <tbody>
                  {visible.map((item) => {
                    const bucketCfg = AGING_BUCKETS[item.aging_bucket]
                    return (
                      <tr key={item.product_id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-3"><div className="font-medium">{item.product_name}</div><div className="text-xs text-muted-foreground font-mono">{item.sku}</div></td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">{item.category}</td>
                        <td className="py-2 px-3 text-right font-mono">{fmtQty(item.quantity_on_hand)}</td>
                        <td className="py-2 px-3 text-right font-mono">{INR}{fmt(item.stock_value)}</td>
                        <td className="py-2 px-3 text-center text-xs text-muted-foreground">
                          {item.last_moved ? new Date(item.last_moved).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={cn('text-xs font-semibold', bucketCfg?.className)}>
                            {item.days_since_movement !== null ? `${item.days_since_movement}d` : 'Never'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Slow Movers Tab ────────────────────────────────────────────────────────────

const SLOW_DAYS_OPTIONS = [
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
]

function SlowMoversTab() {
  const [days, setDays] = useState('90')
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'report-slow-movers', days],
    queryFn: () => vendorApi.inventoryReportSlowMovers({ days: parseInt(days, 10) }),
  })
  const d = data ?? {}
  const items: SlowMoverItem[] = d.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">No movement in last</span>
          <Select value={days} onChange={setDays} options={SLOW_DAYS_OPTIONS} className="w-28" />
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
        {d.total > 0 && (
          <div className="text-right text-sm">
            <span className="text-orange-600 font-semibold">{d.total} products</span>
            <span className="text-muted-foreground ml-1">· {INR}{fmt(d.total_stock_value_at_risk ?? 0)} at risk</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No slow-moving products in the selected period</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/40">
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Product</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Category</th>
                <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Qty On Hand</th>
                <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Stock Value</th>
                <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Reorder Point</th>
              </tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.product_id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3"><div className="font-medium">{item.product_name}</div><div className="text-xs text-muted-foreground font-mono">{item.sku}</div></td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">{item.category}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-orange-600">{fmtQty(item.quantity_on_hand)}</td>
                    <td className="py-2 px-3 text-right font-mono">{INR}{fmt(item.stock_value)}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{item.reorder_point ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── FIFO Valuation Tab ─────────────────────────────────────────────────────────

function FIFOTab() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'report-fifo'],
    queryFn: () => vendorApi.inventoryReportFIFO(),
  })
  const d = data ?? {}
  const items: FIFOItem[] = d.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          FIFO (First-In, First-Out) inventory value based on cost layers created at stock receipt.
        </p>
        <div className="flex items-center gap-2">
          {d.total_fifo_value !== undefined && (
            <span className="font-semibold text-sm">
              Total FIFO Value: <span className="text-primary">{INR}{fmt(d.total_fifo_value)}</span>
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-8 text-center space-y-2">
          <Layers className="h-8 w-8 mx-auto text-muted-foreground opacity-40" />
          <p className="font-medium text-muted-foreground">No FIFO cost layers found</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            FIFO cost layers are created when stock is received with a unit cost.
            Create a layer manually via the API or receive a purchase order.
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/40">
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Product</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Category</th>
                <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Qty Remaining</th>
                <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Min Cost</th>
                <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Max Cost</th>
                <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">FIFO Value</th>
              </tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.product_id}-${item.variant_id ?? ''}`} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3"><div className="font-medium">{item.product_name}</div><div className="text-xs text-muted-foreground font-mono">{item.sku}</div></td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">{item.category ?? '—'}</td>
                    <td className="py-2 px-3 text-right font-mono">{fmtQty(item.remaining_qty)}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{INR}{fmt(item.min_unit_cost)}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{INR}{fmt(item.max_unit_cost)}</td>
                    <td className="py-2 px-3 text-right font-semibold">{INR}{fmt(item.fifo_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS: { key: ReportTab; label: string; icon: React.ElementType }[] = [
  { key: 'stock_value', label: 'Stock Value', icon: DollarSign },
  { key: 'abc', label: 'ABC Analysis', icon: BarChart3 },
  { key: 'aging', label: 'Stock Aging', icon: Timer },
  { key: 'slow_movers', label: 'Slow Movers', icon: TrendingDown },
  { key: 'fifo', label: 'FIFO Valuation', icon: Layers },
]

export default function InventoryReportsPage() {
  const [tab, setTab] = useState<ReportTab>('stock_value')

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          Inventory Reports & Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Stock value, ABC analysis, aging, and slow-mover intelligence
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'stock_value' && <StockValueTab />}
      {tab === 'abc' && <ABCTab />}
      {tab === 'aging' && <AgingTab />}
      {tab === 'slow_movers' && <SlowMoversTab />}
      {tab === 'fifo' && <FIFOTab />}
    </div>
  )
}
