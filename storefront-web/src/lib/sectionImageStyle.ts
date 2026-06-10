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

/** Per-item image style keys stored on array entries (categories[i], images[i], …). */
export const ARRAY_ITEM_IMAGE_STYLE_KEYS = {
  fit: 'image_fit',
  focalX: 'image_focal_x',
  focalY: 'image_focal_y',
  scale: 'image_scale',
} as const

export function arrayItemHasOwnImageStyle(item: Record<string, unknown>): boolean {
  return (
    item.image_fit != null
    || item.image_focal_x != null
    || item.image_focal_y != null
    || item.image_scale != null
  )
}

/** Read fit / focal / zoom for one array slot — item overrides, else section-level defaults. */
export function readArrayItemImageStyleProps(
  item: Record<string, unknown>,
  blockProps: Record<string, unknown>,
  sectionField: string,
): Record<string, unknown> {
  if (arrayItemHasOwnImageStyle(item)) return item
  const keys = sectionImageStyleKeys(sectionField)
  return {
    ...item,
    image_fit: blockProps[keys.fit],
    image_focal_x: blockProps[keys.focalX],
    image_focal_y: blockProps[keys.focalY],
    image_scale: blockProps[keys.scale],
  }
}

export function readArrayItemFromBlockProps(
  blockProps: Record<string, unknown>,
  arrayKey: string,
  index: number,
): Record<string, unknown> {
  const arr = blockProps[arrayKey]
  if (!Array.isArray(arr) || index < 0 || index >= arr.length) return {}
  const item = arr[index]
  return item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
}

export function patchArrayItemImageStyle(
  blockProps: Record<string, unknown>,
  arrayKey: string,
  index: number,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const arr = [...((blockProps[arrayKey] as unknown[]) || [])]
  while (arr.length <= index) arr.push({})
  const prev = arr[index] && typeof arr[index] === 'object'
    ? (arr[index] as Record<string, unknown>)
    : {}
  arr[index] = { ...prev, ...patch }
  return { [arrayKey]: arr }
}

export type ArrayImageSlotRef = { arrayKey: string; index: number; itemField: string }

/** Apply zoom / pan / fit patch to several array slots in one update. */
export function patchMultipleArrayItemImageStyles(
  blockProps: Record<string, unknown>,
  slots: ArrayImageSlotRef[],
  patch: Record<string, unknown>,
): Record<string, unknown> {
  if (!slots.length) return {}
  const arrayKey = slots[0].arrayKey
  const arr = [...((blockProps[arrayKey] as unknown[]) || [])]
  for (const slot of slots) {
    while (arr.length <= slot.index) arr.push({})
    const prev = arr[slot.index] && typeof arr[slot.index] === 'object'
      ? (arr[slot.index] as Record<string, unknown>)
      : {}
    arr[slot.index] = { ...prev, ...patch }
  }
  return { [arrayKey]: arr }
}
