import type { CSSProperties } from 'react'
import type { Block, BlockProps, BlockStyles, HeroBackgroundMode, TextAlign } from '../types/builder'

export function blockBackgroundStyle(styles: BlockStyles, darkMode = false): CSSProperties {
  if (styles.backgroundMode === 'gradient') {
    return gradientStyle(styles.gradientFrom, styles.gradientTo)
  }
  const bg = styles.backgroundColor
  if (darkMode && !bg?.startsWith('#')) return {}
  if (bg) return { backgroundColor: bg }
  return {}
}

/** Inline typography from Style panel — wins over Tailwind text-* size utilities on the same element */
export function blockTypographyStyle(
  styles: Pick<BlockStyles, 'fontSize' | 'fontWeight' | 'fontFamily' | 'lineHeight' | 'letterSpacing'>,
  role: 'title' | 'body' = 'body',
  defaultsOverride?: Partial<Pick<CSSProperties, 'fontSize' | 'fontWeight' | 'lineHeight'>>,
): CSSProperties {
  const base =
    role === 'title'
      ? { fontSize: '1.875rem', fontWeight: '700', lineHeight: '1.2' }
      : { fontSize: '1rem', fontWeight: '400', lineHeight: '1.5' }
  const defaults = { ...base, ...defaultsOverride }

  return {
    fontSize: styles.fontSize ?? defaults.fontSize,
    fontWeight: styles.fontWeight ?? defaults.fontWeight,
    fontFamily: styles.fontFamily,
    lineHeight: styles.lineHeight ?? defaults.lineHeight,
    letterSpacing: styles.letterSpacing,
  }
}

export function blockStyle(styles: Block['styles'], darkMode = false): CSSProperties {
  const text = styles.textColor
  const photoBg =
    styles.backgroundImage && styles.backgroundMode !== 'gradient'
      ? {
          backgroundImage: `url(${styles.backgroundImage})`,
          backgroundSize: 'cover' as const,
          backgroundPosition: 'center' as const,
        }
      : {}
  return {
    ...blockBackgroundStyle(styles, darkMode),
    ...photoBg,
    color: text || (darkMode ? '#f3f4f6' : undefined),
    padding: styles.padding,
    margin: styles.margin,
    borderRadius: styles.borderRadius,
    textAlign: styles.textAlign as TextAlign | undefined,
    fontSize: styles.fontSize,
    fontWeight: styles.fontWeight,
    fontFamily: styles.fontFamily,
    lineHeight: styles.lineHeight,
    letterSpacing: styles.letterSpacing,
    boxShadow: styles.hideShadow ? 'none' : styles.boxShadow,
    borderWidth: styles.borderWidth,
    borderColor: styles.borderColor,
    borderStyle: styles.borderStyle as CSSProperties['borderStyle'],
    maxWidth: styles.maxWidth,
  }
}

/** Blocks that shrink-wrap instead of stretching full canvas width */
export const INLINE_BLOCK_TYPES = new Set<Block['type']>([
  'button',
  'buttonLink',
  'iconButton',
  'badge',
  'heading',
  'paragraph',
])

export const MULTI_ITEM_BLOCK_TYPES = new Set<Block['type']>([
  'cardGrid',
  'categoryTabs',
  'categoryStack',
  'cardListView',
  'gallery',
  'lightbox',
  'lookbook',
  'productVideoGallery',
  'paymentMethods',
  'secureCheckout',
  'statsCounter',
  'howItWorks',
  'timeline',
  'productTabs',
  'progressBar',
  'commentsSection',
  'pollVoting',
  'mentionsTagging',
  'livePresence',
  'userProfileCard',
  'stepper',
  'wishlist',
  'recentlyViewed',
  'frequentlyBoughtTogether',
  'infiniteScroll',
  'bundleBuilder',
  'multiStepForm',
  'pricingMatrix',
  'dataTable',
  'carousel',
  'imageTitleSlider',
  'slider',
  'testimonial',
  'teamMembers',
  'productListing',
  'faqAccordion',
])

export function isInlineBlockType(type: Block['type']): boolean {
  return INLINE_BLOCK_TYPES.has(type)
}

/** Fixed-position widgets (minimal shell — button renders in a viewport overlay) */
export const OVERLAY_BLOCK_TYPES = new Set<Block['type']>(['backToTop', 'toastNotification', 'cookieBanner', 'modal', 'chatFloat', 'stickyAddToCart', 'offCanvasMenu', 'floatingActionButton', 'cartDrawer'])

export function isOverlayBlockType(type: Block['type']): boolean {
  return OVERLAY_BLOCK_TYPES.has(type)
}

