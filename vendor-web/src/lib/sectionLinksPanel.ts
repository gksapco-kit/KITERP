/**
 * Discover linkable elements inside a builder section for the Links sidebar tab.
 */

export type SectionLinkTarget = {
  /** Passed to openLinkEditorForProp (url field path). */
  propKey: string
  /** Canvas scroll / selection key (label field when nested). */
  selectKey?: string
  label: string
  group: string
  url: string
}

/** Paired button label + URL props (hero, CTA, nav, newsletter, …). */
export const SECTION_CTA_LINK_FIELDS: {
  propKey: string
  urlKey: string
  name: string
  group: string
}[] = [
  { propKey: 'cta_label', urlKey: 'cta_url', name: 'Button', group: 'Buttons' },
  { propKey: 'cta_primary', urlKey: 'cta_primary_url', name: 'Primary CTA', group: 'Buttons' },
  { propKey: 'cta_secondary', urlKey: 'cta_secondary_url', name: 'Secondary CTA', group: 'Buttons' },
]

export const SECTION_CTA_LABEL_KEYS = new Set(SECTION_CTA_LINK_FIELDS.map(f => f.propKey))

/** Standalone URL props (no separate label field). */
const TOP_LEVEL_URL_FIELDS: { key: string; label: string; group: string }[] = [
  { key: 'policy_url', label: 'Policy link', group: 'Section' },
]

export type SocialLinkPanelEntry = {
  platform: string
  label: string
  url: string
}

const FOOTER_SOCIAL_PLATFORMS: { key: string; label: string }[] = [
  { key: 'twitter', label: 'Twitter / X' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'youtube', label: 'YouTube' },
]

const SOCIAL_BLOCK_PLATFORMS: { key: string; label: string }[] = [
  { key: 'twitter', label: 'Twitter / X' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'youtube', label: 'YouTube' },
]

function readSocialLinksRaw(props: Record<string, unknown>): Record<string, string> {
  const raw = props.social_links
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return raw as Record<string, string>
}

/** Social platforms for the Links tab — always lists known slots for footer / social sections. */
export function resolveSocialLinkPanelEntries(
  blockType: string,
  props: Record<string, unknown>,
): SocialLinkPanelEntry[] {
  if (blockType === 'footer') {
    if (props.show_social === false) return []
    const raw = readSocialLinksRaw(props)
    return FOOTER_SOCIAL_PLATFORMS.map(({ key, label }) => ({
      platform: key,
      label,
      url: String(raw[key] ?? '').trim(),
    }))
  }

  if (blockType === 'social_links') {
    const raw = readSocialLinksRaw(props)
    const extraKeys = Object.keys(raw).filter(
      k => !SOCIAL_BLOCK_PLATFORMS.some(p => p.key === k),
    )
    const platforms = [
      ...SOCIAL_BLOCK_PLATFORMS,
      ...extraKeys.map(k => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1) })),
    ]
    return platforms.map(({ key, label }) => ({
      platform: key,
      label,
      url: String(raw[key] ?? '').trim(),
    }))
  }

  const raw = readSocialLinksRaw(props)
  const keys = Object.keys(raw)
  if (!keys.length) return []
  return keys.map(platform => ({
    platform,
    label: platform.charAt(0).toUpperCase() + platform.slice(1),
    url: String(raw[platform] ?? '').trim(),
  }))
}

export function countConfiguredSocialLinks(
  blockType: string,
  props: Record<string, unknown>,
): number {
  return resolveSocialLinkPanelEntries(blockType, props).filter(e => Boolean(e.url)).length
}

/** Keys that hold navigation targets — not media/asset URLs. */
const NAV_LINK_KEYS = ['cta_url', 'href', 'url', 'link', 'link_url'] as const

const MEDIA_URL_KEYS = new Set([
  'image_url',
  'avatar_url',
  'bg_image_url',
  'video_url',
  'src',
  'brand_logo',
  'logo_url',
  'original_url',
  'favicon_url',
])

/** Arrays where `url` on an item is a navigation link (not an image src). */
const ARRAY_ITEM_URL_IS_NAV = new Set(['nav_links', 'logos', 'items', 'links', 'projects'])

const ITEM_SCHEMA_ALIASES: Record<string, string> = {
  'service.pricing': 'pricing',
  'service.faq': 'faq',
  features_alternating: 'features',
  features_icons: 'features',
  services_list: 'services_cards',
  testimonials_grid: 'testimonials',
  team_list: 'team_grid',
  blog_featured: 'blog_grid',
  blog_list: 'blog_grid',
  gallery_grid: 'gallery_masonry',
  image_gallery: 'gallery_masonry',
  map_contact: 'map_embed',
  offer_banner: 'coupon_banner',
  promo_strip: 'coupon_banner',
}

