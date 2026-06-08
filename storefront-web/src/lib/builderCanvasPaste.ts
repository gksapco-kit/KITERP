/** Normalize clipboard plain text for canvas fields. */
export function normalizeClipboardPlainText(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\u2028/g, '\n').replace(/\u00a0/g, ' ')
}

export type CanvasTextClipboardAction = 'cut' | 'copy' | 'paste'

/** Resolve the on-canvas text field element for clipboard actions. */
export function resolveCanvasTextFieldEl(
  blockId?: string | null,
  fieldKey?: string | null,
): HTMLElement | null {
  const editingEl = document.querySelector('[data-builder-inline-edit-target="true"]') as HTMLElement | null
  if (editingEl?.getAttribute('data-text-key')) return editingEl

  if (blockId && fieldKey) {
    const blockEl = document.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`)
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
  } else if (sel.rangeCount === 0) {
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    sel.addRange(range)
  }
  document.execCommand('insertText', false, text)
}

export function readPlainTextFromClipboardEvent(e: { clipboardData: DataTransfer }): string {
  const plain = e.clipboardData.getData('text/plain')
  if (plain) return normalizeClipboardPlainText(plain)
  const html = e.clipboardData.getData('text/html')
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return normalizeClipboardPlainText(doc.body.textContent || '')
}
