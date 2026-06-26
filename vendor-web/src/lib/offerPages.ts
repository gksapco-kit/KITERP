/** Marker between simple (non-custom) page body fragments in body_html. */
export const OFFER_PAGE_BREAK = '<!-- offer-page-break -->'

export const BLANK_OFFER_PAGE_BODY = '<div class="body-content"><p></p></div>'

function parseStoredHtml(html: string): Document {
  const s = html.trim()
  const wrapped = s.startsWith('<') ? s : `<div>${s}</div>`
  return new DOMParser().parseFromString(
    wrapped.includes('data-offer-multi-page') ? wrapped : `<div>${wrapped}</div>`,
    'text/html',
  )
}

/** Only direct children of the multi-page wrapper — avoids nested duplicate counts. */
function parseMultiPageRootChildren(doc: Document): string[] | null {
  const root = doc.querySelector('[data-offer-multi-page="true"]')
  if (!root) return null
  const kids = Array.from(root.children).filter(
    (el): el is HTMLElement => el.tagName === 'DIV',
  )
  if (kids.length === 0) return null
  return kids.map(el => el.outerHTML.trim())
}

/** Embed preview horizontal inset — matches offerLayoutShells pads(embed).padLg / padSm */
const OFFER_EMBED_PAGE_PAD = '24px 32px'

function patchContinuationPagePadding(fragment: string): string {
  const s = fragment.trim()
  if (!s.includes('data-section="header"')) return s
  if (s.includes(`padding:${OFFER_EMBED_PAGE_PAD}`) || s.includes(`padding: ${OFFER_EMBED_PAGE_PAD}`)) {
    return s
  }

  const hasHorizontalPad = (styles: string) =>
    /padding:\s*\d+px\s+\d+px/i.test(styles)
    || /padding-left:\s*\d/i.test(styles)
    || /padding-inline:\s*\d/i.test(styles)

  let out = s
  out = out.replace(
    /(<div data-section="header"[^>]*style=")([^"]*)(")/i,
    (_, open, styles, close) => {
      if (hasHorizontalPad(styles)) return `${open}${styles}${close}`
      const pad = `padding:${OFFER_EMBED_PAGE_PAD};padding-bottom:18px;`
      const next = styles.includes('padding-bottom')
        ? styles.replace(/padding-bottom:[^;]+;?/i, 'padding-bottom:18px;')
        : `${pad}${styles}`
      return `${open}${hasHorizontalPad(next) ? next : `${pad}${next}`}${close}`
    },
  )
  out = out.replace(
    /(<div class="body-content"[^>]*style=")([^"]*)(")/i,
    (_, open, styles, close) => {
      if (hasHorizontalPad(styles)) return `${open}${styles}${close}`
      const pad = `padding:${OFFER_EMBED_PAGE_PAD};`
      return `${open}${pad}${styles}${close}`
    },
  )
  return out
}

/** Normalize a stored fragment to a single page-inner (never a nested .page wrapper). */
export function normalizeStoredPageFragment(fragment: string, pageNum: number): string {
  const s = fragment.trim()
  if (!s) return `<div class="page-inner" data-offer-page="${pageNum}" data-offer-custom="true">${BLANK_OFFER_PAGE_BODY}</div>`

  if (s.startsWith('<div class="page"') || s.startsWith('<div class="page"')) {
    try {
      const doc = new DOMParser().parseFromString(s, 'text/html')
      const page = doc.querySelector('.page')
      const inner = page?.querySelector(':scope > .page-inner') as HTMLElement | null
      if (inner) {
        let out = inner.outerHTML
        out = out.replace(/data-offer-page="\d+"/, `data-offer-page="${pageNum}"`)
        if (!out.includes('data-offer-page=')) {
          out = out.replace('class="page-inner"', `class="page-inner" data-offer-page="${pageNum}"`)
        }
        if (!out.includes('data-offer-custom="true"')) {
          out = out.replace('class="page-inner"', 'class="page-inner" data-offer-custom="true"')
        }
        return patchContinuationPagePadding(out)
      }
      const innerHtml = page?.innerHTML?.trim() || BLANK_OFFER_PAGE_BODY
      return patchContinuationPagePadding(
        `<div class="page-inner" data-offer-page="${pageNum}" data-offer-custom="true">${innerHtml}</div>`,
      )
    } catch {
      /* fall through */
    }
  }

  if (s.startsWith('<div class="page-inner"')) {
    let out = s
    out = out.replace(/data-offer-page="\d+"/, `data-offer-page="${pageNum}"`)
    if (!out.includes('data-offer-page=')) {
      out = out.replace('class="page-inner"', `class="page-inner" data-offer-page="${pageNum}"`)
    }
    if (!out.includes('data-offer-custom="true"')) {
      out = out.replace('class="page-inner"', 'class="page-inner" data-offer-custom="true"')
    }
    return patchContinuationPagePadding(out)
  }

  return patchContinuationPagePadding(
    `<div class="page-inner" data-offer-page="${pageNum}" data-offer-custom="true">${s}</div>`,
  )
}

