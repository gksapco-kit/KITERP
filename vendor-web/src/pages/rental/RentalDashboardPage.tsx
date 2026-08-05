import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCustomers, useSalesAreas } from '@/hooks/useVendor'
import { rentalApi } from './api'
import type { RentalAsset, RentalBooking } from './rentalConstants'
import RentalDashboard from './RentalDashboard'
import RentalBookingSheet from './RentalBookingSheet'
import RentalBookingCreateSheet from './RentalBookingCreateSheet'
import ReturnAssetModal from './ReturnAssetModal'

export default function RentalDashboardPage() {
  const navigate = useNavigate()
  const [selectedBooking, setSelectedBooking] = useState<RentalBooking | null>(null)
  const [returnBooking, setReturnBooking] = useState<RentalBooking | null>(null)
  const [bookingSheetOpen, setBookingSheetOpen] = useState(false)
  const [createSheetOpen, setCreateSheetOpen] = useState(false)

  const { data: assets = [] } = useQuery({
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

  const returnAsset = useMemo(
    () => (returnBooking ? (assets as RentalAsset[]).find((a) => a.id === returnBooking.asset_id) || null : null),
    [assets, returnBooking],
  )

  const openBooking = (b: RentalBooking) => {
    setSelectedBooking(b)
    setBookingSheetOpen(true)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Rental Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of your rental assets, active bookings, and revenue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate('/rental/settings')}>
            <Settings2 className="mr-1 h-4 w-4" /> Settings
          </Button>
          <Button size="sm" onClick={() => navigate('/rental/assets')}>
            <Plus className="mr-1 h-4 w-4" /> Add Asset
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCreateSheetOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> New Booking
          </Button>
        </div>
      </div>

      <RentalDashboard
        allBookings={allBookings as RentalBooking[]}
        onGoToAssets={() => navigate('/rental/assets')}
        onGoToBookings={(status) => navigate(status ? `/rental/bookings?status=${status}` : '/rental/bookings')}
        onSelectBooking={openBooking}
      />

      <RentalBookingSheet
        open={bookingSheetOpen}
        booking={selectedBooking}
        onClose={() => { setBookingSheetOpen(false); setSelectedBooking(null) }}
        onChanged={(b) => setSelectedBooking(b)}
        onRequestReturn={(b) => { setReturnBooking(b); setBookingSheetOpen(false) }}
      />

      <RentalBookingCreateSheet
        open={createSheetOpen}
        onClose={() => setCreateSheetOpen(false)}
        assets={assets as RentalAsset[]}
        customers={customers}
        salesAreaOptions={salesAreaOptions}
        onCreated={(b) => {
          setSelectedBooking(b)
          setCreateSheetOpen(false)
          setBookingSheetOpen(true)
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
            setBookingSheetOpen(true)
          }}
        />
      )}
    </div>
  )
}
