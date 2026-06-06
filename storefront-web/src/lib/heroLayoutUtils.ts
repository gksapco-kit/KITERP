const GRADIENT_PRESET_CSS: Record<string, string> = {
  'Violet → Indigo': 'linear-gradient(135deg,#1e1b4b,#312e81,#6366f1)',
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
