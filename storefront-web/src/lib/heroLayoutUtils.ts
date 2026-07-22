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

/** Map historically-saved `bg_image_*` crop/style keys onto `image_*` for side-image heroes. */
const SIDE_IMAGE_STYLE_MIGRATE: Array<[bgKey: string, imageKey: string]> = [
  ['bg_image_fit', 'image_fit'],
  ['bg_image_focal_x', 'image_focal_x'],
  ['bg_image_focal_y', 'image_focal_y'],
  ['bg_image_scale', 'image_scale'],
  ['bg_image_radius', 'image_radius'],
  ['bg_image_shadow', 'image_shadow'],
  ['bg_image_opacity', 'image_opacity'],
  ['bg_image_layer', 'image_layer'],
  ['bg_image_overlay', 'image_overlay'],
]

/**
 * Side-image heroes render `image_url` + `image_*`. Older data may still store the photo
 * under `bg_image_url` / `bg_image_*` — migrate so crop/fit/zoom actually apply.
 */
export function normalizeHeroSideImageProps(
  blockType: string,
  props: Record<string, unknown>,
): Record<string, unknown> {
  if (!heroUsesSideImage(blockType, props)) return props
  const next = { ...props }
  let changed = false

  if (!next.image_url && typeof next.bg_image_url === 'string' && next.bg_image_url) {
    next.image_url = next.bg_image_url
    changed = true
  }

  for (const [bgKey, imageKey] of SIDE_IMAGE_STYLE_MIGRATE) {
    if (next[imageKey] == null && next[bgKey] != null) {
      next[imageKey] = next[bgKey]
      changed = true
    }
  }

  if (next.bg_image_url != null) {
    delete next.bg_image_url
    changed = true
  }
  for (const [bgKey] of SIDE_IMAGE_STYLE_MIGRATE) {
    if (bgKey in next) {
      delete next[bgKey]
      changed = true
    }
  }

  return changed ? next : props
}
