import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useSalesAreas } from '@/hooks/useVendor'
import { extractApiError } from '@/lib/errorMessages'
import { rentalApi } from './api'
import type { RentalAsset, RentalBooking } from './rentalConstants'
import RentalAssetsTab from './RentalAssetsTab'

export default function RentalAssetsPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const q = params.get('q') || ''
  const status = params.get('status') || ''
  const category = params.get('category') || ''
  const showBin = params.get('bin') === '1'

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

  const { data: assets = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['rental-assets', showBin ? 'bin' : 'active'],
    queryFn: () => rentalApi.listAssets({ deleted_only: showBin }),
    staleTime: 30_000,
  })
  const { data: allBookings = [] } = useQuery({
    queryKey: ['rental-bookings', '__all__'],
    queryFn: () => rentalApi.listBookings(),
    staleTime: 20_000,
    enabled: !showBin,
  })
  const { data: salesAreaData } = useSalesAreas({ is_active: true })

  const restoreAsset = useMutation({
    mutationFn: (id: string) => rentalApi.restoreAsset(id),
    onSuccess: () => {
      toast.success('Asset restored from bin')
      qc.invalidateQueries({ queryKey: ['rental-assets'] })
    },
    onError: (e) => toast.error(extractApiError(e, 'Restore asset')),
  })

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
        <h1 className="text-xl font-bold text-foreground">
          {showBin ? 'Asset bin' : 'Rental Assets'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {showBin
            ? 'Soft-deleted assets kept for history. Restore anytime — nothing is permanently erased.'
            : 'Manage your rentable racks, equipment, vehicles, and storage units.'}
        </p>
      </div>

      {isError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <p className="font-medium">Could not load rental assets</p>
          <p className="mt-0.5 text-xs opacity-90">{extractApiError(error, 'Request failed')}</p>
          <p className="mt-1 text-xs opacity-80">
            If you just added soft-delete, restart the backend so it can create the{' '}
            <code className="font-mono">deleted_at</code> column, then retry.
          </p>
          <button
            type="button"
            className="mt-2 text-xs font-medium underline underline-offset-2"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </div>
      )}

      <RentalAssetsTab
        assets={assets as RentalAsset[]}
        allBookings={(showBin ? [] : allBookings) as RentalBooking[]}
        loading={isLoading}
        salesAreaLabelById={salesAreaLabelById}
        q={q}
        onQChange={(v) => patch({ q: v || null })}
        status={status}
        onStatusChange={(v) => patch({ status: v || null })}
        category={category}
        onCategoryChange={(v) => patch({ category: v || null })}
        showBin={showBin}
        onToggleBin={() => patch({ bin: showBin ? null : '1', status: null })}
        onCreate={() => navigate('/rental/assets/new')}
        onView={(a) => navigate(`/rental/assets/${a.id}`)}
        onEdit={(a) => navigate(`/rental/assets/${a.id}/edit`)}
        onRestore={(a) => restoreAsset.mutate(a.id)}
        restoringId={restoreAsset.isPending ? restoreAsset.variables : null}
      />
    </div>
  )
}
