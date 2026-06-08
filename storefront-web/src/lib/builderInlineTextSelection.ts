export const BUILDER_TYPOGRAPHY_TOOLBAR_ATTR = 'data-builder-typography-toolbar'
export const BUILDER_DESIGN_BAR_CHROME_ATTR = 'data-builder-design-bar-chrome'

export type SavedInlineTextSelection = {
  key: string
  root: HTMLElement
  range: Range
  startOffset: number
  endOffset: number
}

let savedInlineTextSelection: SavedInlineTextSelection | null = null
let lastInlineStyledSpan: { key: string; span: HTMLSpanElement; root: HTMLElement } | null = null
let selectionTrackingInstalled = false

export function getSavedInlineTextSelection(): SavedInlineTextSelection | null {
  return savedInlineTextSelection
}

export function isBuilderTypographyToolbarElement(el: EventTarget | null | undefined): boolean {
  if (!el || !(el instanceof HTMLElement)) return false
  return Boolean(el.closest(`[${BUILDER_TYPOGRAPHY_TOOLBAR_ATTR}], [${BUILDER_DESIGN_BAR_CHROME_ATTR}]`))
}

function findInlineTextRoot(node: Node): { root: HTMLElement; key: string } | null {
  let el: HTMLElement | null = node.nodeType === Node.TEXT_NODE
    ? node.parentElement
    : (node as HTMLElement)
  while (el) {
    const key = el.getAttribute('data-text-key')
    if (key) return { root: el, key }
    el = el.parentElement
  }
  return null
}

function getRangeTextOffsets(root: HTMLElement, range: Range): { start: number; end: number } | null {
  try {
    const probe = document.createRange()
    probe.selectNodeContents(root)
    probe.setEnd(range.startContainer, range.startOffset)
    const start = probe.toString().length
    probe.setEnd(range.endContainer, range.endOffset)
    const end = probe.toString().length
    if (start >= end) return null
    return { start, end }
  } catch {
    return null
  }
}

function createRangeFromTextOffsets(root: HTMLElement, start: number, end: number): Range | null {
  if (start >= end) return null
  const range = document.createRange()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let pos = 0
  let startSet = false
  let node: Node | null = null

  while ((node = walker.nextNode())) {
    const len = node.textContent?.length ?? 0
    if (!startSet && pos + len >= start) {
      range.setStart(node, start - pos)
      startSet = true
    }
    if (startSet && pos + len >= end) {
      range.setEnd(node, end - pos)
      return range
    }
    pos += len
  }
  return null
}

function resolveWorkingRange(saved: SavedInlineTextSelection): Range | null {
  const { root, range, startOffset, endOffset } = saved
  if (!root.isConnected) return null

  try {
    if (
      !range.collapsed
      && root.contains(range.startContainer)
      && root.contains(range.endContainer)
    ) {
      return range.cloneRange()
    }
  } catch {
    // Stale range — fall back to text offsets.
  }

  return createRangeFromTextOffsets(root, startOffset, endOffset)
}

function saveSelectionFromRange(found: { root: HTMLElement; key: string }, range: Range) {
  if (range.collapsed) return
  if (!found.root.contains(range.startContainer) || !found.root.contains(range.endContainer)) return
  const offsets = getRangeTextOffsets(found.root, range)
  if (!offsets) return
  savedInlineTextSelection = {
    key: found.key,
    range: range.cloneRange(),
    root: found.root,
    startOffset: offsets.start,
    endOffset: offsets.end,
  }
  lastInlineStyledSpan = null
}

function syncInlineTextSelectionFromDocument() {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  if (range.collapsed) return
  const found = findInlineTextRoot(range.commonAncestorContainer)
  if (!found) return
  saveSelectionFromRange(found, range)
}

export function ensureInlineTextSelectionTracking() {
  if (selectionTrackingInstalled) return
  selectionTrackingInstalled = true
  document.addEventListener('selectionchange', syncInlineTextSelectionFromDocument)
}

/** Call on typography-toolbar mousedown before focus leaves the canvas field. */
export function pinInlineTextSelectionBeforeToolbarAction() {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  if (range.collapsed) return
  const found = findInlineTextRoot(range.commonAncestorContainer)
  if (!found) return
  saveSelectionFromRange(found, range)
}

export function restoreSavedInlineSelection(): boolean {
  if (!savedInlineTextSelection) return false
  const working = resolveWorkingRange(savedInlineTextSelection)
  if (!working || working.collapsed) return false
  try {
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(working)
    savedInlineTextSelection.range = working.cloneRange()
    return true
  } catch {
    return false
  }
}

