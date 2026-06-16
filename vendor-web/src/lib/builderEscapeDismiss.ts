/** Canvas / panel UI state cleared progressively with Escape (one layer per press). */
export type BuilderEscapeUiState = {
  formatPaintActive: boolean
  armedDeleteActive: boolean
  overlayImageActive: boolean
  canvasImageActive: boolean
  storePopoverOpen: boolean
  hasActiveTextTarget: boolean
  hasSelectedBlock: boolean
}

export type BuilderEscapeActions = {
  clearFormatPaint: () => void
  clearArmedDelete: () => void
  clearOverlayImage: () => void
  clearCanvasImage: () => void
  closeStorePopover: () => void
  clearActiveTextTarget: () => void
  clearSelectedBlock: () => void
}

function isTypingOutsideFloatingUi(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable
  if (!typing) return false
  return !el.closest('[data-builder-floating-ui], [data-builder-inline-editor], [data-kiterp-modal]')
}

/** Dismiss the topmost builder layer. Returns true when Escape was consumed. */
export function dismissBuilderEscapeLayer(
  state: BuilderEscapeUiState,
  actions: BuilderEscapeActions,
): boolean {
  if (isTypingOutsideFloatingUi()) {
    ;(document.activeElement as HTMLElement)?.blur()
    return true
  }

  if (state.formatPaintActive) {
    actions.clearFormatPaint()
    return true
  }
  if (state.armedDeleteActive) {
    actions.clearArmedDelete()
    return true
  }
  if (state.overlayImageActive) {
    actions.clearOverlayImage()
    return true
  }
  if (state.canvasImageActive) {
    actions.clearCanvasImage()
    return true
  }
  if (state.storePopoverOpen) {
    actions.closeStorePopover()
    return true
  }
  if (state.hasActiveTextTarget) {
    actions.clearActiveTextTarget()
    return true
  }
  if (state.hasSelectedBlock) {
    actions.clearSelectedBlock()
    return true
  }

  return false
}
