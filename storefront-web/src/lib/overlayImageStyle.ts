/** Zoom / object-fit for overlay image layers (builder + preview). */

import type { CSSProperties } from 'react'

export function readOverlayImageScale(item: { imageScale?: number | null }): number {
  const raw = Number(item.imageScale)
  return Number.isFinite(raw) ? Math.min(400, Math.max(25, Math.round(raw))) : 100
}

export function overlayImageImgStyle(item: {
  objectFit?: 'cover' | 'contain' | 'fill' | string
  borderRadius?: number
  imageScale?: number | null
}): CSSProperties {
  const scale = readOverlayImageScale(item)
  return {
    width: '100%',
    height: '100%',
    objectFit: (item.objectFit || 'cover') as CSSProperties['objectFit'],
    borderRadius: item.borderRadius || 0,
    ...(scale !== 100 ? { transform: `scale(${scale / 100})`, transformOrigin: 'center center' } : {}),
  }
}