export function hasActiveInlineTextSelection(fieldKey?: string | null): boolean {
  if (!savedInlineTextSelection) return false
  if (!savedInlineTextSelection.root.isConnected) return false
  if (savedInlineTextSelection.startOffset >= savedInlineTextSelection.endOffset) return false
  if (fieldKey && savedInlineTextSelection.key !== fieldKey) return false
  return Boolean(resolveWorkingRange(savedInlineTextSelection))
}

export function getSelectionFontSizePx(range: Range): number {
  let node: Node | null = range.startContainer
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
  while (node && node instanceof HTMLElement) {
    const px = parseFloat(window.getComputedStyle(node).fontSize)
    if (px > 0 && Number.isFinite(px)) return Math.round(px)
    node = node.parentElement
  }
  return 16
}

export function rememberInlineTextSelection(root: HTMLElement | null, key: string | null) {
  if (!root || !key) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return
  if (range.collapsed) return
  saveSelectionFromRange({ root, key }, range)
}

function notifyInlineTextCommit(root: HTMLElement) {
  root.dispatchEvent(new CustomEvent('builder-inline-text-commit', { bubbles: true }))
}

function finishInlineStyleApply(key: string, span: HTMLSpanElement, root: HTMLElement) {
  const sel = window.getSelection()
  sel?.removeAllRanges()
  lastInlineStyledSpan = { key, span, root }
  savedInlineTextSelection = null
  notifyInlineTextCommit(root)
}

function stylePatchToCss(patch: Record<string, unknown>): Partial<CSSStyleDeclaration> {
  const css: Partial<CSSStyleDeclaration> = {}
  if (typeof patch.text_color_override === 'string') css.color = patch.text_color_override
  if (typeof patch.font_size_px === 'number' && patch.font_size_px > 0) {
    css.fontSize = `${Math.round(patch.font_size_px)}px`
  }
  if (typeof patch.text_transform === 'string') css.textTransform = patch.text_transform
  if (typeof patch.font_family === 'string' && patch.font_family.trim()) {
    css.fontFamily = patch.font_family.trim()
  }
  return css
}

function findInlineStyleSpanForRange(range: Range): HTMLSpanElement | null {
  let node: Node | null = range.commonAncestorContainer
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
  if (node instanceof HTMLSpanElement && node.getAttribute('data-inline-style')) return node
  return null
}

export function applyPatchToLastStyledSpan(
  key: string | null | undefined,
  patch: Record<string, unknown>,
): boolean {
  if (!key || !lastInlineStyledSpan || lastInlineStyledSpan.key !== key) return false
  const { span, root } = lastInlineStyledSpan
  if (!span.isConnected || !root.isConnected) {
    lastInlineStyledSpan = null
    return false
  }
  const css = stylePatchToCss(patch)
  if (!css.color && !css.fontSize && !css.textTransform && !css.fontFamily) return false
  if (css.color) span.style.color = css.color
  if (css.fontSize) span.style.fontSize = css.fontSize
  if (css.textTransform) span.style.textTransform = css.textTransform
  if (css.fontFamily) span.style.fontFamily = css.fontFamily
  notifyInlineTextCommit(root)
  return true
}

export function applyInlineTextSelectionStyle(
  key: string | null | undefined,
  patch: Record<string, unknown>,
): boolean {
  if (!key || !savedInlineTextSelection || savedInlineTextSelection.key !== key) return false
  const { root } = savedInlineTextSelection
  if (!root.isConnected) return false

  restoreSavedInlineSelection()
  const working = resolveWorkingRange(savedInlineTextSelection)
  if (!working || working.collapsed || !root.contains(working.commonAncestorContainer)) return false

  const css = stylePatchToCss(patch)
  if (!css.color && !css.fontSize && !css.textTransform && !css.fontFamily) return false

  const existingSpan = findInlineStyleSpanForRange(working)
  if (existingSpan && working.toString() === existingSpan.textContent) {
    if (css.color) existingSpan.style.color = css.color
    if (css.fontSize) existingSpan.style.fontSize = css.fontSize
    if (css.textTransform) existingSpan.style.textTransform = css.textTransform
    if (css.fontFamily) existingSpan.style.fontFamily = css.fontFamily
    finishInlineStyleApply(key, existingSpan, root)
    return true
  }

  const span = document.createElement('span')
  if (css.color) span.style.color = css.color
  if (css.fontSize) span.style.fontSize = css.fontSize
  if (css.textTransform) span.style.textTransform = css.textTransform
  if (css.fontFamily) span.style.fontFamily = css.fontFamily
  span.setAttribute('data-inline-style', 'true')

  try {
    const fragment = working.extractContents()
    span.appendChild(fragment)
    working.insertNode(span)
    finishInlineStyleApply(key, span, root)
    return true
  } catch {
    return false
  }
}

export function getLastInlineStyledSpan() {
  return lastInlineStyledSpan
}