export function isMultiPageOfferHtml(html: string): boolean {
  const s = (html || '').trim()
  return s.includes('data-offer-multi-page="true"') || s.includes(OFFER_PAGE_BREAK)
}

export function countOfferPages(html: string): number {
  return parseOfferPageFragments(html).length
}

/** Raw page fragments stored in body_html (always page-inner level, one per sheet). */
export function parseOfferPageFragments(html: string): string[] {
  const s = (html || '').trim()
  if (!s) return ['<p></p>']

  if (s.includes('data-offer-multi-page="true"')) {
    try {
      const doc = parseStoredHtml(s)
      const fromRoot = parseMultiPageRootChildren(doc)
      if (fromRoot?.length) {
        return fromRoot.map((frag, i) => normalizeStoredPageFragment(frag, i + 1))
      }
    } catch {
      /* fall through */
    }
  }

  if (s.trim().startsWith('<div class="page"')) {
    return [normalizeStoredPageFragment(s, 1)]
  }

  if (s.includes(OFFER_PAGE_BREAK)) {
    const parts = s.split(OFFER_PAGE_BREAK).map(p => p.trim()).filter(Boolean)
    if (parts.length > 0) return parts
  }

  if (s.startsWith('<div class="page-inner"')) {
    return [normalizeStoredPageFragment(s, 1)]
  }

  return [s]
}

export function serializeMultiPageCustom(pageInners: string[]): string {
  const pages = pageInners.map((inner, i) => normalizeStoredPageFragment(inner, i + 1))
  return `<div data-offer-multi-page="true">${pages.join('')}</div>`
}

export function serializeSimplePages(fragments: string[]): string {
  if (fragments.length <= 1) return fragments[0] ?? '<p></p>'
  return fragments.join(OFFER_PAGE_BREAK)
}

export function isCustomOfferPageFragment(fragment: string): boolean {
  const s = fragment.trim()
  return s.includes('data-offer-custom="true"')
    || s.startsWith('<div class="page-inner"')
    || s.startsWith('<div class="page"')
}

export function addOfferPage(html: string, blankBody = BLANK_OFFER_PAGE_BODY): string {
  const fragments = parseOfferPageFragments(html).map((f, i) => normalizeStoredPageFragment(f, i + 1))
  const isCustom = html.includes('data-offer-custom="true"')
    || html.includes('data-offer-multi-page="true"')
    || html.includes('data-doc-editable')
    || fragments.some(isCustomOfferPageFragment)

  const nextNum = fragments.length + 1
  const blank = normalizeStoredPageFragment(
    blankBody.startsWith('<div') ? blankBody : `<div class="body-content">${blankBody}</div>`,
    nextNum,
  )

  if (isCustom || fragments.some(isCustomOfferPageFragment)) {
    return serializeMultiPageCustom([...fragments, blank])
  }

  return serializeSimplePages([...fragments, blankBody])
}

export function removeOfferPage(html: string, pageIndex: number): string {
  const fragments = parseOfferPageFragments(html)
  if (fragments.length <= 1) return fragments[0] ?? '<p></p>'
  const next = fragments.filter((_, i) => i !== pageIndex)
  const isCustom = html.includes('data-offer-custom="true"') || html.includes('data-offer-multi-page="true"')
    || fragments.some(isCustomOfferPageFragment)
  return isCustom ? serializeMultiPageCustom(next) : serializeSimplePages(next)
}

function storedFragmentFromPageElement(pageEl: HTMLElement, pageNum: number): string {
  const inner = pageEl.querySelector(':scope > .page-inner') as HTMLElement | null
  if (inner) {
    const clone = inner.cloneNode(true) as HTMLElement
    clone.removeAttribute('contenteditable')
    clone.removeAttribute('data-offer-editable')
    clone.querySelectorAll('[contenteditable]').forEach(n => n.removeAttribute('contenteditable'))
    return normalizeStoredPageFragment(clone.outerHTML, pageNum)
  }
  const clone = pageEl.cloneNode(true) as HTMLElement
  clone.removeAttribute('contenteditable')
  clone.removeAttribute('data-doc-editable')
  clone.querySelectorAll('[contenteditable]').forEach(n => n.removeAttribute('contenteditable'))
  return normalizeStoredPageFragment(clone.outerHTML, pageNum)
}

/** Extract stored body_html from a rendered preview document (single or multi-page). */
export function extractOfferTemplateFromDoc(doc: Document): string {
  const topPages = Array.from(doc.body?.children ?? []).filter(
    (el): el is HTMLElement => el.classList?.contains('page'),
  )

  if (topPages.length > 1) {
    return serializeMultiPageCustom(topPages.map((p, i) => storedFragmentFromPageElement(p, i + 1)))
  }

  if (topPages.length === 1) {
    return storedFragmentFromPageElement(topPages[0], 1)
  }

  const full = doc.querySelector('.page-inner[data-offer-editable="full"]') as HTMLElement | null
  if (full) {
    return normalizeStoredPageFragment(`<div class="page-inner" data-offer-custom="true">${full.innerHTML}</div>`, 1)
  }

  const legacy = doc.querySelector('[data-offer-editable]') as HTMLElement | null
  return legacy?.innerHTML ?? ''
}
