/**
 * Which design-bar features apply to a section type.
 * Defaults are permissive so new block types from the catalog get full tabs without code changes.
 */

export const GLOBAL_STRUCTURE_BLOCK_TYPES = new Set([
  'announcement_bar',
  'nav',
  'footer',
])

export function isGlobalStructureBlock(blockType: string): boolean {
  return GLOBAL_STRUCTURE_BLOCK_TYPES.has(blockType)
}

/** General / Visual / Media tabs — all canvas sections, including future catalog types. */
export function sectionSupportsDesignBarTabs(_blockType: string): boolean {
  return true
}

/** Clip shapes on primary photo / video (`media_clip` prop). */
export function sectionSupportsMediaClip(_blockType: string): boolean {
  return true
}

/** Background style presets (`bg_style` prop). */
export function sectionSupportsBgStyle(_blockType: string): boolean {
  return true
}

/** Scroll entrance animation on the section. */
export function sectionSupportsScrollAnimation(_blockType: string): boolean {
  return true
}

/** Top / bottom edge shapes (Origins). */
export function sectionSupportsEdgeShapes(blockType: string): boolean {
  return !isGlobalStructureBlock(blockType)
}

/** Block shadow presets. */
export function sectionSupportsBlockShadow(_blockType: string): boolean {
  return true
}

/** Overlay layers (text, image, icon, button…). */
export function sectionSupportsOverlays(_blockType: string): boolean {
  return true
}

/** “All content” nudge scope for hero-style content groups. */
export function sectionSupportsContentGroupTransform(blockType: string): boolean {
  return !isGlobalStructureBlock(blockType)
}

/** Inline typography + transform when a text field is active. */
export function sectionSupportsFieldTypography(_blockType: string): boolean {
  return !isGlobalStructureBlock(blockType)
}

export const BLOCK_PRIMARY_IMAGE_FIELD: Record<string, string> = {
  hero: 'bg_image_url',
  hero_split: 'image_url',
  hero_minimal: 'bg_image_url',
  nav: 'brand_logo',
  about_split: 'image_url',
  about_timeline: 'image_url',
  image_block: 'image_url',
  video_embed: 'thumbnail_url',
  product_grid: 'cover_image_url',
  cta: 'bg_image_url',
}

/** Primary image prop for section-image / media tools (best-effort for any block type). */
export function sectionPrimaryImageField(
  blockType: string,
  props: Record<string, unknown>,
): string | null {
  if (isGlobalStructureBlock(blockType) && blockType !== 'nav') return null
  if (BLOCK_PRIMARY_IMAGE_FIELD[blockType]) return BLOCK_PRIMARY_IMAGE_FIELD[blockType]
  if (blockType.includes('hero')) {
    const layout = String(props.layout ?? '')
    if (blockType === 'hero_split' || layout === 'split' || layout === 'overlap' || layout === 'stacked') {
      return 'image_url'
    }
    if (String(props.bg_style ?? '') === 'image' || props.bg_image_url) return 'bg_image_url'
    if (props.image_url && !props.bg_image_url) return 'image_url'
    return 'bg_image_url'
  }
  if (blockType.includes('banner')) return 'bg_image_url'
  if (props.bg_image_url != null || String(props.bg_style ?? '') === 'image') return 'bg_image_url'
  if (props.image_url != null) return 'image_url'
  if (blockType === 'image_block' || blockType.includes('gallery') || blockType.includes('image')) {
    return 'image_url'
  }
  if (blockType === 'video_embed') return props.thumbnail_url != null ? 'thumbnail_url' : 'thumbnail_url'
  return null
}
