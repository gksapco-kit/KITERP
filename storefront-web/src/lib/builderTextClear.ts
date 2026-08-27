import { hasInlineHtml } from '@/lib/fieldTextStyles'

export type TextClearAction = 'all' | 'formats' | 'contents' | 'hyperlinks' | 'removeHyperlinks'

/** Typography / layout keys cleared by Excel-style actions. */
export const FIELD_TYPOGRAPHY_CLEAR_KEYS = [
  'font_size_px',
  'text_scale',
  'text_color_override',
  'font_family',
  'font_style',
  'font_weight',
  'text_transform',
  'text_align',
  'vertical_align',
  'text_wrap',
  'line_height_ratio',
  'paragraph_space_before_px',
  'paragraph_space_after_px',
] as const

export const FIELD_LAYOUT_CLEAR_KEYS = [
  'field_offset_x',
  'field_offset_y',
  'field_width_pct',
  'field_min_height',
  'flip_h',
  'flip_v',
  'rotate_deg',
] as const

export const FIELD_ALL_CLEAR_KEYS = [
  ...FIELD_TYPOGRAPHY_CLEAR_KEYS,
  ...FIELD_LAYOUT_CLEAR_KEYS,
] as const

const CTA_URL_FIELD_BY_LABEL: Record<string, string> = {
  cta_primary: 'cta_primary_url',
  cta_secondary: 'cta_secondary_url',
  cta_label: 'cta_url',
  cta: 'cta_url',
}

export function ctaUrlPropForFieldKey(fieldKey: string): string | null {
  const leaf = fieldKey.includes('.') ? fieldKey.split('.').pop()! : fieldKey
  return CTA_URL_FIELD_BY_LABEL[leaf] ?? null
}

export function omitKeys<T extends Record<string, unknown>>(
  source: T,
  keys: readonly string[],
): T {
  const out = { ...source }
  keys.forEach(k => {
    delete out[k]
  })
  return out
}

function unwrapElement(el: Element) {
  const parent = el.parentNode
  if (!parent) return
  while (el.firstChild) parent.insertBefore(el.firstChild, el)
  parent.removeChild(el)
}

function stripFormattingFromSubtree(root: HTMLElement, removeLinks: boolean, stripLinkFormats: boolean) {
  root.querySelectorAll('[data-inline-style]').forEach(span => unwrapElement(span))

  root.querySelectorAll('[style]').forEach(el => {
    if (el === root) return
    el.removeAttribute('style')
  })

  root.querySelectorAll('font').forEach(el => unwrapElement(el))

  const links = [...root.querySelectorAll('a')]
  links.forEach(a => {
    if (removeLinks) {
      if (stripLinkFormats) {
        const text = a.textContent || ''
        a.replaceWith(document.createTextNode(text))
      } else {
        unwrapElement(a)
      }
    }
  })
}

/** Strip inline HTML formatting; optionally unwrap links. */
export function normalizeHtmlContent(
  html: string,
  opts?: { unwrapLinks?: boolean; stripLinkFormats?: boolean },
): string {
  if (!html || !hasInlineHtml(html)) return html
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const body = doc.body
  stripFormattingFromSubtree(
    body,
    Boolean(opts?.unwrapLinks),
    Boolean(opts?.stripLinkFormats),
  )
  const out = body.innerHTML.trim()
  if (!out || out === '<br>') return ''
  return /<\/?[a-z]/i.test(out) ? out : body.textContent?.trim() ?? ''
}

function workingRange(root: HTMLElement, range?: Range | null): Range | null {
  if (!range || range.collapsed || !root.contains(range.commonAncestorContainer)) return null
  return range
}

export function clearContentsInRange(root: HTMLElement, range: Range): boolean {
  const working = workingRange(root, range)
  if (!working) return false
  working.deleteContents()
  return true
}

export function clearFormatsInRange(root: HTMLElement, range: Range): boolean {
  const working = workingRange(root, range)
  if (!working) return false
  const text = working.toString()
  if (!text) return false
  working.deleteContents()
  working.insertNode(document.createTextNode(text))
  return true
}

export function clearHyperlinksInRange(
  root: HTMLElement,
  range: Range,
  removeFormatting: boolean,
): boolean {
  const working = workingRange(root, range)
  if (!working) return false

  const fragment = working.cloneContents()
  const wrapper = document.createElement('div')
  wrapper.appendChild(fragment)
  stripFormattingFromSubtree(wrapper, true, removeFormatting)

  working.deleteContents()
  while (wrapper.firstChild) {
    working.insertNode(wrapper.firstChild)
  }
  return true
}

export function readFieldHtmlValue(fieldEl: HTMLElement): string {
  const rawHtml = fieldEl.innerHTML.trim()
  const rawText = fieldEl.innerText.trim()
  return hasInlineHtml(rawHtml) ? rawHtml : rawText
}

export function applyTextClearToFieldElement(
  fieldEl: HTMLElement,
  action: TextClearAction,
  range?: Range | null,
): { value: string; changed: boolean } {
  const before = readFieldHtmlValue(fieldEl)
  const activeRange =
    range && !range.collapsed && fieldEl.contains(range.commonAncestorContainer)
      ? range
      : null

  if (action === 'contents') {
    if (activeRange) {
      clearContentsInRange(fieldEl, activeRange)
    } else {
      fieldEl.textContent = ''
    }
  } else if (action === 'formats') {
    if (activeRange) {
      clearFormatsInRange(fieldEl, activeRange)
    } else {
      const next = normalizeHtmlContent(before, { unwrapLinks: false })
      if (hasInlineHtml(next)) fieldEl.innerHTML = next
      else fieldEl.textContent = next
    }
  } else if (action === 'hyperlinks') {
    if (activeRange) {
      clearHyperlinksInRange(fieldEl, activeRange, false)
    } else {
      const next = normalizeHtmlContent(before, { unwrapLinks: true, stripLinkFormats: false })
      if (hasInlineHtml(next)) fieldEl.innerHTML = next
      else fieldEl.textContent = next
    }
  } else if (action === 'removeHyperlinks') {
    if (activeRange) {
      clearHyperlinksInRange(fieldEl, activeRange, true)
    } else {
      const next = normalizeHtmlContent(before, { unwrapLinks: true, stripLinkFormats: true })
      if (hasInlineHtml(next)) fieldEl.innerHTML = next
      else fieldEl.textContent = next
    }
  } else if (action === 'all') {
    fieldEl.textContent = ''
  }

  const after = readFieldHtmlValue(fieldEl)
  return { value: after, changed: before !== after || action === 'all' }
}

export function buildFieldStylesClearPatch(
  fieldStyles: Record<string, Record<string, unknown>>,
  fieldKeys: string[],
  action: TextClearAction,
): Record<string, Record<string, unknown>> | null {
  if (action === 'contents' || action === 'hyperlinks') return null

  const keysToDrop =
    action === 'formats'
      ? FIELD_TYPOGRAPHY_CLEAR_KEYS
      : FIELD_ALL_CLEAR_KEYS

  const next = { ...fieldStyles }
  let touched = false

  fieldKeys.forEach(fieldKey => {
    const cur = fieldStyles[fieldKey]
    if (!cur || typeof cur !== 'object') {
      if (action === 'all') {
        if (fieldKey in next) {
          delete next[fieldKey]
          touched = true
        }
      }
      return
    }
    const cleaned = omitKeys(cur, keysToDrop)
    if (Object.keys(cleaned).length === 0) {
      delete next[fieldKey]
    } else {
      next[fieldKey] = cleaned
    }
    touched = true
  })

  return touched ? next : null
}
