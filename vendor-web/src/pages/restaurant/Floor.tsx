import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { UtensilsCrossed, Settings, ChefHat, Loader2 } from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import { Button } from '@/components/ui/button'

export default function RestaurantFloorPage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useQuery({
    queryKey: ['restaurant', 'tables'],
    queryFn: () => vendorApi.restaurantListTables(),
  })

  const tables = (data?.items ?? []).filter(t => t.is_active !== false)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-amber-600" /> Restaurant floor
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Tap a table to open POS with that table tagged — tickets appear on the kitchen board after checkout.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/restaurant/setup" className="gap-1"><Settings className="w-4 h-4" /> Table setup</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/restaurant/kitchen" className="gap-1"><ChefHat className="w-4 h-4" /> Kitchen board</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/pos">Retail POS</Link>
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 className="w-8 h-8 animate-spin" /></div>
      )}
      {error && (
        <p className="text-sm text-red-600">Could not load tables. Configure zones and tables first.</p>
      )}
      {!isLoading && !tables.length && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-gray-500 text-sm">
          No tables yet.&nbsp;
          <Link to="/restaurant/setup" className="text-violet-600 font-medium hover:underline">Add tables</Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tables.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => navigate(`/pos?table=${encodeURIComponent(t.id)}`)}
            className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-amber-300 hover:bg-amber-50/40 transition-colors"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {t.zone_name || 'Floor'}
            </p>
            <p className="text-lg font-bold text-gray-900 mt-1">{t.label}</p>
            <p className="text-xs text-gray-500 mt-2">{t.capacity} seats · Open POS</p>
          </button>
        ))}
      </div>
    </div>
  )
}
