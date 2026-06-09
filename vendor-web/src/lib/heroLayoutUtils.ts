/** Shared hero layout helpers — builder canvas, layout picker, and image wiring. */

const GRADIENT_PRESET_CSS: Record<string, string> = {
  'Violet → Indigo': 'linear-gradient(135deg,#1e1b4b,#312e81,#6366f1)',
  'Mint Spice': 'linear-gradient(135deg,#64C3A0,#13624A)',
  Ocean: 'linear-gradient(135deg,#0ea5e9,#6366f1)',
  Sunset: 'linear-gradient(135deg,#f59e0b,#ef4444)',
  Forest: 'linear-gradient(135deg,#10b981,#065f46)',
  'Night Sky': 'linear-gradient(135deg,#1e1b4b,#312e81,#13624A)',
  Midnight: 'linear-gradient(135deg,#0f172a,#1e293b)',
}

export function resolveGradientCss(
  preset: string | undefined,
  primaryColor: string,
  secondaryColor: string,
): string {
  if (!preset) return `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
  if (preset.startsWith('linear-gradient')) return preset
  return GRADIENT_PRESET_CSS[preset] || `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
}

export function heroUsesSideImage(blockType: string, props: Record<string, unknown>): boolean {
  const layout = String(props.layout ?? '')
  if (blockType === 'hero_split') return true
  if (layout === 'split' || layout === 'overlap' || layout === 'stacked') return true
  if (blockType === 'hero_minimal' && props.show_image === true) return true
  return false
}

/** Full-bleed background photo (centered / image-backdrop heroes). */
export function heroUsesBackgroundImage(blockType: string, props: Record<string, unknown>): boolean {
  if (heroUsesSideImage(blockType, props)) return false
  const bgStyle = String(props.bg_style ?? '')
  if (bgStyle === 'image') return true
  if (bgStyle === 'gradient' && props.overlay !== false) return true
  return false
}

export function heroShouldUseFullBleedImage(
  blockType: string,
  props: Record<string, unknown>,
  hasBgImage: boolean,
): boolean {
  return hasBgImage && heroUsesBackgroundImage(blockType, props)
}

/** Which top-level prop receives a section image upload (matches HeroBlock + props panel). */
export function resolveBlockPrimaryImageField(
  blockType: string,
  props: Record<string, unknown>,
  blockImageFieldMap: Record<string, string> = {},
): string {
  if (blockType.includes('hero')) {
    if (heroUsesSideImage(blockType, props)) return 'image_url'
    if (heroUsesBackgroundImage(blockType, props)) return 'bg_image_url'
    return 'bg_image_url'
  }
  if (blockImageFieldMap[blockType]) return blockImageFieldMap[blockType]
  if (blockType.includes('banner')) return 'bg_image_url'
  return 'image_url'
}
