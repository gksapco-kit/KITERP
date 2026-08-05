import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCustomers, useSalesAreas } from '@/hooks/useVendor'
import { rentalApi } from './api'
import type { RentalAsset, RentalBooking } from './rentalConstants'
import RentalBookingsTab from './RentalBookingsTab'
import RentalBookingSheet from './RentalBookingSheet'
import RentalBookingCreateSheet from './RentalBookingCreateSheet'
import ReturnAssetModal from './ReturnAssetModal'

export default function RentalBookingsPage() {
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()
  const [selectedBooking, setSelectedBooking] = useState<RentalBooking | null>(null)
  const [returnBooking, setReturnBooking] = useState<RentalBooking | null>(null)

  const status = params.get('status') || ''
  const bookingParam = params.get('booking')
  const bookingDetailId = bookingParam && bookingParam !== 'new' ? bookingParam : null
  const createSheetOpen = bookingParam === 'new'

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

  const { data: assets = [] } = useQuery({
    queryKey: ['rental-assets'],
    queryFn: () => rentalApi.listAssets(),
    staleTime: 30_000,
  })
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['rental-bookings', status],
    queryFn: () => rentalApi.listBookings(status || undefined),
    staleTime: 15_000,
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
  const customers = customerData?.items ?? []

  const effectiveBooking = useMemo(() => {
    if (!bookingDetailId) return null
    if (selectedBooking?.id === bookingDetailId) return selectedBooking
    return (bookings as RentalBooking[]).find((b) => b.id === bookingDetailId) || null
  }, [bookingDetailId, selectedBooking, bookings])

  const returnAsset = useMemo(
    () => (returnBooking ? (assets as RentalAsset[]).find((a) => a.id === returnBooking.asset_id) || null : null),
    [assets, returnBooking],
  )

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['rental-bookings'] })
    qc.invalidateQueries({ queryKey: ['rental-assets'] })
    qc.invalidateQueries({ queryKey: ['rental-dashboard'] })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Rental Bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track all rental bookings — pending approvals, active rentals, and completed returns.
        </p>
      </div>

      <RentalBookingsTab
        bookings={bookings as RentalBooking[]}
        loading={isLoading}
        status={status}
        onStatusChange={(v) => patch({ status: v || null, booking: null })}
        onCreate={() => patch({ booking: 'new' })}
        onSelect={(b) => { setSelectedBooking(b); patch({ booking: b.id }) }}
        selectedId={bookingDetailId}
      />

      <RentalBookingSheet
        open={!!bookingDetailId}
        booking={effectiveBooking}
        onClose={() => { setSelectedBooking(null); patch({ booking: null }); invalidate() }}
        onChanged={(b) => { setSelectedBooking(b); invalidate() }}
        onRequestReturn={(b) => { setReturnBooking(b); patch({ booking: null }) }}
      />

      <RentalBookingCreateSheet
        open={createSheetOpen}
        onClose={() => patch({ booking: null })}
        assets={assets as RentalAsset[]}
        customers={customers}
        salesAreaOptions={salesAreaOptions}
        onCreated={(b) => {
          setSelectedBooking(b)
          patch({ booking: b.id })
          invalidate()
        }}
      />

      {returnBooking && (
        <ReturnAssetModal
          booking={returnBooking}
          asset={returnAsset}
          onClose={() => setReturnBooking(null)}
          onDone={(b) => {
            setSelectedBooking(b)
            setReturnBooking(null)
            patch({ booking: b.id })
            invalidate()
          }}
        />
      )}
    </div>
  )
}