type ItemLinkSpec = {
  arrayKey: string
  group: string
  urlKey: string
  labelKeys: string[]
}

/** Per block-type array fields that expose navigation links. */
const BLOCK_ITEM_LINK_SPECS: Record<string, ItemLinkSpec[]> = {
  pricing: [{ arrayKey: 'plans', group: 'Plans', urlKey: 'cta_url', labelKeys: ['name', 'cta'] }],
  nav: [{ arrayKey: 'nav_links', group: 'Navigation links', urlKey: 'url', labelKeys: ['label'] }],
  footer: [{ arrayKey: 'nav_links', group: 'Navigation links', urlKey: 'url', labelKeys: ['label'] }],
  marquee_strip: [{ arrayKey: 'items', group: 'Marquee items', urlKey: 'url', labelKeys: ['label'] }],
  trust_logos: [{ arrayKey: 'logos', group: 'Logo links', urlKey: 'url', labelKeys: ['name'] }],
  coupon_banner: [{ arrayKey: 'coupons', group: 'Offers', urlKey: 'url', labelKeys: ['title', 'label'] }],
  offer_banner: [{ arrayKey: 'coupons', group: 'Offers', urlKey: 'url', labelKeys: ['title', 'label'] }],
  promo_strip: [{ arrayKey: 'coupons', group: 'Offers', urlKey: 'url', labelKeys: ['title', 'label'] }],
}

function readLinkLabel(item: Record<string, unknown>, labelKeys: string[]): string {
  for (const key of labelKeys) {
    const val = String(item[key] ?? '').trim()
    if (val) return val
  }
  return 'Link'
}

function readLinkUrl(item: Record<string, unknown>, urlKey: string): string {
  return String(item[urlKey] ?? item.url ?? item.href ?? '').trim()
}

function isMediaUrlField(key: string): boolean {
  return MEDIA_URL_KEYS.has(key) || key.endsWith('_image_url')
}

function shouldIncludeArrayUrlKey(arrayKey: string, urlKey: string): boolean {
  if (urlKey === 'cta_url' || urlKey === 'href' || urlKey === 'link' || urlKey === 'link_url') return true
  if (urlKey === 'url') return ARRAY_ITEM_URL_IS_NAV.has(arrayKey)
  return false
}

function pushTarget(
  out: SectionLinkTarget[],
  seen: Set<string>,
  target: SectionLinkTarget,
) {
  if (seen.has(target.propKey)) return
  seen.add(target.propKey)
  out.push(target)
}

/** Footer column link — string label or { label, href }. */
export function readFooterColumnLink(link: unknown): { label: string; url: string } {
  if (typeof link === 'string') {
    return { label: link.trim() || 'Link', url: '' }
  }
  if (link && typeof link === 'object') {
    const o = link as Record<string, unknown>
    return {
      label: String(o.label ?? o.name ?? '').trim() || 'Link',
      url: String(o.href ?? o.url ?? '').trim(),
    }
  }
  return { label: 'Link', url: '' }
}

function appendTopLevelCtas(
  props: Record<string, unknown>,
  out: SectionLinkTarget[],
  seen: Set<string>,
) {
  for (const field of SECTION_CTA_LINK_FIELDS) {
    if (props[field.propKey] === undefined && props[field.urlKey] === undefined) continue
    const label = String(props[field.propKey] ?? field.name).trim() || field.name
    pushTarget(out, seen, {
      propKey: field.urlKey,
      selectKey: field.propKey,
      label,
      group: field.group,
      url: String(props[field.urlKey] ?? '').trim(),
    })
  }
}

function appendTopLevelUrlFields(
  props: Record<string, unknown>,
  out: SectionLinkTarget[],
  seen: Set<string>,
) {
  for (const field of TOP_LEVEL_URL_FIELDS) {
    if (props[field.key] === undefined) continue
    pushTarget(out, seen, {
      propKey: field.key,
      selectKey: field.key,
      label: field.label,
      group: field.group,
      url: String(props[field.key] ?? '').trim(),
    })
  }
}

function appendItemSchemaLinks(
  blockType: string,
  props: Record<string, unknown>,
  out: SectionLinkTarget[],
  seen: Set<string>,
) {
  const schemaKey = ITEM_SCHEMA_ALIASES[blockType] ?? blockType
  const specs = BLOCK_ITEM_LINK_SPECS[schemaKey] ?? BLOCK_ITEM_LINK_SPECS[blockType]
  if (!specs?.length) return

  for (const spec of specs) {
    const arr = props[spec.arrayKey]
    if (!Array.isArray(arr)) continue
    arr.forEach((raw, index) => {
      const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
      const propKey = `${spec.arrayKey}.${index}.${spec.urlKey}`
      pushTarget(out, seen, {
        propKey,
        selectKey: propKey,
        label: readLinkLabel(item, spec.labelKeys),
        group: spec.group,
        url: readLinkUrl(item, spec.urlKey),
      })
    })
  }
}

