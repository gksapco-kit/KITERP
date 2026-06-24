import type { StyleConfig } from '@/blocks/registry'
import { normalizeSiteBorderRadius } from '@/lib/siteBorderRadius'

const SITE_BTN_SELECTORS = [
  '.builder-page .builder-site-btn',
  '.builder-page button.rounded-lg:not(.rounded-full)',
  '.builder-page button.rounded-xl:not(.rounded-full)',
  '.builder-page button.rounded-2xl:not(.rounded-full)',
  '.builder-page a.rounded-lg.inline-flex:not(.rounded-full)',
  '.builder-page a.rounded-xl.inline-flex:not(.rounded-full)',
  '.builder-page a.rounded-xl:not(.rounded-full)',
].join(',\n')

/** Tailwind text-* steps as multiples of --site-font-size-base (default 16px). */
const BODY_TEXT_SCALE_RULES = `
  .builder-page .text-xs { font-size: calc(var(--site-font-size-base) * 0.75) !important; }
  .builder-page .text-sm { font-size: calc(var(--site-font-size-base) * 0.875) !important; }
  .builder-page .text-base { font-size: var(--site-font-size-base) !important; }
  .builder-page .text-lg { font-size: calc(var(--site-font-size-base) * 1.125) !important; }
  .builder-page .text-xl { font-size: calc(var(--site-font-size-base) * 1.25) !important; }
`.trim()

/** Injected once per builder page — heading scale + card/button corner tokens. */
export function buildSiteThemeCss(style: Partial<StyleConfig>): string {
  const mode = normalizeSiteBorderRadius(style.border_radius as string | undefined)
  const cardR = mode === 'pill' ? '9999px' : mode === 'sharp' ? '0' : '16px'
  const btnR = mode === 'pill' ? '9999px' : mode === 'sharp' ? '0' : '12px'
  const basePx = style.font_size_base ?? 16

  const headingFamily = style.font_heading
    ? `font-family: ${JSON.stringify(style.font_heading)} !important;`
    : ''
  const headingSize = style.font_size_heading
    ? `font-size: ${style.font_size_heading}px !important; line-height: 1.15 !important;`
    : ''

  const headingRule =
    headingFamily || headingSize
      ? `
  .builder-page h1,
  .builder-page h2,
  .builder-page h3,
  .builder-page h4 {
    ${headingFamily}
    ${headingSize}
  }`
      : ''

  const bodyFamily = style.font_body
    ? `font-family: ${JSON.stringify(style.font_body)};`
    : ''

  return `
  .builder-page[data-site-radius="${mode}"] {
    --site-radius-card: ${cardR};
    --site-radius-btn: ${btnR};
    --site-font-size-base: ${basePx}px;
    font-size: var(--site-font-size-base);
    ${bodyFamily}
  }
  ${BODY_TEXT_SCALE_RULES}
  .builder-page .builder-tile-card,
  .builder-page .builder-site-card {
    border-radius: var(--site-radius-card) !important;
  }
  ${SITE_BTN_SELECTORS} {
    border-radius: var(--site-radius-btn) !important;
  }${headingRule}
  `.trim()
}
