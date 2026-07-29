import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PharmaCard, PharmaPageHeader, PharmaStatusBadge } from './pharmaShared'

const STOCK_TYPES = ['unrestricted', 'quarantine', 'rejected', 'returns'] as const

export default function PharmaSettingsStoragePage() {
  return (
    <div className="space-y-4 p-6">
      <div>
        <Link
          to="/pharma/settings"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Foundations
        </Link>
        <PharmaPageHeader
          title="Storage location types"
          subtitle="Quarantine / rejected / returns stock types drive QI holds and release moves. Set GDP temp bands on each location."
        />
      </div>

      <PharmaCard className="max-w-xl">
        <h2 className="mb-3 text-sm font-semibold">Stock types</h2>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {STOCK_TYPES.map((t) => (
            <PharmaStatusBadge key={t} status={t} />
          ))}
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Configure each storage location’s stock type and GDP temperature band from the storage locations screen.
        </p>
        <Button asChild>
          <Link to="/storage-locations" className="gap-1.5">
            Open storage locations
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </PharmaCard>
    </div>
  )
}
