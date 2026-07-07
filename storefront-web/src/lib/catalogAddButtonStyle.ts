import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export type CatalogAddButtonStyle = 'filled' | 'soft' | 'outline' | 'ghost' | 'pill' | 'icon'

export const CATALOG_ADD_BUTTON_STYLE_OPTIONS: { value: CatalogAddButtonStyle; label: string }[] = [
  { value: 'filled', label: 'Filled' },
  { value: 'soft', label: 'Soft' },
  { value: 'outline', label: 'Outline' },
  { value: 'ghost', label: 'Text' },
  { value: 'pill', label: 'Pill' },
  { value: 'icon', label: 'Icon only' },
]

const ADDED_COLOR = '#10b981'

function readEnum<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(raw as T) ? (raw as T) : fallback
}

export function parseCatalogAddButtonStyle(raw: unknown): CatalogAddButtonStyle {
  return readEnum(
    raw,
    ['filled', 'soft', 'outline', 'ghost', 'pill', 'icon'] as const,
    'filled',
  )
}

function sizeTier(isMinimalCard?: boolean, isCompactCard?: boolean): 'minimal' | 'compact' | 'default' {
  if (isMinimalCard) return 'minimal'
  if (isCompactCard) return 'compact'
  return 'default'
}

const SIZE_CLASS: Record<
  ReturnType<typeof sizeTier>,
  { base: string; icon: string; iconOnly: string }
> = {
  minimal: {
    base: 'gap-1.5 py-1.5 text-[11px] font-semibold',
    icon: 'w-3 h-3',
    iconOnly: 'h-8 w-8',
  },
  compact: {
    base: 'gap-1.5 py-2 text-xs font-semibold',
    icon: 'w-4 h-4',
    iconOnly: 'h-9 w-9',
  },
  default: {
    base: 'gap-2 py-2.5 text-sm font-semibold',
    icon: 'w-4 h-4',
    iconOnly: 'h-10 w-10',
  },
}

function radiusClass(style: CatalogAddButtonStyle, tier: ReturnType<typeof sizeTier>): string {
  if (style === 'pill') return 'rounded-full'
  if (style === 'icon') return 'rounded-full'
  if (tier === 'minimal') return 'rounded-lg'
  return 'rounded-xl'
}

function colorPresentation(
  style: CatalogAddButtonStyle,
  primaryColor?: string,
  isAdded?: boolean,
): { className: string; style?: CSSProperties } {
  const accent = isAdded ? ADDED_COLOR : primaryColor

  if (accent) {
    switch (style) {
      case 'soft':
        return {
          className: '',
          style: {
            backgroundColor: isAdded ? `${ADDED_COLOR}18` : `${accent}18`,
            color: isAdded ? ADDED_COLOR : accent,
          },
        }
      case 'outline':
        return {
          className: 'bg-transparent',
          style: {
            border: `2px solid ${isAdded ? ADDED_COLOR : accent}`,
            color: isAdded ? ADDED_COLOR : accent,
          },
        }
      case 'ghost':
        return {
          className: 'bg-transparent',
          style: { color: isAdded ? ADDED_COLOR : accent },
        }
      case 'icon':
      case 'pill':
      case 'filled':
      default:
        return {
          className: 'text-white',
          style: { backgroundColor: accent },
        }
    }
  }

  switch (style) {
    case 'soft':
      return {
        className: isAdded ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary',
      }
    case 'outline':
      return {
        className: isAdded
          ? 'border-2 border-emerald-500 text-emerald-600 bg-transparent'
          : 'border-2 border-primary text-primary bg-transparent',
      }
    case 'ghost':
      return {
        className: isAdded ? 'text-emerald-600 bg-transparent' : 'text-primary bg-transparent hover:bg-primary/5',
      }
    case 'icon':
    case 'pill':
    case 'filled':
    default:
      return {
        className: isAdded ? 'bg-emerald-500 text-white' : 'bg-primary text-primary-foreground',
      }
  }
}

export function catalogAddButtonLabel(isMinimalCard?: boolean): string {
  return isMinimalCard ? 'Add' : 'Add to Cart'
}

export function resolveCatalogAddButtonPresentation(options: {
  style?: CatalogAddButtonStyle | string | null
  primaryColor?: string
  isAdded?: boolean
  isMinimalCard?: boolean
  isCompactCard?: boolean
  fullWidth?: boolean
}): {
  className: string
  style?: CSSProperties
  iconClassName: string
  iconOnly: boolean
  showLabel: boolean
} {
  const buttonStyle = parseCatalogAddButtonStyle(options.style)
  const tier = sizeTier(options.isMinimalCard, options.isCompactCard)
  const sizes = SIZE_CLASS[tier]
  const colors = colorPresentation(buttonStyle, options.primaryColor, options.isAdded)
  const iconOnly = buttonStyle === 'icon'

  return {
    className: cn(
      'inline-flex items-center justify-center transition-all disabled:opacity-60 disabled:pointer-events-none',
      options.fullWidth !== false && !iconOnly ? 'w-full' : '',
      iconOnly ? sizes.iconOnly : sizes.base,
      radiusClass(buttonStyle, tier),
      colors.className,
    ),
    style: colors.style,
    iconClassName: sizes.icon,
    iconOnly,
    showLabel: !iconOnly,
  }
}

export function catalogAddButtonStylePreview(raw: unknown): string {
  const style = parseCatalogAddButtonStyle(raw)
  return CATALOG_ADD_BUTTON_STYLE_OPTIONS.find(o => o.value === style)?.label ?? 'Filled'
}
