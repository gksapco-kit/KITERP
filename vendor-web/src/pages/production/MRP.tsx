import { useMemo, useState } from 'react'
import { Layers, Search, Factory, BarChart3 } from 'lucide-react'
import { cn, searchFieldInnerInputClassName, searchFieldShellClassName } from '@/lib/utils'
import { useVendorStore } from '@/stores/vendorStore'
import { useProductionOrders, useProductionOrdersBootstrap } from '@/hooks/useProductionOrders'
import { MRPReportModal } from '@/components/mrp/MRPReportModal'

interface POItem {
  product_id: string
  item_type: 'product' | 'service'
  name: string
  qty: number
}

interface ProductionOrderLite {
  id: string
  ref: string
  status: string
  store_id?: string | null
  items: POItem[]
  materials_reserved_at?: string | null
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  in_production: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  qc: 'bg-primary/10 text-primary',
  completed: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300',
  on_hold: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
}

export default function ProductionMRPPage() {
  const { selectedStore } = useVendorStore()
  const storeId = selectedStore?.id
  useProductionOrdersBootstrap()

  const listParams = useMemo(() => (storeId ? { store_id: storeId } : {}), [storeId])
  const { data: ordersRaw = [], isLoading } = useProductionOrders(listParams)
  const orders = ordersRaw as unknown as ProductionOrderLite[]

  const [search, setSearch] = useState('')
  const [mrpOrder, setMrpOrder] = useState<ProductionOrderLite | null>(null)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return orders
      .filter(o => o.status !== 'cancelled')
      .filter(o => !term || o.ref.toLowerCase().includes(term))
  }, [orders, search])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" /> Material Requirements (MRP)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Check BOM explosion, stock availability, and reserve materials for any production order.
        </p>
      </div>

      <div
        data-kiterp-search-field
        className={cn(searchFieldShellClassName, 'px-3 py-2 max-w-sm shadow-sm')}
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          data-kiterp-no-field-focus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by order ref…"
          className={cn(searchFieldInnerInputClassName, 'text-sm text-foreground placeholder:text-muted-foreground')}
        />
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading production orders…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Factory className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium">No production orders found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr className="text-xs font-medium text-muted-foreground uppercase">
                <th className="py-2 px-4 text-left">Order</th>
                <th className="py-2 px-3 text-left">Status</th>
                <th className="py-2 px-3 text-right">Items</th>
                <th className="py-2 px-3 text-center">Materials</th>
                <th className="py-2 px-3 w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(order => (
                <tr key={order.id} className="hover:bg-muted/30">
                  <td className="py-2.5 px-4 font-mono text-xs font-bold text-foreground">{order.ref}</td>
                  <td className="py-2.5 px-3">
                    <span className={cn('inline-flex text-xs font-medium px-2 py-0.5 rounded-full capitalize', STATUS_BADGE[order.status] || STATUS_BADGE.draft)}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">{order.items?.length ?? 0}</td>
                  <td className="py-2.5 px-3 text-center">
                    {order.materials_reserved_at ? (
                      <span className="text-xs font-medium text-green-700 dark:text-green-400">Reserved</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => setMrpOrder(order)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium border border-border rounded-lg px-2.5 py-1.5 bg-card hover:bg-accent transition-colors"
                    >
                      <BarChart3 className="w-3.5 h-3.5" /> View MRP
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {mrpOrder && (
        <MRPReportModal
          orderId={mrpOrder.id}
          orderType="production_order"
          orderRef={mrpOrder.ref}
          items={mrpOrder.items
            .filter(i => i.item_type === 'product' && i.product_id)
            .map(i => ({ product_id: i.product_id, qty: i.qty, name: i.name }))}
          storeId={mrpOrder.store_id}
          autoManaged={!!mrpOrder.materials_reserved_at}
          onClose={() => setMrpOrder(null)}
        />
      )}
    </div>
  )
}
