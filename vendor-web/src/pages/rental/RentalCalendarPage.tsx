import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { rentalApi } from './api'
import type { RentalAsset } from './rentalConstants'
import RentalCalendarTab from './RentalCalendarTab'

export default function RentalCalendarPage() {
  const [params, setParams] = useSearchParams()
  const assetId = params.get('asset') || ''

  const { data: assets = [] } = useQuery({
    queryKey: ['rental-assets'],
    queryFn: () => rentalApi.listAssets(),
    staleTime: 30_000,
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Availability Calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View day-by-day availability and occupancy for each rental asset.
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
      />
    </div>
  )
}