export function isMultiItemBlockType(type: Block['type']): boolean {
  return MULTI_ITEM_BLOCK_TYPES.has(type)
}

export function hasFixedWidth(width?: string): boolean {
  if (!width?.trim()) return false
  return /^\d+(?:\.\d+)?px$/.test(width.trim())
}

export type PageLayoutOptions = {
  nestedInContainer?: boolean
}

/** Page-level blocks span full width by default (not inline, overlay, or container children). */
export function isPageFullWidthBlockType(type: Block['type'], options?: PageLayoutOptions): boolean {
  if (options?.nestedInContainer) return false
  if (isOverlayBlockType(type) || isInlineBlockType(type)) return false
  return true
}

/** Horizontal position of a fixed-width block on the page (separate from text-align inside the block). */
export function blockPagePositionClass(block: Block): string {
  if (!hasFixedWidth(block.styles.width) || isInlineBlockType(block.type)) return ''

  const position = block.styles.textAlign ?? 'center'
  if (position === 'right') return 'ml-auto mr-0'
  if (position === 'left') return 'mr-auto'
  return 'mx-auto'
}

export const HERO_WITH_BG_MODE_TYPES = new Set<Block['type']>([
  'hero',
  'heroCta',
  'promoBanner',
  'gradientBanner',
  'imageBanner',
])

/** Legacy block types merged into Hero; still render and edit correctly */
export const LEGACY_HERO_TYPES = new Set<Block['type']>(['heroBgImage', 'heroGradient', 'heroVideo'])

export const MAIN_HERO_TYPES = new Set<Block['type']>(['hero', ...LEGACY_HERO_TYPES])

export function supportsHeroBackgroundMode(type: Block['type']): boolean {
  return HERO_WITH_BG_MODE_TYPES.has(type) || LEGACY_HERO_TYPES.has(type)
}

export function defaultHeroBackgroundMode(type: Block['type']): HeroBackgroundMode {
  switch (type) {
    case 'heroGradient':
    case 'gradientBanner':
      return 'gradient'
    case 'heroBgImage':
    case 'promoBanner':
    case 'imageBanner':
      return 'image'
    case 'heroVideo':
      return 'video'
    default:
      return 'color'
  }
}

export function getHeroBackgroundMode(block: Block): HeroBackgroundMode {
  return block.props.heroBackgroundMode ?? defaultHeroBackgroundMode(block.type)
}

