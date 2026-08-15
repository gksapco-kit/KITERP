import { cn } from '@/lib/utils'
import type { CommerceCatalogLayoutProps } from '@/lib/commerceCatalogLayout'
import { cardStylePadding } from '@/lib/commerceCatalogLayout'

export type ProductCardLayoutOptions = Pick<
  CommerceCatalogLayoutProps,
  'imageHeightPct' | 'cardPadding' | 'cardStyle' | 'showCta' | 'showTags'
>

export function productCardBodyClass(cardStyle?: string): string {
  if (cardStyle === 'minimal') return 'line-clamp-1 text-xs font-medium'
  if (cardStyle === 'compact') return 'line-clamp-2 text-sm font-medium'
  return 'line-clamp-1 text-sm font-medium'
}

export function productCardPadding(cardStyle?: string, cardPadding?: number): number {
  return cardStylePadding(cardStyle ?? 'default', cardPadding)
}

export function productCardImageShell(
  imageHeightPct: number | undefined,
  aspectClassName: string,
  className?: string,
  objectFit: 'cover' | 'contain' = 'contain',
) {
  const contain = objectFit !== 'cover'
  const fitClass = contain
    ? 'object-contain object-center bg-white p-1'
    : 'object-cover object-center transition-transform duration-300 group-hover:scale-105'
  if (imageHeightPct != null && imageHeightPct > 0 && imageHeightPct < 95) {
    return {
      wrapperClass: cn('relative w-full overflow-hidden bg-white', className),
      wrapperStyle: { paddingBottom: `${imageHeightPct}%` } as const,
      imageClass: cn('absolute inset-0 h-full w-full', fitClass),
    }
  }
  return {
    wrapperClass: cn('relative overflow-hidden bg-white', aspectClassName, className),
    wrapperStyle: undefined,
    imageClass: cn('absolute inset-0 h-full w-full', fitClass),
  }
}
