import { BarChart3 } from 'lucide-react'
import { useVendorStore } from '@/stores/vendorStore'
import { ProductionAnalyticsDashboard } from '@/components/production/ProductionAnalyticsDashboard'

export default function ProductionAnalyticsPage() {
  const { selectedStore } = useVendorStore()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" /> Production Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Throughput, cost roll-ups, work center utilization, and delayed order trends.
        </p>
      </div>

      <ProductionAnalyticsDashboard storeId={selectedStore?.id} />
    </div>
  )
}
