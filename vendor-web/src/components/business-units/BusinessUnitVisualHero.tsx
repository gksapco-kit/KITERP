import type { StoreRecord } from '@/api/vendor'
import { cn } from '@/lib/utils'
import { getBusinessUnitVisual } from '@/lib/businessUnitVisuals'
import { useVendorStore } from '@/stores/vendorStore'
import { resolveBrandingMode } from '@/lib/brandingMode'

type Props = {
  store: StoreRecord
  /** Compact banner for grid cards; taller for detail panel */
  variant?: 'card' | 'detail'
  className?: string
}

export function BusinessUnitVisualHero({ store, variant = 'card', className }: Props) {
  const { vendor } = useVendorStore()
  const brandingMode = resolveBrandingMode(vendor?.settings)
  const visual = getBusinessUnitVisual(store, vendor, brandingMode)
  const { Icon } = visual
  const isCard = variant === 'card'
  const bannerH = isCard ? 'h-6' : 'h-36'
  const logoSize = isCard ? 'h-14 w-14' : 'h-14 w-14'
  const iconSize = isCard ? 'h-6 w-6' : 'h-6 w-6'

  if (isCard) {
    return (
      <div className={cn('relative w-full shrink-0', className)}>
        <div
          className={cn(
            'relative w-full overflow-hidden',
            bannerH,
            !visual.bannerUrl && `bg-gradient-to-br ${visual.gradientClass}`,
          )}
        >
          {visual.bannerUrl && (
            <img src={visual.bannerUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
          {!store.is_active && (
            <span className="absolute right-1 top-0.5 rounded-full bg-black/50 px-1 py-px text-[8px] font-medium text-white">
              Inactive
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative w-full shrink-0', className)}>
      <div
        className={cn(
          'relative w-full overflow-hidden',
          bannerH,
          !visual.bannerUrl && `bg-gradient-to-br ${visual.gradientClass}`,
        )}
      >
        {visual.bannerUrl ? (
          <img src={visual.bannerUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
        {!store.is_active && (
          <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            Inactive
          </span>
        )}
      </div>

      <div
        className={cn(
          'absolute z-[1] overflow-hidden rounded-lg border-2 border-card bg-card shadow-md',
          logoSize,
          'bottom-0 left-4 translate-y-1/2',
        )}
      >
        {visual.logoUrl ? (
          <img src={visual.logoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-muted text-primary">
            <Icon className={iconSize} strokeWidth={1.75} aria-hidden />
          </span>
        )}
      </div>
    </div>
  )
}
