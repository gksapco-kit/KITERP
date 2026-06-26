/** Marker between simple (non-custom) page body fragments in body_html. */
export const OFFER_PAGE_BREAK = '<!-- offer-page-break -->'

export const BLANK_OFFER_PAGE_BODY = '<div class="body-content"><p></p></div>'

export function isMultiPageOfferHtml(html: string): boolean {
  const s = (html || '').trim()
  return s.includes('data-offer-multi-page="true"')
    || s.includes(OFFER_PAGE_BREAK)
    || countOfferPages(html) > 1
}

export function countOfferPages(html: string): number {
  return parseOfferPageFragments(html).length
}

/** Raw page fragments stored in body_html (inner HTML for custom pages, body fragment otherwise). */
export function parseOfferPageFragments(html: string): string[] {
  const s = (html || '').trim()
  if (!s) return ['<p></p>']

  if (s.includes('data-offer-multi-page="true"')) {
    try {
      const doc = new DOMParser().parseFromString(s, 'text/html')
      const pages = doc.querySelectorAll('.page[data-offer-page], .page[data-doc-editable]')
      if (pages.length > 0) {
        return Array.from(pages).map(el => el.outerHTML.trim())
      }
      const inners = doc.querySelectorAll('.page-inner[data-offer-page], .page-inner[data-offer-custom]')
      if (inners.length > 0) {
        return Array.from(inners).map(el => el.outerHTML.trim())
      }
    } catch {
      /* fall through */
    }
  }

  if (s.trim().startsWith('<div class="page"')) {
    return [s]
  }

  if (s.includes(OFFER_PAGE_BREAK)) {
    const parts = s.split(OFFER_PAGE_BREAK).map(p => p.trim()).filter(Boolean)
    if (parts.length > 0) return parts
  }

  return [s]
}

export function serializeMultiPageCustom(pageInners: string[]): string {
  const pages = pageInners.map((inner, i) => {
    let out = inner.trim()
    if (out.startsWith('<div class="page"')) {
      out = out.replace(/data-offer-page="\d+"/, `data-offer-page="${i + 1}"`)
      if (!out.includes('data-offer-page=')) {
        out = out.replace('<div class="page"', `<div class="page" data-offer-page="${i + 1}"`)
      }
      return out
    }
    if (!out.includes('class="page-inner"')) {
      out = `<div class="page-inner" data-offer-page="${i + 1}" data-offer-custom="true">${out}</div>`
    } else {
      out = out.replace(/data-offer-page="\d+"/, `data-offer-page="${i + 1}"`)
      if (!out.includes('data-offer-page=')) {
        out = out.replace('class="page-inner"', `class="page-inner" data-offer-page="${i + 1}"`)
      }
      if (!out.includes('data-offer-custom="true"')) {
        out = out.replace('class="page-inner"', 'class="page-inner" data-offer-custom="true"')
      }
    }
    return out
  })
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
  const fragments = parseOfferPageFragments(html)
  const isCustom = html.includes('data-offer-custom="true"') || html.includes('data-offer-multi-page="true"')
    || html.includes('data-doc-editable')

  if (isCustom || fragments.some(isCustomOfferPageFragment)) {
    const inners = fragments.map(f => {
      if (f.startsWith('<div class="page"') || f.startsWith('<div class="page-inner"')) return f
      return `<div class="page-inner" data-offer-custom="true">${f}</div>`
    })
    const blank = blankBody.startsWith('<div class="page"')
      ? blankBody
      : blankBody.startsWith('<div class="page-inner"')
        ? blankBody
        : `<div class="page" data-offer-page="${inners.length + 1}" data-doc-editable="full"><div class="body-content">${blankBody}</div></div>`
    return serializeMultiPageCustom([...inners, blank])
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

/** Extract stored body_html from a rendered preview document (single or multi-page). */
export function extractOfferTemplateFromDoc(doc: Document): string {
  const pageEls = doc.querySelectorAll('.page[data-offer-page], .page[data-doc-editable="full"]')
  if (pageEls.length > 0) {
    const pages = Array.from(pageEls).map(el => {
      const clone = el.cloneNode(true) as HTMLElement
      clone.removeAttribute('contenteditable')
      clone.removeAttribute('data-doc-editable')
      clone.querySelectorAll('[contenteditable]').forEach(n => n.removeAttribute('contenteditable'))
      return clone.outerHTML
    })
    if (pages.length > 1) {
      return `<div data-offer-multi-page="true">${pages.join('')}</div>`
    }
    return pages[0] ?? ''
  }

  const pageInners = doc.querySelectorAll('.page[data-offer-page] .page-inner, .page .page-inner[data-offer-editable="full"]')
  if (pageInners.length > 1) {
    const inners = Array.from(pageInners).map(el => {
      const clone = el.cloneNode(true) as HTMLElement
      clone.removeAttribute('contenteditable')
      clone.removeAttribute('data-offer-editable')
      return clone.outerHTML
    })
    return serializeMultiPageCustom(inners)
  }

  const full = doc.querySelector('.page-inner[data-offer-editable="full"]') as HTMLElement | null
  if (full) {
    return `<div class="page-inner" data-offer-custom="true">${full.innerHTML}</div>`
  }

  const legacy = doc.querySelector('[data-offer-editable]') as HTMLElement | null
  return legacy?.innerHTML ?? ''
}
