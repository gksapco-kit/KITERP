import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCustomers, useSalesAreas } from '@/hooks/useVendor'
import { rentalApi } from './api'
import type { RentalAsset, RentalBooking } from './rentalConstants'
import RentalBookingsTab from './RentalBookingsTab'
import RentalBookingCreateSheet from './RentalBookingCreateSheet'

export default function RentalBookingsPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const status = params.get('status') || ''
  const createSheetOpen = params.get('booking') === 'new'

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
        onSelect={(b) => navigate(`/rental/bookings/${b.id}`)}
      />

      <RentalBookingCreateSheet
        open={createSheetOpen}
        onClose={() => patch({ booking: null })}
        assets={assets as RentalAsset[]}
        customers={customers}
        salesAreaOptions={salesAreaOptions}
        onCreated={(b) => {
          patch({ booking: null })
          invalidate()
          navigate(`/rental/bookings/${b.id}`)
        }}
      />
    </div>
  )
}