function appendFooterColumnLinks(
  props: Record<string, unknown>,
  out: SectionLinkTarget[],
  seen: Set<string>,
) {
  const cols = props.footer_columns
  if (!Array.isArray(cols)) return
  cols.forEach((col, colIdx) => {
    if (!col || typeof col !== 'object') return
    const colTitle = String((col as Record<string, unknown>).title ?? '').trim() || `Column ${colIdx + 1}`
    const links = (col as Record<string, unknown>).links
    if (!Array.isArray(links)) return
    links.forEach((link, linkIdx) => {
      const { label, url } = readFooterColumnLink(link)
      pushTarget(out, seen, {
        propKey: `footer_columns.${colIdx}.links.${linkIdx}.href`,
        selectKey: `footer_columns.${colIdx}.links.${linkIdx}`,
        label,
        group: colTitle,
        url,
      })
    })
  })
}

/** Scan any array props for link fields not covered by explicit schemas. */
function appendGenericArrayLinks(
  props: Record<string, unknown>,
  out: SectionLinkTarget[],
  seen: Set<string>,
) {
  for (const [arrayKey, rawArr] of Object.entries(props)) {
    if (arrayKey === 'footer_columns' || arrayKey === 'social_links' || arrayKey === 'overlays') continue
    if (!Array.isArray(rawArr)) continue

    rawArr.forEach((raw, index) => {
      if (!raw || typeof raw !== 'object') return
      const item = raw as Record<string, unknown>

      for (const urlKey of NAV_LINK_KEYS) {
        if (isMediaUrlField(urlKey)) continue
        if (!shouldIncludeArrayUrlKey(arrayKey, urlKey)) continue
        if (!(urlKey in item) && !Object.keys(item).some(k => NAV_LINK_KEYS.includes(k as typeof NAV_LINK_KEYS[number]))) {
          continue
        }
        if (!(urlKey in item)) continue

        const propKey = `${arrayKey}.${index}.${urlKey}`
        if (seen.has(propKey)) continue

        const label = readLinkLabel(item, [
          'label', 'title', 'name', 'cta', 'headline', 'text', 'question',
        ])
        pushTarget(out, seen, {
          propKey,
          selectKey: propKey,
          label,
          group: formatArrayGroupName(arrayKey),
          url: readLinkUrl(item, urlKey),
        })
      }

      // Nested link lists (e.g. custom column structures)
      const nestedLinks = item.links
      if (Array.isArray(nestedLinks) && arrayKey !== 'footer_columns') {
        nestedLinks.forEach((link, linkIdx) => {
          const { label, url } = readFooterColumnLink(link)
          const propKey = `${arrayKey}.${index}.links.${linkIdx}.href`
          pushTarget(out, seen, {
            propKey,
            selectKey: `${arrayKey}.${index}.links.${linkIdx}`,
            label,
            group: readLinkLabel(item, ['title', 'name']) || formatArrayGroupName(arrayKey),
            url,
          })
        })
      }
    })
  }
}

function formatArrayGroupName(arrayKey: string): string {
  const names: Record<string, string> = {
    nav_links: 'Navigation links',
    plans: 'Plans',
    logos: 'Logo links',
    items: 'Items',
    coupons: 'Offers',
    features: 'Features',
    testimonials: 'Reviews',
    members: 'Team',
    faqs: 'FAQ',
    stats: 'Stats',
    videos: 'Videos',
    images: 'Images',
  }
  if (names[arrayKey]) return names[arrayKey]
  return arrayKey
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/** All linkable prop targets for the Links sidebar (excluding overlays & social). */
export function discoverSectionLinkTargets(
  blockType: string,
  props: Record<string, unknown>,
): SectionLinkTarget[] {
  const out: SectionLinkTarget[] = []
  const seen = new Set<string>()

  appendTopLevelCtas(props, out, seen)
  appendTopLevelUrlFields(props, out, seen)
  appendItemSchemaLinks(blockType, props, out, seen)

  if (blockType === 'footer') {
    appendFooterColumnLinks(props, out, seen)
  }

  appendGenericArrayLinks(props, out, seen)

  return out
}

export function countConfiguredSectionLinkTargets(
  blockType: string,
  props: Record<string, unknown>,
): number {
  return discoverSectionLinkTargets(blockType, props).filter(t => Boolean(t.url)).length
}
