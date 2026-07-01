import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar } from 'lucide-react'
import { useVendorStore } from '@/stores/vendorStore'
import { useProductionOrders, useProductionOrdersBootstrap } from '@/hooks/useProductionOrders'
import { ProductionScheduleGantt, type GanttOrder } from '@/components/production/ProductionScheduleGantt'

export default function ProductionSchedulePage() {
  const navigate = useNavigate()
  const { selectedStore } = useVendorStore()
  const storeId = selectedStore?.id
  useProductionOrdersBootstrap()

  const listParams = useMemo(() => (storeId ? { store_id: storeId } : {}), [storeId])
  const { data: ordersRaw = [], isLoading } = useProductionOrders(listParams)
  const orders = ordersRaw as unknown as GanttOrder[]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" /> Production Schedule
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gantt view of production orders by target date. Click any bar to open the order.
        </p>
      </div>

      {isLoading ? (
        <div className="bg-card rounded-2xl border border-border text-center py-16 text-muted-foreground">
          Loading schedule…
        </div>
      ) : (
        <ProductionScheduleGantt
          orders={orders}
          onSelectOrder={(id) => navigate(`/production/orders/${id}`)}
        />
      )}
    </div>
  )
}
