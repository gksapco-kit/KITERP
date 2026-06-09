/** Builder section image fit / focal point — keyed by prop field (image_url, bg_image_url). */

export type SectionImageFit = 'cover' | 'contain' | 'fill'

export function sectionImageStyleKeys(field: string) {
  if (field === 'bg_image_url') {
    return {
      fit: 'bg_image_fit',
      focalX: 'bg_image_focal_x',
      focalY: 'bg_image_focal_y',
      scale: 'bg_image_scale',
    } as const
  }
  return {
    fit: 'image_fit',
    focalX: 'image_focal_x',
    focalY: 'image_focal_y',
    scale: 'image_scale',
  } as const
}

export function readSectionImageFit(field: string, props: Record<string, unknown>): SectionImageFit {
  const { fit } = sectionImageStyleKeys(field)
  const raw = props[fit]
  return raw === 'contain' || raw === 'fill' ? raw : 'cover'
}

export function readSectionImageFocal(field: string, props: Record<string, unknown>): { x: number; y: number } {
  const { focalX, focalY } = sectionImageStyleKeys(field)
  const x = Number(props[focalX])
  const y = Number(props[focalY])
  return {
    x: Number.isFinite(x) ? Math.min(100, Math.max(0, Math.round(x))) : 50,
    y: Number.isFinite(y) ? Math.min(100, Math.max(0, Math.round(y))) : 50,
  }
}

export function readSectionImageScale(field: string, props: Record<string, unknown>): number {
  const { scale } = sectionImageStyleKeys(field)
  const raw = Number(props[scale])
  return Number.isFinite(raw) ? Math.min(400, Math.max(25, Math.round(raw))) : 100
}

export function sectionImageObjectStyle(field: string, props: Record<string, unknown>): {
  objectFit: SectionImageFit
  objectPosition: string
  transform?: string
  transformOrigin?: string
} {
  const fit = readSectionImageFit(field, props)
  const { x, y } = readSectionImageFocal(field, props)
  const scale = readSectionImageScale(field, props)
  return {
    objectFit: fit,
    objectPosition: `${x}% ${y}%`,
    ...(scale !== 100
      ? { transform: `scale(${scale / 100})`, transformOrigin: `${x}% ${y}%` }
      : {}),
  }
}
