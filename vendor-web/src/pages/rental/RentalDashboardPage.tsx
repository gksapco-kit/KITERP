import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCustomers, useSalesAreas } from '@/hooks/useVendor'
import { rentalApi } from './api'
import type { RentalAsset, RentalBooking } from './rentalConstants'
import RentalDashboard from './RentalDashboard'
import RentalBookingCreateSheet from './RentalBookingCreateSheet'

export default function RentalDashboardPage() {
  const navigate = useNavigate()
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

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Rental</p>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight text-foreground">Operations overview</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Fleet availability, booking pipeline, and rental revenue at a glance.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate('/rental/settings')}>
            <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Settings
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCreateSheetOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Booking
          </Button>
          <Button size="sm" onClick={() => navigate('/rental/assets')}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Asset
          </Button>
        </div>
      </div>

      <RentalDashboard
        allBookings={allBookings as RentalBooking[]}
        onGoToAssets={() => navigate('/rental/assets')}
        onGoToBookings={(status) => navigate(status ? `/rental/bookings?status=${status}` : '/rental/bookings')}
        onSelectBooking={(b) => navigate(`/rental/bookings/${b.id}`)}
      />

      <RentalBookingCreateSheet
        open={createSheetOpen}
        onClose={() => setCreateSheetOpen(false)}
        assets={assets as RentalAsset[]}
        customers={customers}
        salesAreaOptions={salesAreaOptions}
        onCreated={(b) => {
          setCreateSheetOpen(false)
          navigate(`/rental/bookings/${b.id}`)
        }}
      />
    </div>
  )
}
