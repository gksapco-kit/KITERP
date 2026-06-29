import { Loader2, IndianRupee } from 'lucide-react'
import { useServiceCostSummary } from '@/hooks/useVendor'

interface ServiceCostSummaryProps {
  serviceId: string
  currency?: string
}

export function ServiceCostSummary({ serviceId, currency = 'INR' }: ServiceCostSummaryProps) {
  const { data, isLoading } = useServiceCostSummary(serviceId)
  const sym = currency === 'INR' ? '₹' : currency

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Calculating cost…
      </div>
    )
  }

  if (!data || ((data.bom_items ?? 0) === 0 && (data.resources ?? 0) === 0)) return null

  const summary = data as {
    material_cost: number
    resource_cost: number
    total_cost: number
    selling_price?: number | null
    margin?: number | null
    margin_pct?: number | null
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5">
        <IndianRupee className="w-3.5 h-3.5" /> Service Cost Summary
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Material Cost</p>
          <p className="font-semibold">{sym}{summary.material_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Resource Cost</p>
          <p className="font-semibold">{sym}{summary.resource_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Cost</p>
          <p className="font-bold text-foreground">{sym}{summary.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        {summary.selling_price != null && (
          <div>
            <p className="text-xs text-muted-foreground">Margin</p>
            <p className={`font-semibold ${(summary.margin ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {sym}{(summary.margin ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              {summary.margin_pct != null && (
                <span className="text-xs font-normal text-muted-foreground ml-1">({summary.margin_pct.toFixed(1)}%)</span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
