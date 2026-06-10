import type { CSSProperties } from 'react'

export type MediaAdjustmentsState = {
  brightness: number
  contrast: number
  saturation: number
  sharpness: number
  remove_background: boolean
  color_grade: string | null
  ai_enhance: boolean
  grayscale: boolean
  blur: number
  overlay: string | null
}

export const DEFAULT_MEDIA_ADJUSTMENTS: MediaAdjustmentsState = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  sharpness: 0,
  remove_background: false,
  color_grade: null,
  ai_enhance: false,
  grayscale: false,
  blur: 0,
  overlay: null,
}

function colorGradeFilter(grade: string | null): string {
  switch (grade) {
    case 'cinematic': return 'contrast(1.18) saturate(0.88) brightness(0.96) sepia(0.08)'
    case 'vivid': return 'saturate(1.55) contrast(1.12) brightness(1.02)'
    case 'matte': return 'contrast(0.9) saturate(0.78) brightness(1.06)'
    case 'vintage': return 'sepia(0.42) contrast(0.92) saturate(0.8) brightness(1.04)'
    case 'cool': return 'saturate(0.92) hue-rotate(18deg) brightness(1.03) contrast(1.05)'
    case 'warm': return 'sepia(0.22) saturate(1.15) brightness(1.04) contrast(1.02)'
    case 'faded': return 'contrast(0.86) saturate(0.65) brightness(1.1)'
    default: return ''
  }
}

/** CSS filter string for live preview and canvas rendering. */
export function adjustmentsCssFilter(a: MediaAdjustmentsState): string {
  const sharpBoost = a.sharpness > 0 ? `contrast(${100 + Math.round(a.sharpness * 0.35)}%)` : ''
  return [
    `brightness(${a.brightness}%)`,
    `contrast(${a.contrast}%)`,
    `saturate(${a.saturation}%)`,
    a.blur ? `blur(${a.blur}px)` : '',
    a.grayscale ? 'grayscale(1)' : '',
    colorGradeFilter(a.color_grade),
    sharpBoost,
  ].filter(Boolean).join(' ')
}

/** Overlay layer for the in-modal live preview. */
export function overlayPreviewStyle(overlay: string | null): CSSProperties | undefined {
  if (!overlay) return undefined
  switch (overlay) {
    case 'dark':
      return { backgroundColor: 'rgba(0,0,0,0.38)' }
    case 'light':
      return { backgroundColor: 'rgba(255,255,255,0.28)' }
    case 'gradient_down':
      return { background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.62) 100%)' }
    case 'gradient_up':
      return { background: 'linear-gradient(to top, transparent 0%, rgba(0,0,0,0.62) 100%)' }
    case 'vignette':
      return { background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.65) 100%)' }
    default:
      return undefined
  }
}

export function isDefaultAdjustments(a: MediaAdjustmentsState): boolean {
  return (
    a.brightness === DEFAULT_MEDIA_ADJUSTMENTS.brightness
    && a.contrast === DEFAULT_MEDIA_ADJUSTMENTS.contrast
    && a.saturation === DEFAULT_MEDIA_ADJUSTMENTS.saturation
    && a.sharpness === DEFAULT_MEDIA_ADJUSTMENTS.sharpness
    && a.blur === DEFAULT_MEDIA_ADJUSTMENTS.blur
    && !a.remove_background
    && !a.ai_enhance
    && !a.grayscale
    && !a.color_grade
    && !a.overlay
  )
}

export function adjustmentsNeedServerAi(a: MediaAdjustmentsState): boolean {
  return a.remove_background || a.ai_enhance
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image for preview'))
    img.src = src
  })
}

function paintOverlayOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  overlay: string | null,
) {
  if (!overlay) return
  switch (overlay) {
    case 'dark':
      ctx.fillStyle = 'rgba(0,0,0,0.38)'
      ctx.fillRect(0, 0, width, height)
      break
    case 'light':
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      ctx.fillRect(0, 0, width, height)
      break
    case 'gradient_down': {
      const g = ctx.createLinearGradient(0, 0, 0, height)
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(1, 'rgba(0,0,0,0.62)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, width, height)
      break
    }
    case 'gradient_up': {
      const g = ctx.createLinearGradient(0, height, 0, 0)
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(1, 'rgba(0,0,0,0.62)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, width, height)
      break
    }
    case 'vignette': {
      const g = ctx.createRadialGradient(
        width / 2, height / 2, Math.min(width, height) * 0.2,
        width / 2, height / 2, Math.max(width, height) * 0.72,
      )
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(1, 'rgba(0,0,0,0.65)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, width, height)
      break
    }
    default:
      break
  }
}

/** Bake sliders, color grade, grayscale, blur, sharpness, and overlay into a new image file. */
export async function renderAdjustedImageFile(
  sourceUrl: string,
  adjustments: MediaAdjustmentsState,
  fileName = 'adjusted.jpg',
): Promise<File> {
  const img = await loadImage(sourceUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  ctx.filter = adjustmentsCssFilter(adjustments)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  ctx.filter = 'none'
  paintOverlayOnCanvas(ctx, canvas.width, canvas.height, adjustments.overlay)

  const mimeType = fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
  const quality = mimeType === 'image/jpeg' ? 0.92 : undefined
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('Could not export adjusted image'))),
      mimeType,
      quality,
    )
  })

  const safeName = fileName.includes('.') ? fileName : `${fileName}.jpg`
  return new File([blob], safeName.replace(/\.[^.]+$/, '') + (mimeType === 'image/png' ? '.png' : '.jpg'), { type: mimeType })
}
