import type { Block, BlockProps } from '../types/builder'

export type SectionContentAlign = 'start' | 'center' | 'end'

export const DEFAULT_HERO_SECTION_HEIGHT = '360px'

export const HERO_SECTION_HEIGHT_PRESETS: { label: string; value: string }[] = [
  { label: 'Compact (240px)', value: '240px' },
  { label: 'Medium (360px)', value: '360px' },
  { label: 'Large (420px)', value: '420px' },
  { label: 'Extra large (520px)', value: '520px' },
  { label: 'Tall (640px)', value: '640px' },
]

export function resolveHeroSectionHeight(props: Pick<BlockProps, 'heroSectionHeight'> | undefined): string {
  const raw = props?.heroSectionHeight?.trim()
  if (!raw) return DEFAULT_HERO_SECTION_HEIGHT
  if (/^\d+$/.test(raw)) return `${raw}px`
  return raw
}

/** Canvas resize stores height on block.styles; hero props use heroSectionHeight. Prefer styles. */
export function resolveBlockSectionHeight(block: Pick<Block, 'styles' | 'props'>): string {
  const styleHeight = block.styles.height?.trim()
  if (styleHeight) {
    if (/^\d+$/.test(styleHeight)) return `${styleHeight}px`
    return styleHeight
  }
  return resolveHeroSectionHeight(block.props)
}

export function resolveHeroContentAlignX(block: Pick<Block, 'props' | 'styles'>): SectionContentAlign {
  if (block.props.heroContentAlignX) return block.props.heroContentAlignX
  const ta = block.styles.textAlign
  if (ta === 'left') return 'start'
  if (ta === 'right') return 'end'
  return 'center'
}

export function resolveHeroContentAlignY(block: Pick<Block, 'props'>): SectionContentAlign {
  return block.props.heroContentAlignY ?? 'center'
}

/** Flex classes for column content inside hero/banner sections. */
export function heroContentFlexClasses(alignX: SectionContentAlign, alignY: SectionContentAlign): string {
  return `flex flex-col ${heroContentAlignClasses(alignX, alignY, 'column')}`
}

/** items/justify pair for flex column or row (maps align X/Y to main & cross axis). */
export function heroContentAlignClasses(
  alignX: SectionContentAlign,
  alignY: SectionContentAlign,
  direction: 'column' | 'row',
): string {
  const cross = direction === 'column' ? alignX : alignY
  const main = direction === 'column' ? alignY : alignX
  const items = cross === 'start' ? 'items-start' : cross === 'end' ? 'items-end' : 'items-center'
  const justify = main === 'start' ? 'justify-start' : main === 'end' ? 'justify-end' : 'justify-center'
  return `${items} ${justify}`
}

/** Column flex alignment (stacked layout). */
export function heroColLayoutClasses(alignX: SectionContentAlign, alignY: SectionContentAlign): string {
  return `flex flex-col ${heroContentAlignClasses(alignX, alignY, 'column')}`
}

/** Row flex alignment at sm/md+ (side-by-side banner rows). */
export function heroRowLayoutClasses(
  alignX: SectionContentAlign,
  alignY: SectionContentAlign,
  breakpoint: 'sm' | 'md' = 'md',
): string {
  const bp = breakpoint
  const justify =
    alignX === 'start' ? `${bp}:justify-start` : alignX === 'end' ? `${bp}:justify-end` : `${bp}:justify-center`
  const items =
    alignY === 'start' ? `${bp}:items-start` : alignY === 'end' ? `${bp}:items-end` : `${bp}:items-center`
  return `${bp}:flex-row ${justify} ${items}`
}
