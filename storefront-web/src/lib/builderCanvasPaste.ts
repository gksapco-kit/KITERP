/** Normalize clipboard plain text for canvas fields. */
export function normalizeClipboardPlainText(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\u2028/g, '\n').replace(/\u00a0/g, ' ')
}

export type CanvasTextClipboardAction = 'cut' | 'copy' | 'paste'

/** True when clipboard shortcuts should target the canvas (not props panel / modals). */
export function isBuilderCanvasClipboardTarget(target: EventTarget | null): boolean {
  const node = target instanceof Node ? target : null
  const fromTarget = node instanceof HTMLElement
    ? node
    : node?.parentElement
  if (fromTarget?.closest('[data-page-canvas]')) return true
  if (fromTarget?.closest('[data-builder-inline-edit-target]')) return true

  const active = document.activeElement
  if (active instanceof HTMLElement) {
    if (active.closest('[data-page-canvas]')) return true
    if (active.closest('[data-builder-inline-edit-target]')) return true
    if (active.hasAttribute('data-builder-inline-edit-target')) return true
  }
  return false
}

/** Copy plain text to the OS clipboard (Clipboard API + textarea fallback). */
export async function copyTextToSystemClipboard(text: string): Promise<boolean> {
  if (!text) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // fall through to execCommand fallback
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;outline:none;box-shadow:none;background:transparent'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function blurCanvasInlineTextEdit(): void {
  const el = document.querySelector('[data-builder-inline-edit-target="true"]') as HTMLElement | null
  el?.blur()
}

/** Resolve the on-canvas text field element for clipboard actions. */
export function resolveCanvasTextFieldEl(
  blockId?: string | null,
  fieldKey?: string | null,
): HTMLElement | null {
  const editingEl = document.querySelector('[data-builder-inline-edit-target="true"]') as HTMLElement | null
  if (editingEl?.getAttribute('data-text-key')) return editingEl

  if (blockId && fieldKey) {
    const escapedId = CSS.escape(blockId)
    const blockEl = document.querySelector(
      `[data-block-id="${escapedId}"], [data-sf-bid="${escapedId}"], [data-bid="${escapedId}"]`,
    )
    const fieldEl = blockEl?.querySelector(`[data-text-key="${CSS.escape(fieldKey)}"]`) as HTMLElement | null
    if (fieldEl) return fieldEl
  }

  return document.querySelector('[data-builder-text-active="true"]') as HTMLElement | null
}

/** Dispatch a clipboard action to the target canvas text field. */
export function dispatchCanvasTextClipboardAction(
  action: CanvasTextClipboardAction,
  blockId?: string | null,
  fieldKey?: string | null,
): boolean {
  const fieldEl = resolveCanvasTextFieldEl(blockId, fieldKey)
  if (!fieldEl) return false
  fieldEl.dispatchEvent(new CustomEvent('builder-canvas-clipboard', {
    bubbles: false,
    detail: { action },
  }))
  return true
}

/** Select all text inside a canvas field. */
export function selectAllElementContents(el: HTMLElement): void {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.selectNodeContents(el)
  sel.removeAllRanges()
  sel.addRange(range)
}

/** Read selected text in an element, or all text when the selection is collapsed. */
export function readSelectedTextInElement(el: HTMLElement): string {
  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0)
    if (el.contains(range.commonAncestorContainer) && !range.collapsed) {
      return normalizeClipboardPlainText(range.toString())
    }
  }
  return normalizeClipboardPlainText(el.innerText || el.textContent || '')
}

/** Write plain text into a copy/cut clipboard event (sync — updates OS clipboard). */
export function writeTextToClipboardEvent(
  e: { clipboardData: DataTransfer },
  text: string,
): void {
  e.clipboardData.setData('text/plain', text)
}

/** Copy field text to the OS clipboard. */
export async function copyFromElement(el: HTMLElement, selectAllIfCollapsed = true): Promise<boolean> {
  el.focus({ preventScroll: true })
  const sel = window.getSelection()
  let hasSelection = false
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0)
    hasSelection = el.contains(range.commonAncestorContainer) && !range.collapsed
  }
  if (!hasSelection && selectAllIfCollapsed) {
    selectAllElementContents(el)
  }
  const text = readSelectedTextInElement(el)
  if (!text) return false
  return copyTextToSystemClipboard(text)
}

/** Cut field text to the OS clipboard. */
export async function cutFromElement(el: HTMLElement, selectAllIfCollapsed = true): Promise<boolean> {
  el.focus({ preventScroll: true })
  const sel = window.getSelection()
  if (!sel) return false
  if (sel.rangeCount === 0 || sel.getRangeAt(0).collapsed) {
    if (!selectAllIfCollapsed) return false
    selectAllElementContents(el)
  }
  const text = readSelectedTextInElement(el)
  if (!text) return false
  if (!await copyTextToSystemClipboard(text)) return false
  if (sel.rangeCount > 0) {
    sel.getRangeAt(0).deleteContents()
  }
  return true
}

/** Insert plain text at the current selection (or replace all content). */
export function insertPlainTextInElement(
  el: HTMLElement,
  text: string,
  opts?: { replaceAll?: boolean },
): void {
  el.focus()
  const sel = window.getSelection()
  if (!sel) return
  if (opts?.replaceAll) {
    const range = document.createRange()
    range.selectNodeContents(el)
    sel.removeAllRanges()
    sel.addRange(range)
    range.deleteContents()
  } else if (sel.rangeCount === 0) {
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    sel.addRange(range)
  }

  try {
    if (document.execCommand('insertText', false, text)) return
  } catch {
    // execCommand can throw in some browsers
  }

  if (!sel.rangeCount) return
  const range = sel.getRangeAt(0)
  range.deleteContents()
  const parts = text.split('\n')
  parts.forEach((part, index) => {
    if (part) {
      const node = document.createTextNode(part)
      range.insertNode(node)
      range.setStartAfter(node)
    }
    if (index < parts.length - 1) {
      const br = document.createElement('br')
      range.insertNode(br)
      range.setStartAfter(br)
    }
  })
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

export function readPlainTextFromClipboardEvent(e: { clipboardData: DataTransfer }): string {
  const plain = e.clipboardData.getData('text/plain')
  if (plain) return normalizeClipboardPlainText(plain)
  const html = e.clipboardData.getData('text/html')
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return normalizeClipboardPlainText(doc.body.textContent || '')
}
