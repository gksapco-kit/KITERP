import { MapPin, Phone, Star } from 'lucide-react'
import type { StoreRecord } from '@/api/vendor'
import { cn } from '@/lib/utils'
import { getBusinessUnitVisual } from '@/lib/businessUnitVisuals'
import { useVendorStore } from '@/stores/vendorStore'
import VendorStorefrontLinksCard from '@/components/VendorStorefrontLinksCard'
import { BusinessUnitVisualHero } from '@/components/business-units/BusinessUnitVisualHero'
import { IdChip, VerifiedBadge, formatStoreCode, vendorVerificationLevel } from '@/lib/verification'

type Props = {
  store: StoreRecord
  /** Tighter layout for Settings embed */
  embeddedInSettings?: boolean
}

export default function BusinessUnitDetailPanel({ store, embeddedInSettings = false }: Props) {
  const { vendor } = useVendorStore()
  const visual = getBusinessUnitVisual(store)

  const slug = vendor?.slug?.trim()

  const statItems = [
    { label: 'City', value: store.address?.city || '—', icon: MapPin, tone: 'text-amber-600' },
    { label: 'Phone', value: store.phone || '—', icon: Phone, tone: 'text-primary' },
  ] as const

  return (
    <div className={cn('space-y-3', embeddedInSettings && 'rounded-lg border border-border bg-card p-3 shadow-sm')}>
      <BusinessUnitVisualHero store={store} />
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-base font-semibold text-foreground">{store.name}</h2>
            <VerifiedBadge level={vendorVerificationLevel(vendor)} size="xs" />
            {store.is_default && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">
                <Star className="h-2.5 w-2.5" />
                Default
              </span>
            )}
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-xs font-medium',
                store.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground',
              )}
            >
              {store.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="mt-0.5 text-xs font-medium text-primary">{visual.typeLabel}</p>
          {store.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{store.description}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <IdChip
              label="Unit"
              code={formatStoreCode(store)}
              fullValue={store.id}
              className="!py-0 !px-1.5"
            />
          </div>
        </div>
      </div>

      {(store.address?.city || store.phone) && (
        <div className="flex flex-wrap gap-1.5">
          {statItems.map(({ label, value, icon: Icon, tone }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground"
            >
              <Icon className={cn('h-3 w-3', tone)} />
              <span className={cn('font-semibold tabular-nums', tone)}>{value}</span>
              {label}
            </span>
          ))}
        </div>
      )}

      {slug ? (
        <VendorStorefrontLinksCard
          vendorSlug={slug}
          outletCode={store.code}
          storeId={store.id}
          vendorSettings={vendor?.settings as Record<string, unknown> | undefined}
          hideOutletRow
          embedded
        />
      ) : (
        <p className="text-xs text-muted-foreground">Business Front links unavailable — missing vendor slug.</p>
      )}

    </div>
  )
}
