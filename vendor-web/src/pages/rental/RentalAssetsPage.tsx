import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSalesAreas } from '@/hooks/useVendor'
import { rentalApi } from './api'
import type { RentalAsset, RentalBooking } from './rentalConstants'
import RentalAssetsTab from './RentalAssetsTab'

export default function RentalAssetsPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const q = params.get('q') || ''
  const status = params.get('status') || ''
  const category = params.get('category') || ''

  const patch = (next: Record<string, string | null>) => {
    setParams((prev) => {
      const np = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === '') np.delete(k)
        else np.set(k, v)
      }
      return np
    }, { replace: true })
  }

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['rental-assets'],
    queryFn: () => rentalApi.listAssets(),
    staleTime: 30_000,
  })
  const { data: allBookings = [] } = useQuery({
    queryKey: ['rental-bookings', '__all__'],
    queryFn: () => rentalApi.listBookings(),
    staleTime: 20_000,
  })
  const { data: salesAreaData } = useSalesAreas({ is_active: true })

  const salesAreaLabelById = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of salesAreaData?.sales_areas ?? []) {
      const name = String(a.name || '').trim()
      const code = String(a.code || '').trim()
      const safeName = name && name.toLowerCase() !== 'null' ? name : ''
      let label = safeName || code || 'Sales area'
      if (safeName && code) label = `${safeName} (${code})`
      m.set(a.id, label)
    }
    return m
  }, [salesAreaData?.sales_areas])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Rental Assets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your rentable racks, equipment, vehicles, and storage units.
        </p>
      </div>

      <RentalAssetsTab
        assets={assets as RentalAsset[]}
        allBookings={allBookings as RentalBooking[]}
        loading={isLoading}
        salesAreaLabelById={salesAreaLabelById}
        q={q}
        onQChange={(v) => patch({ q: v || null })}
        status={status}
        onStatusChange={(v) => patch({ status: v || null })}
        category={category}
        onCategoryChange={(v) => patch({ category: v || null })}
        onCreate={() => navigate('/rental/assets/new')}
        onView={(a) => navigate(`/rental/assets/${a.id}`)}
        onEdit={(a) => navigate(`/rental/assets/${a.id}/edit`)}
      />
    </div>
  )
}
