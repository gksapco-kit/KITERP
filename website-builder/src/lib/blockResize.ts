const FULL_WIDTH_SNAP_PX = 16

export function parseSizePx(value?: string): number | null {
  if (!value?.trim()) return null
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/)
  return match ? Number(match[1]) : null
}
const FULL_WIDTH_RATIO = 0.92

/** Usable inner width of the canvas drop zone (minus horizontal padding). */
export function getCanvasContentWidth(fromEl: HTMLElement | null): number {
  const zone = fromEl?.closest('[data-canvas-drop-zone]') as HTMLElement | null
  if (!zone) {
    return fromEl?.parentElement?.clientWidth ?? 0
  }

  const style = getComputedStyle(zone)
  const padL = parseFloat(style.paddingLeft) || 0
  const padR = parseFloat(style.paddingRight) || 0
  return Math.max(0, zone.clientWidth - padL - padR)
}

/**
 * When resized wide enough, return undefined so the block uses full canvas width again.
 */
export function resolveResizedWidth(
  fromEl: HTMLElement | null,
  widthPx: number,
): string | undefined {
  const maxW = getCanvasContentWidth(fromEl)
  if (maxW <= 0) return `${widthPx}px`

  if (widthPx >= maxW - FULL_WIDTH_SNAP_PX || widthPx / maxW >= FULL_WIDTH_RATIO) {
    return undefined
  }

  return `${widthPx}px`
}

export function clampResizeWidth(fromEl: HTMLElement | null, widthPx: number): number {
  const maxW = getCanvasContentWidth(fromEl)
  if (maxW <= 0) return widthPx
  return Math.min(maxW, widthPx)
}
