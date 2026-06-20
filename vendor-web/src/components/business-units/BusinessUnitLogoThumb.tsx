import { Store, type LucideIcon } from 'lucide-react'
import type { StoreRecord } from '@/api/vendor'
import { cn } from '@/lib/utils'
import { getBusinessUnitVisual } from '@/lib/businessUnitVisuals'
import { resolveBrandingMode } from '@/lib/brandingMode'
import { resolveBrandingImageUrl } from '@/components/common/MediaUploadPickerModal'

type Props = {
  store?: StoreRecord | null
  vendor?: { logo_url?: string; banner_url?: string } | null
  vendorLogoUrl?: string | null
  /** When true, show vendor profile logo before per-unit settings logo */
  preferVendorLogo?: boolean
  /** Primary-filled toolbar pill — flat tile instead of gradient */
  variant?: 'default' | 'onPrimary'
  className?: string
  iconClassName?: string
  fallbackIcon?: LucideIcon
  fallbackGradientClass?: string
}

export function resolveBusinessUnitLogoUrl(
  store?: StoreRecord | null,
  vendor?: { logo_url?: string; banner_url?: string; settings?: Record<string, unknown> | null } | null,
  options?: { preferVendorLogo?: boolean; vendorLogoUrl?: string | null },
): string {
  const mode = resolveBrandingMode(vendor?.settings)
  const visual = store ? getBusinessUnitVisual(store, vendor, mode) : null
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
  variant = 'default',
  className = 'h-5 w-5',
  iconClassName = 'h-3.5 w-3.5 shrink-0',
  fallbackIcon: FallbackIcon,
  fallbackGradientClass,
}: Props) {
  const mode = resolveBrandingMode((vendor as { settings?: Record<string, unknown> | null } | null)?.settings)
  const visual = store ? getBusinessUnitVisual(store, vendor, mode) : null
  const Icon = FallbackIcon ?? visual?.Icon ?? Store
  const logoUrl = resolveBusinessUnitLogoUrl(store, vendor, { preferVendorLogo, vendorLogoUrl })
  const tileBase =
    'flex shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-inset ring-border/45'

  if (logoUrl) {
    return (
      <span className={cn(tileBase, 'bg-muted', className)}>
        <img src={logoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      </span>
    )
  }

  if (variant === 'onPrimary') {
    return (
      <span className={cn(tileBase, 'bg-white/15 text-white ring-white/25', className)}>
        <Icon className={iconClassName} strokeWidth={1.75} aria-hidden />
      </span>
    )
  }

  const gradientClass = fallbackGradientClass ?? visual?.gradientClass
  if (gradientClass) {
    return (
      <span
        className={cn(
          tileBase,
          'bg-gradient-to-br text-white',
          gradientClass,
          className,
        )}
      >
        <Icon className={iconClassName} strokeWidth={1.75} aria-hidden />
      </span>
    )
  }

  return (
    <span className={cn(tileBase, 'bg-muted text-muted-foreground', className)}>
      <Icon className={iconClassName} aria-hidden />
    </span>
  )
}
