import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar as CalendarIcon, Plus, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCustomers, useSalesAreas } from '@/hooks/useVendor'
import { extractApiError } from '@/lib/errorMessages'
import { rentalApi } from './api'
import type { RentalAsset, RentalBooking } from './rentalConstants'
import RentalDashboard from './RentalDashboard'
import RentalAssetsTab from './RentalAssetsTab'
import RentalAssetSheet from './RentalAssetSheet'
import RentalBookingsTab from './RentalBookingsTab'
import RentalBookingCreateSheet from './RentalBookingCreateSheet'
import RentalCalendarTab from './RentalCalendarTab'
import ReturnAssetModal from './ReturnAssetModal'

type Tab = 'dashboard' | 'assets' | 'bookings' | 'calendar'
const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'assets', label: 'Assets' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'calendar', label: 'Availability Calendar' },
]

export default function RentalHubPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [returnBooking, setReturnBooking] = useState<RentalBooking | null>(null)
  const [calendarBookPrefill, setCalendarBookPrefill] = useState<Record<string, unknown> | null>(null)

  const tab = (params.get('tab') as Tab) || 'dashboard'
  const assetSheetParam = params.get('asset')
  const assetSheetOpen = !!assetSheetParam
  const assetSheetId = assetSheetParam && assetSheetParam !== 'new' ? assetSheetParam : null
  const bookingParam = params.get('booking')
  const bookingCreateOpen = bookingParam === 'new'

  const assetQ = params.get('q') || ''
  const assetStatus = params.get('status') || ''
  const assetCategory = params.get('category') || ''
  const showBin = params.get('bin') === '1'
  const bookingStatus = params.get('bstatus') || ''
  const calAssetId = params.get('calAsset') || ''

  const patch = useCallback((next: Record<string, string | null>, replace = true) => {
    setParams((prev) => {
      const np = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === '') np.delete(k)
        else np.set(k, v)
      }
      return np
    }, { replace })
  }, [setParams])

  const setTab = (next: Tab) => patch({ tab: next === 'dashboard' ? null : next }, false)
  const qc = useQueryClient()

  const { data: assets = [], isLoading: loadingAssets } = useQuery({
    queryKey: ['rental-assets', showBin ? 'bin' : 'active'],
    queryFn: () => rentalApi.listAssets({ deleted_only: showBin }),
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const restoreAsset = useMutation({
    mutationFn: (id: string) => rentalApi.restoreAsset(id),
    onSuccess: () => {
      toast.success('Asset restored from bin')
      qc.invalidateQueries({ queryKey: ['rental-assets'] })
    },
    onError: (e) => toast.error(extractApiError(e, 'Restore asset')),
  })
  const { data: allBookings = [] } = useQuery({
    queryKey: ['rental-bookings', '__all_for_locks__'],
    queryFn: () => rentalApi.listBookings(),
    staleTime: 15_000,
  })
  const { data: bookings = [], isLoading: loadingBookings } = useQuery({
    queryKey: ['rental-bookings', bookingStatus],
    queryFn: () => rentalApi.listBookings(bookingStatus || undefined),
  })
  const { data: salesAreaData } = useSalesAreas({ is_active: true })
  const { data: customerData } = useCustomers({ limit: 200 })

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
  const customers = customerData?.items ?? []

  const initialAssetForSheet = useMemo(
    () => (assets as RentalAsset[]).find((a) => a.id === assetSheetId) || null,
    [assets, assetSheetId],
  )
  const lockedBookingsForSheet = useMemo(() => {
    if (!assetSheetId) return [] as RentalBooking[]
    const locked = new Set(['approved', 'confirmed', 'active'])
    return (allBookings as RentalBooking[]).filter((b) => b.asset_id === assetSheetId && locked.has(b.status))
  }, [allBookings, assetSheetId])

  const returnAsset = useMemo(
    () => (returnBooking ? (assets as RentalAsset[]).find((a) => a.id === returnBooking.asset_id) || null : null),
    [assets, returnBooking],
  )

  const openCreateAsset = () => patch({ tab: 'assets', asset: 'new' }, false)
  const closeAssetSheet = () => patch({ asset: null }, false)

  const openCreateBooking = () => {
    setCalendarBookPrefill(null)
    patch({ tab: 'bookings', booking: 'new' }, false)
  }
  const openBookingDetail = (b: RentalBooking) => {
    navigate(`/rental/bookings/${b.id}`)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Rentals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your rental assets, rack capacity, availability, bookings, and rental revenue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => toast.message('Rental settings coming soon')}>
            <Settings2 className="mr-1 h-4 w-4" /> Rental Settings
          </Button>
          <Button size="sm" onClick={openCreateAsset}>
            <Plus className="mr-1 h-4 w-4" /> Add Rental Asset
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.id === 'calendar' ? <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" />{t.label}</span> : t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <RentalDashboard
          allBookings={allBookings as RentalBooking[]}
          onGoToAssets={() => setTab('assets')}
          onGoToBookings={(status) => patch({ tab: 'bookings', bstatus: status || null }, false)}
          onSelectBooking={openBookingDetail}
        />
      )}

      {tab === 'assets' && (
        <RentalAssetsTab
          assets={assets as RentalAsset[]}
          allBookings={(showBin ? [] : allBookings) as RentalBooking[]}
          loading={loadingAssets}
          salesAreaLabelById={salesAreaLabelById}
          q={assetQ}
          onQChange={(v) => patch({ q: v || null })}
          status={assetStatus}
          onStatusChange={(v) => patch({ status: v || null })}
          category={assetCategory}
          onCategoryChange={(v) => patch({ category: v || null })}
          showBin={showBin}
          onToggleBin={() => patch({ bin: showBin ? null : '1', status: null })}
          onCreate={openCreateAsset}
          onView={(a) => navigate(`/rental/assets/${a.id}`)}
          onEdit={(a) => navigate(`/rental/assets/${a.id}/edit`)}
          onRestore={(a) => restoreAsset.mutate(a.id)}
          restoringId={restoreAsset.isPending ? restoreAsset.variables : null}
        />
      )}

      {tab === 'bookings' && (
        <RentalBookingsTab
          bookings={bookings as RentalBooking[]}
          loading={loadingBookings}
          status={bookingStatus}
          onStatusChange={(v) => patch({ bstatus: v || null })}
          onCreate={openCreateBooking}
          onSelect={openBookingDetail}
        />
      )}

      {tab === 'calendar' && (
        <RentalCalendarTab
          assets={assets as RentalAsset[]}
          assetId={calAssetId}
          onAssetChange={(id) => patch({ calAsset: id || null })}
          onBookRequest={(req) => {
            setCalendarBookPrefill(req)
            patch({ booking: 'new' }, false)
          }}
        />
      )}

      <RentalAssetSheet
        open={assetSheetOpen}
        assetId={assetSheetId}
        initialAsset={initialAssetForSheet}
        salesAreaOptions={salesAreaOptions}
        lockedBookings={lockedBookingsForSheet}
        onClose={closeAssetSheet}
        onSaved={closeAssetSheet}
      />

      <RentalBookingCreateSheet
        open={bookingCreateOpen}
        onClose={() => {
          setCalendarBookPrefill(null)
          patch({ booking: null }, false)
        }}
        assets={assets as RentalAsset[]}
        customers={customers}
        salesAreaOptions={salesAreaOptions}
        initialValues={calendarBookPrefill}
        onCreated={(b) => {
          setCalendarBookPrefill(null)
          patch({ booking: null }, false)
          navigate(`/rental/bookings/${b.id}`)
        }}
      />

      {returnBooking && (
        <ReturnAssetModal
          booking={returnBooking}
          asset={returnAsset}
          onClose={() => setReturnBooking(null)}
          onDone={() => {
            setReturnBooking(null)
          }}
        />
      )}
    </div>
  )
}
