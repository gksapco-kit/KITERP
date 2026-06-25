/** In-memory clipboard for canvas overlay layers (cut / copy / paste across sections). */

export type OverlayClipboardPayload = {
  item: Record<string, unknown>
  mode: 'copy' | 'cut'
  sourceBlockId: string
  sourceOverlayId: string
}

let clipboard: OverlayClipboardPayload | null = null

export function newOverlayId(): string {
  return `ov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function cloneOverlayForPaste(
  source: Record<string, unknown>,
  offset = { x: 16, y: 16 },
): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(source)) as Record<string, unknown>
  delete clone.id
  const x = Number(clone.x) || 0
  const y = Number(clone.y) || 0
  return {
    ...clone,
    id: newOverlayId(),
    x: x + offset.x,
    y: y + offset.y,
  }
}

export function setOverlayClipboard(
  item: Record<string, unknown>,
  mode: 'copy' | 'cut',
  sourceBlockId: string,
): void {
  clipboard = {
    item: JSON.parse(JSON.stringify(item)),
    mode,
    sourceBlockId,
    sourceOverlayId: String(item.id),
  }
}

export function getOverlayClipboard(): OverlayClipboardPayload | null {
  return clipboard
}

export function clearOverlayClipboard(): void {
  clipboard = null
}

export function hasOverlayClipboard(): boolean {
  return clipboard != null
}

/** After a cut-paste, the source layer is already removed on cut — clear so paste is one-shot. */
export function consumeOverlayClipboardAfterPaste(): void {
  if (clipboard?.mode === 'cut') clipboard = null
}
