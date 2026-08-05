import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSalesAreas } from '@/hooks/useVendor'
import { rentalApi } from './api'
import type { RentalAsset, RentalBooking } from './rentalConstants'
import RentalAssetsTab from './RentalAssetsTab'
import RentalAssetSheet from './RentalAssetSheet'

export default function RentalAssetsPage() {
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()

  const q = params.get('q') || ''
  const status = params.get('status') || ''
  const category = params.get('category') || ''
  const assetSheetParam = params.get('asset')
  const assetSheetOpen = !!assetSheetParam
  const assetSheetId = assetSheetParam && assetSheetParam !== 'new' ? assetSheetParam : null
  // When adding a child asset from a parent's hierarchy section, pre-fill parent_asset_id
  const initialParentId = params.get('parent') || null

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

  const salesAreaOptions = useMemo(
    () => (salesAreaData?.sales_areas ?? []).map((a) => {
      const name = String(a.name || '').trim()
      const code = String(a.code || '').trim()
      const safeName = name && name.toLowerCase() !== 'null' ? name : ''
      let label = safeName || code || 'Sales area'
      if (safeName && code) label = `${safeName} (${code})`
      return { value: a.id, label }
    }),
    [salesAreaData?.sales_areas],
  )
  const salesAreaLabelById = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of salesAreaOptions) m.set(o.value, o.label)
    return m
  }, [salesAreaOptions])

  const initialAsset = useMemo(
    () => (assets as RentalAsset[]).find((a) => a.id === assetSheetId) || null,
    [assets, assetSheetId],
  )
  const lockedBookings = useMemo(() => {
    if (!assetSheetId) return [] as RentalBooking[]
    const locked = new Set(['approved', 'confirmed', 'active'])
    return (allBookings as RentalBooking[]).filter((b) => b.asset_id === assetSheetId && locked.has(b.status))
  }, [allBookings, assetSheetId])

  const closeSheet = () => {
    patch({ asset: null, parent: null })
    qc.invalidateQueries({ queryKey: ['rental-assets'] })
  }

  const openChildSheet = (parentId: string) => {
    patch({ asset: 'new', parent: parentId })
  }

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
        onCreate={() => patch({ asset: 'new' })}
        onEdit={(a) => patch({ asset: a.id })}
      />

      <RentalAssetSheet
        open={assetSheetOpen}
        assetId={assetSheetId}
        initialAsset={initialAsset}
        initialParentId={initialParentId}
        salesAreaOptions={salesAreaOptions}
        lockedBookings={lockedBookings}
        onClose={closeSheet}
        onSaved={closeSheet}
        onRequestAddChild={openChildSheet}
      />
    </div>
  )
}
