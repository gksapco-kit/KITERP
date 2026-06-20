import { MapPin, Phone, Star } from 'lucide-react'
import type { StoreRecord } from '@/api/vendor'
import { cn } from '@/lib/utils'
import { getBusinessUnitVisual } from '@/lib/businessUnitVisuals'
import { resolveBrandingMode } from '@/lib/brandingMode'
import { useVendorStore } from '@/stores/vendorStore'
import { BusinessUnitLogoThumb } from '@/components/business-units/BusinessUnitLogoThumb'
import VendorStorefrontLinksCard from '@/components/VendorStorefrontLinksCard'
import { branchCodeForStore } from '@/lib/liveStorefrontUrl'
import { BusinessUnitVisualHero } from '@/components/business-units/BusinessUnitVisualHero'
import { IdChip, VerifiedBadge, formatStoreCode, vendorVerificationLevel } from '@/lib/verification'

type Props = {
  store: StoreRecord
  /** Tighter layout for Settings embed */
  embeddedInSettings?: boolean
}

export default function BusinessUnitDetailPanel({ store, embeddedInSettings = false }: Props) {
  const { vendor } = useVendorStore()
  const visual = getBusinessUnitVisual(store, vendor, resolveBrandingMode(vendor?.settings))

  const slug = vendor?.slug?.trim()

  const statItems = [
    { label: 'City', value: store.address?.city || '—', icon: MapPin, tone: 'text-amber-600' },
    { label: 'Phone', value: store.phone || '—', icon: Phone, tone: 'text-primary' },
  ] as const

  const metaBadges = (
    <>
      <VerifiedBadge level={vendorVerificationLevel(vendor)} size="xs" />
      {store.is_default && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
          <Star className="h-2.5 w-2.5" />
          Default
        </span>
      )}
      <span
        className={cn(
          'rounded-full px-1.5 py-0.5 text-xs font-medium',
          store.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-muted text-muted-foreground',
        )}
      >
        {store.is_active ? 'Active' : 'Inactive'}
      </span>
    </>
  )

  return (
    <div className={cn('space-y-2', !embeddedInSettings && 'rounded-lg border border-border bg-card p-3 shadow-sm')}>
      {!embeddedInSettings && <BusinessUnitVisualHero store={store} variant="card" />}

      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {embeddedInSettings && (
          <BusinessUnitLogoThumb
            store={store}
            vendor={vendor}
            className="h-8 w-8"
            iconClassName="h-4 w-4"
            fallbackGradientClass={visual.gradientClass}
          />
        )}

        {!embeddedInSettings ? (
          <h2 className="shrink-0 text-sm font-semibold text-foreground">{store.name}</h2>
        ) : null}

        <span className="flex shrink-0 flex-wrap items-center gap-1">{metaBadges}</span>

        <span aria-hidden className="hidden text-muted-foreground/35 sm:inline">·</span>

        <span className="shrink-0 text-xs font-medium text-muted-foreground">{visual.typeLabel}</span>

        <IdChip
          label="Unit"
          code={formatStoreCode(store)}
          fullValue={store.id}
          className="!py-0 !px-1.5 shrink-0"
        />

        {embeddedInSettings && store.description ? (
          <>
            <span aria-hidden className="hidden text-muted-foreground/35 lg:inline">·</span>
            <span className="hidden min-w-0 max-w-[14rem] truncate text-xs text-muted-foreground lg:inline" title={store.description}>
              {store.description}
            </span>
          </>
        ) : null}

        {embeddedInSettings && (store.address?.city || store.phone) ? (
          <>
            <span aria-hidden className="hidden text-muted-foreground/35 xl:inline">·</span>
            <span className="hidden flex-wrap items-center gap-1 xl:flex">
              {statItems.map(({ label, value, icon: StatIcon, tone }) =>
                value !== '—' ? (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    <StatIcon className={cn('h-2.5 w-2.5', tone)} />
                    <span className={cn('font-semibold tabular-nums', tone)}>{value}</span>
                  </span>
                ) : null,
              )}
            </span>
          </>
        ) : null}
      </div>

      {!embeddedInSettings && store.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{store.description}</p>
      )}

      {!embeddedInSettings && (store.address?.city || store.phone) && (
        <div className="flex flex-wrap gap-1.5">
          {statItems.map(({ label, value, icon: StatIcon, tone }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground"
            >
              <StatIcon className={cn('h-3 w-3', tone)} />
              <span className={cn('font-semibold tabular-nums', tone)}>{value}</span>
              {label}
            </span>
          ))}
        </div>
      )}

      {slug ? (
        <VendorStorefrontLinksCard
          vendorSlug={slug}
          outletCode={branchCodeForStore(store)}
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
