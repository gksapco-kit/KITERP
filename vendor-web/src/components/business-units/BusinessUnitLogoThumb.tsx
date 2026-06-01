import { Store, type LucideIcon } from 'lucide-react'
import type { StoreRecord } from '@/api/vendor'
import { cn } from '@/lib/utils'
import { getBusinessUnitVisual } from '@/lib/businessUnitVisuals'
import { resolveBrandingImageUrl } from '@/components/common/MediaUploadPickerModal'

type Props = {
  store?: StoreRecord | null
  vendor?: { logo_url?: string; banner_url?: string } | null
  vendorLogoUrl?: string | null
  /** When true, show vendor profile logo before per-unit settings logo */
  preferVendorLogo?: boolean
  className?: string
  iconClassName?: string
  fallbackIcon?: LucideIcon
  fallbackGradientClass?: string
}

export function resolveBusinessUnitLogoUrl(
  store?: StoreRecord | null,
  vendor?: { logo_url?: string; banner_url?: string } | null,
  options?: { preferVendorLogo?: boolean; vendorLogoUrl?: string | null },
): string {
  const visual = store ? getBusinessUnitVisual(store, vendor) : null
  const vendorLogo = resolveBrandingImageUrl(options?.vendorLogoUrl ?? vendor?.logo_url)

  // Per-unit logo always wins when this branch has its own branding configured.
  if (visual?.logoUrl && !visual.usesVendorLogo) {
    return visual.logoUrl
  }

  if (options?.preferVendorLogo) {
    return vendorLogo || visual?.logoUrl || ''
  }
  return visual?.logoUrl || vendorLogo
}

export function BusinessUnitLogoThumb({
  store,
  vendor,
  vendorLogoUrl,
  preferVendorLogo = false,
  className = 'h-5 w-5',
  iconClassName = 'h-3.5 w-3.5 shrink-0',
  fallbackIcon: FallbackIcon,
  fallbackGradientClass,
}: Props) {
  const visual = store ? getBusinessUnitVisual(store, vendor) : null
  const Icon = FallbackIcon ?? visual?.Icon ?? Store
  const logoUrl = resolveBusinessUnitLogoUrl(store, vendor, { preferVendorLogo, vendorLogoUrl })

  if (logoUrl) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted',
          className,
        )}
      >
        <img src={logoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      </span>
    )
  }

  if (fallbackGradientClass) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br text-primary',
          fallbackGradientClass,
          className,
        )}
      >
        <Icon className={iconClassName} strokeWidth={1.75} aria-hidden />
      </span>
    )
  }

  return (
    <span className={cn('flex shrink-0 items-center justify-center', className)}>
      <Icon className={iconClassName} aria-hidden />
    </span>
  )
}
