import {
  WELLNESS_CATEGORY_FALLBACK_IMAGES,
  WELLNESS_CATEGORY_IMAGE_BY_TITLE,
} from '@/lib/wellnessCategoryStyle'

const CATEGORY_TITLE_REPLACEMENTS: Record<string, string> = {
  'meal subscriptions': 'Healthy Beverages',
  'guilt free snacks': 'Wholesome Snacks',
}

const CTA_LABEL_REPLACEMENTS: Record<string, string> = {
  'meal subscriptions': 'Browse categories',
  'shop categories': 'Browse categories',
}

const PHRASE_REPLACEMENTS: [RegExp, string][] = [
  [/meal subscriptions/gi, 'everyday essentials'],
  [/guilt[- ]free/gi, 'wholesome'],
  [/your one-stop destination/gi, 'Discover wellness essentials'],
  [/for healthy living/gi, 'for everyday wellness'],
  [/healthy & delicious meals, delivered daily/gi, 'Wholesome products, delivered with care'],
  [/flexible meal plans/gi, 'flexible delivery options'],
  [/plant-based meals prepared daily/gi, 'fresh products prepared with care'],
]

const TEMPLATE_TIMELINE_TITLES = new Set([
  'starting with workshops',
  'meal subscriptions',
  'online store launch',
  'growing community',
  'expanded our range',
])

const TEMPLATE_FEATURE_TITLES = new Set([
  'customize your schedule',
  'convenient doorstep delivery',
])

export const WELLNESS_FEATURE_FALLBACK_IMAGES = [
  WELLNESS_CATEGORY_FALLBACK_IMAGES[1],
  WELLNESS_CATEGORY_FALLBACK_IMAGES[0],
  WELLNESS_CATEGORY_FALLBACK_IMAGES[3],
]

export function sanitizeWellnessCategoryTitle(value: string | null | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  return CATEGORY_TITLE_REPLACEMENTS[trimmed.toLowerCase()] ?? trimmed
}

export function sanitizeWellnessCtaLabel(value: string | null | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  return CTA_LABEL_REPLACEMENTS[trimmed.toLowerCase()] ?? sanitizeWellnessBodyCopy(trimmed)
}

export function sanitizeWellnessBodyCopy(value: string | null | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  return PHRASE_REPLACEMENTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), trimmed)
}

/** @deprecated Use context-specific helpers (category title vs CTA vs body). */
export function sanitizeWellnessTemplateCopy(value: string | null | undefined): string {
  return sanitizeWellnessBodyCopy(value)
}

export function isTemplateMealFeaturesBlock(props: Record<string, unknown>): boolean {
  const title = String(props.title || '').toLowerCase()
  if (title.includes('meals') && title.includes('delivered')) return true
  const features = (props.features as Array<{ title?: string; desc?: string }> | undefined) || []
  return features.some(f => {
    const t = String(f.title || '').toLowerCase()
    const d = String(f.desc || f.description || '').toLowerCase()
    return TEMPLATE_FEATURE_TITLES.has(t) || d.includes('meal plan') || d.includes('plant-based meals')
  })
}

export function productFocusedFeatureContent(siteName = 'our store') {
  return {
    title: `Why shop with ${siteName}`,
    features: [
      {
        title: 'Curated for wellness',
        desc: 'Wholesome snacks, gourmet groceries, and pantry staples chosen for quality and taste.',
        image_url: WELLNESS_FEATURE_FALLBACK_IMAGES[0],
      },
      {
        title: 'Delivered with care',
        desc: 'Fresh, minimally processed products packed carefully and shipped to your door.',
        image_url: WELLNESS_FEATURE_FALLBACK_IMAGES[1],
      },
    ],
  }
}

export function isTemplateTimelineBlock(props: Record<string, unknown>): boolean {
  const items = (props.items as Array<{ year?: string; title?: string }> | undefined) || []
  if (items.length < 2) return false
  const years = new Set(items.map(i => String(i.year || '').trim()))
  if (years.has('2010') && years.has('2013')) return true
  return items.filter(i => TEMPLATE_TIMELINE_TITLES.has(String(i.title || '').toLowerCase())).length >= 2
}

export function genericTimelineContent(siteName = 'our store') {
  return {
    title: 'Our story',
    items: [
      { year: 'Started', title: 'Built on quality', desc: `Founded with a simple goal — make wholesome food accessible through ${siteName}.` },
      { year: 'Growing', title: 'Expanded our range', desc: 'Added snacks, groceries, beverages, and pantry staples customers love.' },
      { year: 'Today', title: 'Serving our community', desc: 'A trusted stop for everyday wellness — shop online with confidence.' },
    ],
  }
}

export function resolveWellnessFeatureImage(
  feature: { image_url?: string | null },
  index: number,
): string {
  const direct = feature.image_url?.trim()
  if (direct && (direct.startsWith('http') || direct.startsWith('data:') || direct.startsWith('/'))) {
    return direct
  }
  return WELLNESS_FEATURE_FALLBACK_IMAGES[index % WELLNESS_FEATURE_FALLBACK_IMAGES.length]
}

export function resolveWellnessCategoryImage(
  cat: { title?: string; image_url?: string | null },
  index: number,
): string {
  const titleKey = sanitizeWellnessCategoryTitle(cat.title).toLowerCase()
  const rawKey = String(cat.title || '').trim().toLowerCase()
  const direct = cat.image_url?.trim()
  if (direct && (direct.startsWith('http') || direct.startsWith('data:'))) return direct
  const fromTitle = WELLNESS_CATEGORY_IMAGE_BY_TITLE[titleKey] || WELLNESS_CATEGORY_IMAGE_BY_TITLE[rawKey]
  if (fromTitle) return fromTitle
  return WELLNESS_CATEGORY_FALLBACK_IMAGES[index % WELLNESS_CATEGORY_FALLBACK_IMAGES.length]
}
