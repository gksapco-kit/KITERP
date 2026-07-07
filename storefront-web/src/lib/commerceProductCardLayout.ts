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
  objectFit: 'cover' | 'contain' = 'cover',
) {
  const fitClass = objectFit === 'contain' ? 'object-contain' : 'object-cover'
  if (imageHeightPct != null && imageHeightPct > 0) {
    return {
      wrapperClass: cn('relative w-full overflow-hidden bg-muted', className),
      wrapperStyle: { paddingBottom: `${imageHeightPct}%` } as const,
      imageClass: cn('absolute inset-0 h-full w-full transition-transform duration-300 group-hover:scale-105', fitClass),
    }
  }
  return {
    wrapperClass: cn('relative overflow-hidden bg-muted', aspectClassName, className),
    wrapperStyle: undefined,
    imageClass: cn('h-full w-full transition-transform duration-300 group-hover:scale-105', fitClass),
  }
}
