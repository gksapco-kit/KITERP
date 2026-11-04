/** Shared InfocomX logo used on offer letters and payslips. Served from vendor-web/public/branding. */

export const INFOCOMX_LOGO_PATH = '/branding/infocomx-logo.png'

/** Inline styles + class so preview/print never stretch the wide logo. */
export const INFOCOMX_LOGO_CLASS = 'infocomx-brand-logo'

export const INFOCOMX_LOGO_IMG_STYLE =
  'height:48px;width:auto;max-width:220px;object-fit:contain;display:block;border:0;background:transparent;box-shadow:none;'

export const INFOCOMX_LOGO_CSS = `
img.${INFOCOMX_LOGO_CLASS},img[data-infocomx-logo="true"]{
  height:48px!important;width:auto!important;max-width:220px!important;
  object-fit:contain!important;display:block!important;border:0!important;
  background:transparent!important;box-shadow:none!important;
}`

export const INFOCOMX_COMPANY_NAME = 'Infocomx Technologies Private Limited'

export const INFOCOMX_COMPANY_ADDRESS = 'Hyderabad, Telangana, India - 500090'

/** Prefer vendor/template logo; otherwise the bundled InfocomX mark. */
export function resolveInfocomxLogoUrl(vendorOrTemplateLogo?: string | null): string {
  const custom = (vendorOrTemplateLogo || '').trim()
  if (custom) {
    if (
      custom.startsWith('blob:')
      || custom.startsWith('data:')
      || custom.startsWith('http://')
      || custom.startsWith('https://')
    ) {
      return custom
    }
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${custom.startsWith('/') ? custom : `/${custom}`}`
    }
    return custom.startsWith('/') ? custom : `/${custom}`
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${INFOCOMX_LOGO_PATH}`
  }
  return INFOCOMX_LOGO_PATH
}

export function isInfocomxLogoSrc(src: string): boolean {
  const s = (src || '').trim()
  return s.includes('infocomx-logo') || s.includes('data-infocomx-logo')
}

/** Canonical wide logo tag (letterhead + payslip). */
export function infocomxLogoImgTag(src: string = INFOCOMX_LOGO_PATH): string {
  return `<img src="${src}" alt="InfocomX" class="${INFOCOMX_LOGO_CLASS}" data-infocomx-logo="true" style="${INFOCOMX_LOGO_IMG_STYLE}" />`
}

/** Fix legacy letterhead imgs (wrong size box, object-fit:cover, missing class). */
export function normalizeInfocomxLogoInHtml(html: string): string {
  if (!html?.includes('infocomx-logo') && !html.includes('data-infocomx-logo')) return html
  const abs = resolveInfocomxLogoUrl(INFOCOMX_LOGO_PATH)
  return html.replace(/<img\b[^>]*(?:infocomx-logo|data-infocomx-logo)[^>]*\/?>/gi, () =>
    infocomxLogoImgTag(abs),
  )
}

/** Use absolute logo URL inside stored HTML (iframe srcdoc + print). */
export function absolutizeInfocomxLogoInHtml(html: string): string {
  if (!html.includes(INFOCOMX_LOGO_PATH)) return html
  const abs = resolveInfocomxLogoUrl(INFOCOMX_LOGO_PATH)
  return html.split(INFOCOMX_LOGO_PATH).join(abs)
}

/** Prepare InfocomX letter HTML for live preview (srcdoc iframes need absolute logo URLs). */
export function prepareInfocomxOfferHtmlForPreview(html: string): string {
  return absolutizeInfocomxLogoInHtml(normalizeInfocomxLogoInHtml(html))
}
