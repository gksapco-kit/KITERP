import { useMemo, type ComponentType, type CSSProperties } from 'react'
import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import { blocks as commerceBlocks } from '@/commerce-blocks/blocks/registry'
import {
  categoryShowcaseVariantId,
  extractCommerceCatalogLayout,
  resolveCategoryShowcaseLayout,
} from '@/lib/commerceCatalogLayout'
import { buildCommerceBlockCssVars } from '@/lib/commerceBlockTheme'
import { mockProducts, mockCategories } from '@/commerce-blocks/mock/products'
import { mockServices } from '@/commerce-blocks/mock/services'
import { mockTestimonials, mockTeam } from '@/commerce-blocks/mock/serviceExtras'
import { mockMenu } from '@/commerce-blocks/mock/menu'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  blockType: string
}

function moneyToMajor(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 999 ? Math.round(value) / 100 : value
  }
  return 0
}

function swatch(seed: string, w = 600, h = 450) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 360
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hash},42%,84%)'/><stop offset='1' stop-color='hsl(${(hash + 42) % 360},38%,66%)'/></linearGradient></defs><rect width='${w}' height='${h}' fill='url(%23g)'/></svg>`,
  )}`
}

function replaceArray<T>(target: T[], next: T[]) {
  target.splice(0, target.length, ...next)
}

function hydrateProducts(liveItems: LiveItem[]) {
  if (!liveItems.length) return
  const products = liveItems.map((item, idx) => ({
    id: item.id || `p${idx + 1}`,
    name: item.title || `Product ${idx + 1}`,
    description: item.description || item.subtitle || '',
    price: moneyToMajor(item.price ?? (item.meta as Record<string, unknown>)?.price),
    compareAtPrice: moneyToMajor((item.meta as Record<string, unknown>)?.compare_at_price),
    currency: ((item.meta as Record<string, unknown>)?.currency as string) || 'INR',
    image: item.image_url || swatch(item.title || String(idx)),
    tags: Array.isArray((item.meta as Record<string, unknown>)?.tags)
      ? ((item.meta as Record<string, unknown>).tags as string[])
      : [item.subtitle || (item.meta as Record<string, unknown>)?.category_name as string].filter(Boolean),
    category: ((item.meta as Record<string, unknown>)?.category as string) || item.subtitle || 'Products',
    inStock: ((item.meta as Record<string, unknown>)?.stock_status as string) !== 'out_of_stock',
    rating: typeof item.rating === 'number' ? item.rating : undefined,
    reviews: Number((item.meta as Record<string, unknown>)?.review_count || 0),
  }))
  replaceArray(mockProducts, products)
}

function hydrateCategories(liveItems: LiveItem[]) {
  if (!liveItems.length) {
    replaceArray(mockCategories, [])
    return
  }
  replaceArray(
    mockCategories,
    liveItems.map((item, idx) => ({
      id: item.id || `cat-${idx}`,
      name: item.title || `Category ${idx + 1}`,
      count: Number((item.meta as Record<string, unknown>)?.product_count || (item.meta as Record<string, unknown>)?.count || 0),
      image: item.image_url || swatch(item.title || String(idx)),
    })),
  )
}

function hydrateServices(liveItems: LiveItem[]) {
  if (!liveItems.length) return
  replaceArray(
    mockServices,
    liveItems.map((item, idx) => ({
      id: item.id || `s${idx + 1}`,
      name: item.title || `Service ${idx + 1}`,
      description: item.description || item.subtitle || '',
      duration: String((item.meta as Record<string, unknown>)?.duration_minutes || (item.meta as Record<string, unknown>)?.duration || '60 min'),
      price: moneyToMajor(item.price ?? (item.meta as Record<string, unknown>)?.price),
      currency: ((item.meta as Record<string, unknown>)?.currency as string) || 'INR',
      category: ((item.meta as Record<string, unknown>)?.category as string) || item.subtitle || 'Services',
      features: Array.isArray((item.meta as Record<string, unknown>)?.features)
        ? ((item.meta as Record<string, unknown>).features as string[])
        : [],
      popular: idx === 0,
      image: item.image_url || swatch(item.title || String(idx)),
    })),
  )
}

function hydrateTestimonials(liveItems: LiveItem[]) {
  if (!liveItems.length) return
  replaceArray(
    mockTestimonials,
    liveItems.map((item, idx) => ({
      id: item.id || `t${idx + 1}`,
      name: item.title || 'Customer',
      role: item.subtitle || '',
      quote: item.description || '',
      rating: item.rating || Number((item.meta as Record<string, unknown>)?.rating || 5),
      avatar: item.image_url || undefined,
    })),
  )
}

function hydrateTeam(liveItems: LiveItem[]) {
  if (!liveItems.length) return
  replaceArray(
    mockTeam,
    liveItems.map((item, idx) => ({
      id: item.id || `tm${idx + 1}`,
      name: item.title || 'Team member',
      role: item.subtitle || '',
      bio: item.description || '',
      avatar: item.image_url || undefined,
      rating: item.rating || 5,
    })),
  )
}

function hydrateMenuFromProducts(liveItems: LiveItem[]) {
  if (!liveItems.length) return
  const items = liveItems.map((item, idx) => ({
    id: item.id || `m${idx + 1}`,
    name: item.title || `Item ${idx + 1}`,
    description: item.description || item.subtitle || '',
    price: moneyToMajor(item.price ?? (item.meta as Record<string, unknown>)?.price),
    currency: ((item.meta as Record<string, unknown>)?.currency as string) || 'INR',
    diet: [],
    popular: idx < 2,
    image: item.image_url || swatch(item.title || String(idx), 300, 300),
  }))
  replaceArray(mockMenu, [{ id: 'live', name: 'Menu', items }])
}

function hydrateLiveData(blockType: string, liveItems: LiveItem[]) {
  if (blockType === 'product.categories') {
    hydrateCategories(liveItems)
    return
  }
  if (!liveItems.length) return
  if (blockType.startsWith('product.') || blockType.startsWith('commerce.')) {
    hydrateProducts(liveItems)
  } else if (blockType.startsWith('service.')) {
    if (blockType.includes('testimonial')) hydrateTestimonials(liveItems)
    else if (blockType.includes('team')) hydrateTeam(liveItems)
    else hydrateServices(liveItems)
  } else if (blockType.startsWith('menu.')) {
    hydrateMenuFromProducts(liveItems)
  }
}

export default function CommerceLibraryBlock({ style, props, liveItems, blockType }: Props) {
  const catalogLayout = useMemo(
    () => extractCommerceCatalogLayout(props, blockType),
    [props, blockType],
  )

  const limitedLiveItems = useMemo(
    () => liveItems.slice(0, catalogLayout.itemLimit),
    [liveItems, catalogLayout.itemLimit],
  )

  useMemo(() => {
    hydrateLiveData(blockType, limitedLiveItems)
  }, [blockType, limitedLiveItems])

  const def = useMemo(() => commerceBlocks.find((b) => b.id === blockType), [blockType])

  if (!def) {
    return (
      <section className="px-6 py-10">
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
          Unknown commerce block: <strong>{blockType}</strong>
        </div>
      </section>
    )
  }

  const variantId = blockType === 'product.categories'
    ? categoryShowcaseVariantId(props)
    : (props.variant as string) || (props.layout as string) || def.defaultVariantId || def.variants[0]?.id
  const variant = def.variants.find((v) => v.id === variantId) || def.variants[0]
  const Component = variant.Component as ComponentType<Record<string, unknown>>
  const parsedProps = def.propsSchema.safeParse({ ...def.defaultProps, ...props })
  const showcaseLayout = blockType === 'product.categories'
    ? resolveCategoryShowcaseLayout(props)
    : undefined
  const componentProps = {
    ...(parsedProps.success ? parsedProps.data : { ...def.defaultProps, ...props }),
    columns: catalogLayout.columns,
    gap: catalogLayout.gap,
    imageHeightPct: catalogLayout.imageHeightPct,
    cardPadding: catalogLayout.cardPadding,
    itemLimit: catalogLayout.itemLimit,
    cardStyle: catalogLayout.cardStyle,
    showTags: catalogLayout.showTags,
    showCta: catalogLayout.showCta,
    showBookLink: catalogLayout.showBookLink,
    showPrice: props.showPrice !== false,
    showFeatures: props.showFeatures !== false,
    title: (props.title as string | undefined) ?? undefined,
    faqs: Array.isArray(props.faqs) ? props.faqs : undefined,
    // Scalar header fields for vertical detail blocks (only forward when defined so old blocks keep mock).
    ...(typeof props.tagline === 'string' ? { tagline: props.tagline } : {}),
    ...(typeof props.image_url === 'string' && props.image_url ? { image_url: props.image_url } : {}),
    ...(typeof props.date === 'string' ? { date: props.date } : {}),
    ...(typeof props.doors === 'string' ? { doors: props.doors } : {}),
    ...(typeof props.start === 'string' ? { start: props.start } : {}),
    ...(typeof props.venue === 'string' ? { venue: props.venue } : {}),
    ...(typeof props.address === 'string' ? { address: props.address } : {}),
    // Event Listing section header + Ticket Picker order-summary text (undefined → component default; '' → hidden).
    ...(typeof props.header_title === 'string' ? { header_title: props.header_title } : {}),
    ...(typeof props.header_subtitle === 'string' ? { header_subtitle: props.header_subtitle } : {}),
    ...(typeof props.all_events_label === 'string' ? { all_events_label: props.all_events_label } : {}),
    ...(typeof props.all_courses_label === 'string' ? { all_courses_label: props.all_courses_label } : {}),
    ...(typeof props.refine_label === 'string' ? { refine_label: props.refine_label } : {}),
    ...(typeof props.order_title === 'string' ? { order_title: props.order_title } : {}),
    ...(typeof props.age_note === 'string' ? { age_note: props.age_note } : {}),
    ...(typeof props.seating_title === 'string' ? { seating_title: props.seating_title } : {}),
    ...((typeof props.max_per_order === 'number' || typeof props.max_per_order === 'string') ? { max_per_order: props.max_per_order } : {}),
    // Course Detail header + CTA fields (undefined → mock fallback; '' → hidden on storefront).
    ...(typeof props.cta_url === 'string' ? { cta_url: props.cta_url } : {}),
    ...(typeof props.preview_cta === 'string' ? { preview_cta: props.preview_cta } : {}),
    ...(typeof props.preview_cta_url === 'string' ? { preview_cta_url: props.preview_cta_url } : {}),
    ...(typeof props.instructor === 'string' ? { instructor: props.instructor } : {}),
    ...(typeof props.level === 'string' ? { level: props.level } : {}),
    ...(typeof props.category === 'string' ? { category: props.category } : {}),
    ...(typeof props.description === 'string' ? { description: props.description } : {}),
    ...(typeof props.duration === 'string' ? { duration: props.duration } : {}),
    ...((typeof props.lessons === 'number' || typeof props.lessons === 'string') ? { lessons: props.lessons } : {}),
    ...((typeof props.rating === 'number' || typeof props.rating === 'string') ? { rating: props.rating } : {}),
    ...((typeof props.reviews === 'number' || typeof props.reviews === 'string') ? { reviews: props.reviews } : {}),
    ...((typeof props.price === 'number' || typeof props.price === 'string') ? { price: props.price } : {}),
    ...(typeof props.currency === 'string' ? { currency: props.currency } : {}),
    ...(typeof props.enrolled_label === 'string' ? { enrolled_label: props.enrolled_label } : {}),
    // Vehicle Detail spec fields (undefined → mock fallback; '' → hidden on storefront).
    ...(typeof props.condition === 'string' ? { condition: props.condition } : {}),
    ...((typeof props.year === 'number' || typeof props.year === 'string') ? { year: props.year } : {}),
    ...(typeof props.make === 'string' ? { make: props.make } : {}),
    ...(typeof props.model === 'string' ? { model: props.model } : {}),
    ...(typeof props.trim === 'string' ? { trim: props.trim } : {}),
    ...(typeof props.exteriorColor === 'string' ? { exteriorColor: props.exteriorColor } : {}),
    ...(typeof props.bodyStyle === 'string' ? { bodyStyle: props.bodyStyle } : {}),
    ...((typeof props.mileage === 'number' || typeof props.mileage === 'string') ? { mileage: props.mileage } : {}),
    ...(typeof props.fuel === 'string' ? { fuel: props.fuel } : {}),
    ...(typeof props.transmission === 'string' ? { transmission: props.transmission } : {}),
    ...(typeof props.stock_number === 'string' ? { stock_number: props.stock_number } : {}),
    ...(typeof props.location_note === 'string' ? { location_note: props.location_note } : {}),
    // Editable content arrays for vertical library blocks (empty/absent → component mock fallback).
    ...(Array.isArray(props.courses) && props.courses.length ? { courses: props.courses } : {}),
    ...(Array.isArray(props.events) && props.events.length ? { events: props.events } : {}),
    ...(Array.isArray(props.classes) && props.classes.length ? { classes: props.classes } : {}),
    ...(Array.isArray(props.syllabus) && props.syllabus.length ? { syllabus: props.syllabus } : {}),
    ...(Array.isArray(props.outcomes) && props.outcomes.length ? { outcomes: props.outcomes } : {}),
    ...(Array.isArray(props.tiers) && props.tiers.length ? { tiers: props.tiers } : {}),
    ...(Array.isArray(props.highlights) && props.highlights.length ? { highlights: props.highlights } : {}),
    ...(Array.isArray(props.vehicles) && props.vehicles.length ? { vehicles: props.vehicles } : {}),
    ...(Array.isArray(props.properties) && props.properties.length ? { properties: props.properties } : {}),
    ...(Array.isArray(props.perks) && props.perks.length ? { perks: props.perks } : {}),
    ...(showcaseLayout ? { layout: showcaseLayout, bg_style: props.bg_style } : {}),
  }

  const themeVars = useMemo(
    () => buildCommerceBlockCssVars(style, props),
    [style, props],
  )

  return (
    <div
      className="commerce-block bg-background text-foreground"
      style={themeVars as CSSProperties}
    >
      <Component {...componentProps} />
    </div>
  )
}
