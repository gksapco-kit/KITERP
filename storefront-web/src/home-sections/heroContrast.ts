import { hexToRgb, relativeLuminance, textOnSolid } from '@/lib/themeColors'

export { textOnSolid }

function isLightBrand(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return false
  return relativeLuminance(rgb.r, rgb.g, rgb.b) > 0.45
}

/** Overlay for photo heroes — blends brand colors with a readable dark scrim. */
export function heroPhotoOverlay(primary: string, secondary: string): string {
  if (isLightBrand(primary)) {
    return `linear-gradient(105deg, ${secondary}ee 0%, rgba(15, 23, 42, 0.82) 42%, rgba(15, 23, 42, 0.88) 100%)`
  }
  return `linear-gradient(105deg, ${secondary}e8 0%, ${primary}cc 38%, rgba(15, 23, 42, 0.78) 100%)`
}

/** Gradient hero without a photo. */
export function heroBrandGradient(primary: string, secondary: string): string {
  if (isLightBrand(primary)) {
    return `linear-gradient(135deg, ${secondary} 0%, ${primary} 55%, ${secondary} 100%)`
  }
  return `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`
}

/** Extra dimming when a banner sits under a gradient hero. */
export function heroBannerDimOverlay(primary: string, secondary: string): string {
  if (isLightBrand(primary)) {
    return `linear-gradient(135deg, rgba(15, 23, 42, 0.55) 0%, rgba(15, 23, 42, 0.72) 100%)`
  }
  return `linear-gradient(135deg, ${primary}dd 0%, ${secondary}cc 55%, rgba(15, 23, 42, 0.68) 100%)`
}
