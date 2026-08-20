import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCustomers, useSalesAreas } from '@/hooks/useVendor'
import { rentalApi } from './api'
import type { RentalAsset, RentalBooking } from './rentalConstants'
import RentalCalendarTab, { type CalendarBookRequest } from './RentalCalendarTab'
import RentalBookingCreateSheet from './RentalBookingCreateSheet'
import RentalBookingSheet from './RentalBookingSheet'

export default function RentalCalendarPage() {
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()
  const assetId = params.get('asset') || ''
  const [createOpen, setCreateOpen] = useState(false)
  const [bookPrefill, setBookPrefill] = useState<CalendarBookRequest | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<RentalBooking | null>(null)

  const { data: assets = [] } = useQuery({
    queryKey: ['rental-assets'],
    queryFn: () => rentalApi.listAssets(),
    staleTime: 30_000,
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

  const openBook = (req: CalendarBookRequest) => {
    setBookPrefill(req)
    setCreateOpen(true)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-2">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Availability Calendar</h1>
        <p className="text-sm text-muted-foreground">
          See which units are free, then book straight from the grid.
        </p>
      </div>

      <RentalCalendarTab
        assets={assets as RentalAsset[]}
        assetId={assetId}
        onAssetChange={(id) =>
          setParams((prev) => {
            const np = new URLSearchParams(prev)
            if (id) np.set('asset', id)
            else np.delete('asset')
            return np
          }, { replace: true })
        }
        onBookRequest={openBook}
      />

      <RentalBookingCreateSheet
        open={createOpen}
        onClose={() => {
          setCreateOpen(false)
          setBookPrefill(null)
        }}
        assets={assets as RentalAsset[]}
        customers={customers}
        salesAreaOptions={salesAreaOptions}
        initialValues={bookPrefill}
        onCreated={(b) => {
          setCreateOpen(false)
          setBookPrefill(null)
          setSelectedBooking(b)
          qc.invalidateQueries({ queryKey: ['rental-calendar'] })
          qc.invalidateQueries({ queryKey: ['rental-bookings'] })
          qc.invalidateQueries({ queryKey: ['rental-assets'] })
          qc.invalidateQueries({ queryKey: ['rental-asset-units'] })
        }}
      />

      <RentalBookingSheet
        open={!!selectedBooking}
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onChanged={(b) => setSelectedBooking(b)}
        onRequestReturn={() => setSelectedBooking(null)}
      />
    </div>
  )
}