export function gradientStyle(from?: string, to?: string): CSSProperties {
  return {
    backgroundImage: `linear-gradient(135deg, ${from ?? '#4f46e5'} 0%, ${to ?? '#7c3aed'} 100%)`,
    backgroundColor: 'transparent',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
}

/** Layout/text styles without background fields (inner sections set their own bg) */
export function blockLayoutStyle(styles: Block['styles'], darkMode = false): CSSProperties {
  const full = blockStyle(styles, darkMode)
  const {
    backgroundColor: _bg,
    backgroundImage: _bi,
    backgroundSize: _bs,
    backgroundPosition: _bp,
    ...layout
  } = full
  return layout
}

/** Inner section styles — margin is applied on BlockShell (or full-bleed outer wrap) only. */
export function blockInnerLayoutStyle(styles: Block['styles'], darkMode = false): CSSProperties {
  const { margin: _margin, ...inner } = blockLayoutStyle(styles, darkMode)
  return inner
}

export function blockOuterMarginStyle(styles: Block['styles']): CSSProperties | undefined {
  const margin = styles.margin?.trim()
  if (!margin) return undefined
  return { margin }
}

export function blockShellStyle(
  block: Block,
  darkMode = false,
  options?: PageLayoutOptions,
): CSSProperties {
  if (isOverlayBlockType(block.type)) {
    return { margin: block.styles.margin }
  }

  if (isInlineBlockType(block.type)) {
    return {
      margin: block.styles.margin,
      textAlign: block.styles.textAlign,
      width: block.styles.width,
      maxWidth: block.styles.width || block.styles.maxWidth,
      ...blockTypographyStyle(block.styles, block.type === 'heading' ? 'title' : 'body'),
    }
  }

  if (options?.nestedInContainer) {
    return {
      padding: 0,
      margin: block.styles.margin,
      width: 'auto',
      maxWidth: '100%',
      boxSizing: 'border-box',
    }
  }

  if (isPageFullWidthBlockType(block.type)) {
    const shell: CSSProperties = {
      padding: 0,
      boxSizing: 'border-box',
      maxWidth: '100%',
      width: 'auto',
    }
    if (hasFixedWidth(block.styles.width)) {
      const w = block.styles.width!.trim()
      shell.width = w
      shell.maxWidth = block.styles.maxWidth?.trim() || `min(100%, ${w})`
    } else {
      shell.margin = block.styles.margin
    }
    return shell
  }

  return blockStyle(block.styles, darkMode)
}

/** Styles applied on the inner element for button-like blocks */
export function inlineBlockContentStyle(block: Block): CSSProperties {
  const s = block.styles
  const bg = s.backgroundMode === 'gradient' ? gradientStyle(s.gradientFrom, s.gradientTo) : blockBackgroundStyle(s)
  return {
    ...bg,
    color: s.textColor,
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    padding: s.padding ?? '12px 24px',
    borderRadius: s.borderRadius ?? '8px',
    boxShadow: s.boxShadow,
    borderWidth: s.borderWidth,
    borderColor: s.borderColor,
    borderStyle: s.borderStyle as CSSProperties['borderStyle'],
    display: 'inline-block',
  }
}

export function heroSectionBackgroundStyle(block: Block): CSSProperties {
  const mode = getHeroBackgroundMode(block)
  if (mode === 'gradient') {
    return gradientStyle(block.styles.gradientFrom, block.styles.gradientTo)
  }
  if (mode === 'color') {
    return { backgroundColor: block.styles.backgroundColor ?? '#4f46e5' }
  }
  return {}
}

export function getHeroBackgroundImageUrl(block: Block): string | undefined {
  if (getHeroBackgroundMode(block) !== 'image') return undefined
  const url = (block.props.imageUrl || block.styles.backgroundImage)?.trim()
  return url || undefined
}

const DEFAULT_HERO_VIDEO = 'https://www.youtube.com/embed/dQw4w9WgXcQ'

export function heroModeChangePatch(
  mode: HeroBackgroundMode,
  current?: BlockProps,
): {
  props: Partial<BlockProps>
  styles: Partial<BlockStyles>
} {
  if (mode === 'color') {
    return {
      props: { heroBackgroundMode: 'color', imageUrl: '', videoUrl: '' },
      styles: { backgroundImage: '' },
    }
  }
  if (mode === 'gradient') {
    return {
      props: { heroBackgroundMode: 'gradient', imageUrl: '', videoUrl: '' },
      styles: { backgroundImage: '' },
    }
  }
  if (mode === 'video') {
    return {
      props: {
        heroBackgroundMode: 'video',
        imageUrl: '',
        videoUrl: current?.videoUrl?.trim() || DEFAULT_HERO_VIDEO,
      },
      styles: { backgroundImage: '' },
    }
  }
  return {
    props: { heroBackgroundMode: 'image', videoUrl: '' },
    styles: { backgroundImage: '' },
  }
}

export function getAnimationClass(animation?: string): string {
  if (!animation || animation === 'none') return ''
  const map: Record<string, string> = {
    'fade-in': 'hero-animate-fade-in',
    'slide-up': 'hero-animate-slide-up',
    'zoom-in': 'hero-animate-zoom-in',
  }
  return map[animation] ?? animation
}

/** @deprecated Use getAnimationClass */
export const getHeroAnimationClass = getAnimationClass

export function clampColumns(value: number, min = 2, max = 6): number {
  return Math.min(max, Math.max(min, Math.round(value) || min))
}

export function mergeProps(block: Block, patch: Partial<BlockProps>): BlockProps {
  return { ...block.props, ...patch }
}

export function isBlockVisible(block: Block): boolean {
  return block.props.visible !== false
}

/** @deprecated Use getHeroBackgroundImageUrl when mode is image */
export function getBlockBackgroundImage(block: Block): string | undefined {
  return getHeroBackgroundImageUrl(block)
}

export function responsiveClass(styles: BlockStyles): string {
  const c: string[] = []
  if (styles.hideOnMobile) c.push('hidden md:block')
  if (styles.hideOnDesktop) c.push('block md:hidden')
  return c.join(' ')
}

/** Tailwind grid column classes for 2–6 column layouts */
export function gridColumnClass(columns = 3, variant: 'md' | 'responsive' = 'md'): string {
  const cols = Math.min(6, Math.max(2, Number(columns) || 3))
  if (variant === 'responsive') {
    switch (cols) {
      case 2:
        return 'sm:grid-cols-2'
      case 4:
        return 'sm:grid-cols-2 lg:grid-cols-4'
      case 5:
        return 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
      default:
        return 'sm:grid-cols-2 lg:grid-cols-3'
    }
  }
  switch (cols) {
    case 2:
      return 'md:grid-cols-2'
    case 4:
      return 'md:grid-cols-4'
    case 5:
      return 'md:grid-cols-5'
    case 6:
      return 'md:grid-cols-3 lg:grid-cols-6'
    default:
      return 'md:grid-cols-3'
  }
}
