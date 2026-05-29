import type { ContainerAlign, ContainerLayout } from '../types/builder'

const JUSTIFY_ITEMS: Record<ContainerAlign, string> = {
  start: 'justify-items-start',
  center: 'justify-items-center',
  end: 'justify-items-end',
  stretch: 'justify-items-stretch',
}

const ALIGN_ITEMS: Record<ContainerAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
}

const FLEX_ALIGN: Record<ContainerAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
}

const FLEX_JUSTIFY: Record<ContainerAlign, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  stretch: 'justify-start',
}

const JUSTIFY_SELF: Record<ContainerAlign, string> = {
  start: 'justify-self-start',
  center: 'justify-self-center',
  end: 'justify-self-end',
  stretch: 'justify-self-stretch',
}

const ALIGN_SELF: Record<ContainerAlign, string> = {
  start: 'self-start',
  center: 'self-center',
  end: 'self-end',
  stretch: 'self-stretch',
}

export const CONTAINER_PADDING_PRESETS: Record<string, string> = {
  none: '0',
  sm: '16px',
  md: '24px',
  lg: '40px',
  xl: '64px',
}

export function containerPaddingPresetValue(padding?: string): string {
  if (!padding) return 'md'
  const entry = Object.entries(CONTAINER_PADDING_PRESETS).find(([, v]) => v === padding)
  return entry?.[0] ?? 'custom'
}

export function containerChildSpanClass(span?: number, layout?: ContainerLayout): string {
  const s = Math.min(Math.max(span ?? 1, 1), 3)
  if (layout === 'column') return 'w-full'
  if (layout === 'row') return s >= 2 ? 'md:col-span-2 min-w-0' : 'min-w-0'
  if (s >= 3) return 'col-span-1 sm:col-span-2 lg:col-span-3 min-w-0'
  if (s >= 2) return 'col-span-1 sm:col-span-2 min-w-0'
  return 'col-span-1 min-w-0'
}

export function containerLayoutClass(layout?: ContainerLayout): string {
  switch (layout) {
    case 'row':
      return 'grid grid-cols-1 md:grid-cols-2'
    case 'grid':
      return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
    case 'column':
    default:
      return 'flex flex-col'
  }
}

export function containerGapClass(gap?: 'sm' | 'md' | 'lg'): string {
  switch (gap) {
    case 'sm':
      return 'gap-4'
    case 'lg':
      return 'gap-8'
    case 'md':
    default:
      return 'gap-6'
  }
}

/** Default alignment for all items in the container */
export function containerItemsAlignClass(
  layout: ContainerLayout,
  alignX?: ContainerAlign,
  alignY?: ContainerAlign,
): string {
  const x = alignX ?? 'stretch'
  const y = alignY ?? 'stretch'

  if (layout === 'column') {
    return `${FLEX_ALIGN[x]} ${FLEX_JUSTIFY[y]}`
  }
  return `${JUSTIFY_ITEMS[x]} ${ALIGN_ITEMS[y]}`
}

/** Vertical placement of content inside a child slot (when the slot is taller than its block). */
export function containerChildContentClass(alignY?: ContainerAlign): string {
  if (alignY === 'center') return 'justify-center'
  if (alignY === 'end') return 'justify-end'
  if (alignY === 'stretch') return 'justify-stretch flex-1 min-h-0'
  return 'justify-start'
}

/** Per-child alignment override (relative to siblings / cell) */
export function containerChildAlignClass(
  layout: ContainerLayout,
  alignX?: ContainerAlign,
  alignY?: ContainerAlign,
): string {
  const parts: string[] = ['min-w-0']
  if (layout === 'column') {
    if (alignX) parts.push(FLEX_ALIGN[alignX])
    if (alignY) {
      parts.push(alignY === 'stretch' ? 'self-stretch w-full' : `${ALIGN_SELF[alignY]} w-full`)
    }
    return parts.join(' ')
  }
  if (alignX) parts.push(JUSTIFY_SELF[alignX])
  if (alignY) {
    parts.push(ALIGN_SELF[alignY])
    if (alignY === 'stretch') parts.push('self-stretch min-h-0')
  }
  return parts.join(' ')
}
