/** Shift, Ctrl (Windows/Linux), or ⌘ (Mac) — add/remove from field selection. */
export function isMultiSelectModifier(e: {
  shiftKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
}): boolean {
  return !!(e.shiftKey || e.ctrlKey || e.metaKey)
}

export function isCanvasFieldClickTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null
  if (!node?.closest) return false
  return !!node.closest(
    '[data-text-key], [data-field-layout], [data-content-group], [data-builder-cta-shell], .builder-canvas-text-field',
  )
}

/** Resolve field key from a canvas click (text node, layout wrapper, or CTA shell). */
export function resolveCanvasFieldKeyFromTarget(el: EventTarget | null): string | null {
  const node = el as HTMLElement | null
  if (!node?.closest) return null
  const textEl = node.closest('[data-text-key]') as HTMLElement | null
  if (textEl) return textEl.getAttribute('data-text-key')
  const layoutEl = node.closest('[data-field-layout]') as HTMLElement | null
  return layoutEl?.getAttribute('data-field-layout') ?? null
}
