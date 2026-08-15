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
import { builderSectionContainerClass } from '@/lib/builderSectionLayout'

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
  const products = liveItems.map((item, idx) => {
    const meta = (item.meta || {}) as Record<string, unknown>
    const slugFromMeta = String(meta.slug ?? '').trim()
    const slugFromUrl = item.url?.match(/\/products\/([^/?#]+)/i)?.[1]?.trim()
    const slug = slugFromMeta || slugFromUrl || String(item.id || `p${idx + 1}`)
    return {
      id: item.id || `p${idx + 1}`,
      slug,
      name: item.title || `Product ${idx + 1}`,
      description: item.description || item.subtitle || '',
      price: moneyToMajor(item.price ?? meta.price),
      compareAtPrice: (() => {
        const compare = moneyToMajor(meta.compare_at_price)
        return compare > 0 ? compare : undefined
      })(),
      currency: (meta.currency as string) || 'INR',
      image: item.image_url || swatch(item.title || String(idx)),
      tags: Array.isArray(meta.tags)
        ? (meta.tags as string[])
        : [item.subtitle || (meta.category_name as string)].filter(Boolean),
      category: (meta.category as string) || item.subtitle || 'Products',
      inStock: (meta.stock_status as string) !== 'out_of_stock',
      rating: typeof item.rating === 'number' ? item.rating : undefined,
      reviews: Number(meta.review_count || 0),
    }
  })
  replaceArray(mockProducts, products)
}

function hydrateCategories(liveItems: LiveItem[]) {
  // Match hydrateProducts: never wipe shared mockCategories while live data is
  // still loading (empty array). Clearing here caused intermittent blank/wrong
  // names across Strict Mode remounts and multiple category sections.
  if (!liveItems.length) return
  replaceArray(
    mockCategories,
    liveItems.map((item, idx) => ({
      id: item.id || `cat-${idx}`,
      name: item.title || `Category ${idx + 1}`,
      count: Number((item.meta as Record<string, unknown>)?.product_count || (item.meta as Record<string, unknown>)?.count || 0),
      image: item.image_url || swatch(item.title || String(idx)),
      appliesTo: String((item.meta as Record<string, unknown>)?.applies_to || 'both'),
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
      allowQuoteRequest: Boolean((item.meta as Record<string, unknown>)?.allow_quote_request),
      requiresBooking: (item.meta as Record<string, unknown>)?.requires_booking as boolean | undefined,
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

function liveItemToProperty(item: LiveItem, idx: number) {
  const meta = (item.meta || {}) as Record<string, unknown>
  return {
    id: item.id || `live-property-${idx}`,
    title: item.title || `Listing ${idx + 1}`,
    address: (meta.address as string) || item.subtitle || '',
    price: typeof item.price === 'number' ? item.price : Number(meta.price) || 0,
    currency: (meta.currency as string) || 'USD',
    beds: Number(meta.beds) || 0,
    baths: Number(meta.baths) || 0,
    sqft: Number(meta.sqft) || 0,
    type: (meta.type as string) || 'house',
    status: (meta.status as string) || 'for-sale',
    image: item.image_url || swatch(item.title || String(idx)),
    agent: (meta.agent_name as string) || undefined,
  }
}

function liveItemToCourse(item: LiveItem, idx: number) {
  const meta = (item.meta || {}) as Record<string, unknown>
  return {
    id: item.id || `live-course-${idx}`,
    title: item.title || `Course ${idx + 1}`,
    instructor: (meta.instructor as string) || item.subtitle || '',
    level: (meta.level as string) || 'Beginner',
    duration: (meta.duration as string) || '',
    lessons: Number(meta.lessons) || 0,
    rating: Number(meta.rating) || 0,
    reviews: Number(meta.reviews) || 0,
    price: typeof item.price === 'number' ? item.price : Number(meta.price) || 0,
    currency: (meta.currency as string) || 'USD',
    image: item.image_url || swatch(item.title || String(idx)),
    category: (meta.category as string) || '',
    description: item.description || '',
  }
}

function liveItemToCourseDetail(item: LiveItem, idx: number) {
  const meta = (item.meta || {}) as Record<string, unknown>
  return {
    ...liveItemToCourse(item, idx),
    syllabus: Array.isArray(meta.syllabus) ? meta.syllabus : [],
    outcomes: Array.isArray(meta.outcomes) ? meta.outcomes : [],
    perks: Array.isArray(meta.perks) ? meta.perks : [],
    enrolled_label: (meta.enrolled_label as string) || undefined,
    cta_label: (meta.cta_label as string) || undefined,
    preview_cta_label: (meta.preview_cta_label as string) || undefined,
  }
}

/** "2026-07-24" → "Fri, Jul 24" for display; passes through older free-text values unchanged. */
function formatFitnessClassDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** "18:30" → "6:30 PM" for display; passes through older free-text values unchanged. */
function formatFitnessClassTime(hhmm?: string): string {
  if (!hhmm) return ''
  const [hStr, mStr] = hhmm.split(':')
  const h = Number(hStr)
  if (Number.isNaN(h)) return hhmm
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr ?? '00'} ${period}`
}

function liveItemToFitnessClass(item: LiveItem, idx: number) {
  const meta = (item.meta || {}) as Record<string, unknown>
  return {
    id: item.id || `live-class-${idx}`,
    name: item.title || `Class ${idx + 1}`,
    instructor: (meta.instructor as string) || item.subtitle || '',
    type: (meta.type as string) || 'Yoga',
    duration: Number(meta.duration) || 60,
    intensity: Number(meta.intensity) || 3,
    date: formatFitnessClassDate(meta.date as string | undefined),
    time: formatFitnessClassTime(meta.time as string | undefined),
    capacity: Number(meta.capacity) || 0,
    booked: Number(meta.booked) || 0,
    studio: (meta.studio as string) || '',
    price: typeof item.price === 'number' ? item.price : Number(meta.price) || 0,
    currency: (meta.currency as string) || 'USD',
  }
}

function liveItemToVehicle(item: LiveItem, idx: number) {
  const meta = (item.meta || {}) as Record<string, unknown>
  return {
    id: item.id || `live-vehicle-${idx}`,
    year: Number(meta.year) || new Date().getFullYear(),
    make: (meta.make as string) || '',
    model: (meta.model as string) || '',
    trim: (meta.trim as string) || undefined,
    price: typeof item.price === 'number' ? item.price : Number(meta.price) || 0,
    currency: (meta.currency as string) || 'USD',
    mileage: Number(meta.mileage) || 0,
    fuel: (meta.fuel as string) || 'Gas',
    transmission: (meta.transmission as string) || 'Auto',
    bodyStyle: (meta.body_style as string) || '',
    exteriorColor: (meta.exterior_color as string) || '',
    image: item.image_url || swatch(item.title || String(idx)),
    condition: (meta.condition as string) || 'Used',
    stock_number: (meta.stock_number as string) || undefined,
    location_note: (meta.location_note as string) || undefined,
    highlights: Array.isArray(meta.highlights) ? meta.highlights : undefined,
    ctaLabel: (meta.cta_label as string) || undefined,
  }
}

/** "2026-07-24" → "Friday, July 24, 2026" for display; passes through older free-text values unchanged. */
function formatEventDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

/** "18:30" → "6:30 PM" for display; passes through older free-text values unchanged. */
function formatEventTime(hhmm?: string): string {
  if (!hhmm) return ''
  const [hStr, mStr] = hhmm.split(':')
  const h = Number(hStr)
  if (Number.isNaN(h)) return hhmm
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr ?? '00'} ${period}`
}

function liveItemToEvent(item: LiveItem, idx: number) {
  const meta = (item.meta || {}) as Record<string, unknown>
  return {
    id: item.id || `live-event-${idx}`,
    title: item.title || `Event ${idx + 1}`,
    tagline: (meta.tagline as string) || item.subtitle || undefined,
    image_url: item.image_url || swatch(item.title || String(idx)),
    date: formatEventDate(meta.event_date as string | undefined),
    doors: formatEventTime(meta.doors_time as string | undefined),
    start: formatEventTime(meta.start_time as string | undefined),
    end: formatEventTime(meta.end_time as string | undefined),
    venue: (meta.venue as string) || undefined,
    address: (meta.address as string) || undefined,
    venueCapacity: meta.venue_capacity != null ? Number(meta.venue_capacity) || undefined : undefined,
    tiers: Array.isArray(meta.tiers) ? meta.tiers : [],
    orderTitle: (meta.order_title as string) || undefined,
    ageNote: (meta.age_note as string) || undefined,
    seatingTitle: (meta.seating_title as string) || undefined,
    showSeating: meta.show_seating !== false,
    maxPerOrder: Number(meta.max_per_order) || undefined,
    ctaLabel: (meta.cta_label as string) || undefined,
  }
}

/** "2026-06-05" → "Jun 5, 2026" — compact form for grid/list cards (detail cards use the long form above). */
function formatEventDateShort(iso?: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function liveItemToEventCard(item: LiveItem, idx: number) {
  const meta = (item.meta || {}) as Record<string, unknown>
  const tiers = Array.isArray(meta.tiers) ? (meta.tiers as Array<Record<string, unknown>>) : []
  const currency = (tiers[0]?.currency as string) || 'USD'
  return {
    id: item.id || `live-event-${idx}`,
    title: item.title || `Event ${idx + 1}`,
    date: formatEventDateShort(meta.event_date as string | undefined),
    venue: (meta.venue as string) || '',
    image: item.image_url || swatch(item.title || String(idx)),
    fromPrice: typeof item.price === 'number' ? item.price : 0,
    currency,
    tag: '',
  }
}

/** "2026-05-04" → "Mon, May 4" for display; passes through older free-text values unchanged. */
function formatRecurringStartDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** "07:30" + 60 → "7:30 AM · 60 min"; passes through older free-text values unchanged. */
function formatRecurringTime(hhmm?: string, durationMinutes?: number): string {
  const duration = durationMinutes ? `${durationMinutes} min` : ''
  if (!hhmm) return duration
  const [hStr, mStr] = hhmm.split(':')
  const h = Number(hStr)
  if (Number.isNaN(h)) return [hhmm, duration].filter(Boolean).join(' · ')
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return [`${h12}:${mStr ?? '00'} ${period}`, duration].filter(Boolean).join(' · ')
}

function liveItemToRecurringPlan(item: LiveItem, idx: number) {
  const meta = (item.meta || {}) as Record<string, unknown>
  return {
    id: item.id || `live-recurring-${idx}`,
    title: item.title || `Plan ${idx + 1}`,
    image_url: item.image_url || undefined,
    startDateIso: (meta.start_date as string) || undefined,
    startDateLabel: formatRecurringStartDate(meta.start_date as string | undefined),
    timeLabel: formatRecurringTime(meta.start_time as string | undefined, Number(meta.duration_minutes) || undefined),
    pricePerSession: typeof item.price === 'number' ? item.price : Number(meta.price_per_session) || 0,
    currency: (meta.currency as string) || 'USD',
    defaultSessionCount: Number(meta.default_session_count) || 8,
    minSessions: Number(meta.min_sessions) || 2,
    maxSessions: Number(meta.max_sessions) || 24,
    showUpcoming: meta.show_upcoming !== false,
    presets: Array.isArray(meta.presets) ? meta.presets : [],
    ctaLabel: (meta.cta_label as string) || undefined,
  }
}

function liveItemToWizardStep(item: LiveItem, idx: number) {
  return {
    id: item.id || `live-wizard-step-${idx}`,
    label: item.title || `Step ${idx + 1}`,
    description: item.description || undefined,
  }
}

function liveItemToResource(item: LiveItem, idx: number) {
  const meta = (item.meta as Record<string, unknown>) || {}
  return {
    id: item.id || `live-resource-${idx}`,
    name: item.title || `Resource ${idx + 1}`,
    type: (meta.resource_type as string) || 'room',
    capacity: Number(meta.capacity) || 1,
    description: item.description || undefined,
    features: Array.isArray(meta.features) ? (meta.features as string[]) : [],
    pricePerHour: typeof item.price === 'number' ? item.price : Number(meta.price_per_hour) || 0,
    currency: (meta.currency as string) || 'USD',
    available: meta.is_available !== false,
  }
}

function hydrateMenuFromProducts(liveItems: LiveItem[]) {
  if (!liveItems.length) return

  // Group items by product category so the menu block renders proper sections
  const sectionMap = new Map<string, typeof mockMenu[0]['items']>()
  liveItems.forEach((item, idx) => {
    const cat = ((item.meta as Record<string, unknown>)?.category as string | undefined)?.trim() || 'Menu'
    if (!sectionMap.has(cat)) sectionMap.set(cat, [])
    sectionMap.get(cat)!.push({
      id: item.id || `m${idx + 1}`,
      name: item.title || `Item ${idx + 1}`,
      description: item.description || item.subtitle || '',
      price: moneyToMajor(item.price ?? (item.meta as Record<string, unknown>)?.price),
      currency: ((item.meta as Record<string, unknown>)?.currency as string) || 'INR',
      diet: [],
      popular: idx < 2,
      image: item.image_url || swatch(item.title || String(idx), 300, 300),
    })
  })

  const sections = Array.from(sectionMap.entries()).map(([name, items], si) => ({
    id: `live-${si}`,
    name,
    items,
  }))
  replaceArray(mockMenu, sections)
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

  // Hidden (is_active: false) listings are only kept in the raw feed so the builder can
  // show "X active / Y hidden" counts — they must never render in the preview or storefront.
  const liveProperties = useMemo(() => {
    if (blockType !== 'vertical.propertyListing' && blockType !== 'vertical.propertyDetail') return []
    return liveItems
      .filter((item) => (item.meta as Record<string, unknown> | undefined)?.is_active !== false)
      .slice(0, catalogLayout.itemLimit)
      .map(liveItemToProperty)
  }, [blockType, liveItems, catalogLayout.itemLimit])

  // Same hidden-course filtering as properties/plans — inactive courses never render.
  const liveCourses = useMemo(() => {
    if (blockType !== 'vertical.courseCatalog' && blockType !== 'vertical.courseDetail') return []
    const active = liveItems.filter((item) => (item.meta as Record<string, unknown> | undefined)?.is_active !== false)
    return blockType === 'vertical.courseDetail'
      ? active.map(liveItemToCourseDetail)
      : active.slice(0, catalogLayout.itemLimit).map(liveItemToCourse)
  }, [blockType, liveItems, catalogLayout.itemLimit])

  // Same hidden-class filtering as properties/courses — inactive classes never render.
  const liveClasses = useMemo(() => {
    if (blockType !== 'vertical.fitnessSchedule') return []
    return liveItems
      .filter((item) => (item.meta as Record<string, unknown> | undefined)?.is_active !== false)
      .slice(0, catalogLayout.itemLimit)
      .map(liveItemToFitnessClass)
  }, [blockType, liveItems, catalogLayout.itemLimit])

  // Same hidden-vehicle filtering as properties/courses/fitness — inactive vehicles never render.
  const liveVehicles = useMemo(() => {
    if (blockType !== 'vertical.autoInventory' && blockType !== 'vertical.vehicleDetail') return []
    const active = liveItems.filter((item) => (item.meta as Record<string, unknown> | undefined)?.is_active !== false)
    return (blockType === 'vertical.vehicleDetail' ? active : active.slice(0, catalogLayout.itemLimit)).map(liveItemToVehicle)
  }, [blockType, liveItems, catalogLayout.itemLimit])

  // Same hidden-event filtering as properties/courses/vehicles — inactive events never render.
  // Event Listing (grid/list of cards, paged by itemLimit) and Ticket Picker (every active event
  // gets its own full picker, never truncated) map the live feed into different card shapes.
  const liveEvents = useMemo(() => {
    if (blockType !== 'vertical.ticketPicker' && blockType !== 'vertical.eventListing') return []
    const active = liveItems.filter((item) => (item.meta as Record<string, unknown> | undefined)?.is_active !== false)
    return blockType === 'vertical.eventListing'
      ? active.slice(0, catalogLayout.itemLimit).map(liveItemToEventCard)
      : active.map(liveItemToEvent)
  }, [blockType, liveItems, catalogLayout.itemLimit])

  // Same hidden-plan filtering as events/vehicles — inactive recurring plans never render.
  const liveRecurringPlans = useMemo(() => {
    if (blockType !== 'booking.recurring') return []
    return liveItems
      .filter((item) => (item.meta as Record<string, unknown> | undefined)?.is_active !== false)
      .map(liveItemToRecurringPlan)
  }, [blockType, liveItems])

  // Booking Wizard steps (Sales → Booking Wizard) — inactive steps never render; the live
  // feed itself falls back to the default 5-step template when the vendor has none configured.
  const liveWizardSteps = useMemo(() => {
    if (blockType !== 'booking.wizard') return []
    return liveItems
      .filter((item) => (item.meta as Record<string, unknown> | undefined)?.is_active !== false)
      .map(liveItemToWizardStep)
  }, [blockType, liveItems])

  // Booking resources (Sales → Resources) — inactive resources never render; the live feed
  // itself falls back to demo resources when the vendor has none configured.
  const liveResources = useMemo(() => {
    if (blockType !== 'booking.resource') return []
    return liveItems
      .filter((item) => (item.meta as Record<string, unknown> | undefined)?.is_active !== false)
      .map(liveItemToResource)
  }, [blockType, liveItems])

  const def = useMemo(() => commerceBlocks.find((b) => b.id === blockType), [blockType])

  if (!def) {
    return (
      <section className={builderSectionContainerClass()}>
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
    // Recurring Booking plan fields (undefined → mock fallback; '' → hidden on storefront).
    ...(typeof props.startDate === 'string' ? { startDate: props.startDate } : {}),
    ...(typeof props.time === 'string' ? { time: props.time } : {}),
    ...((typeof props.pricePerSession === 'number' || typeof props.pricePerSession === 'string') ? { pricePerSession: props.pricePerSession } : {}),
    ...((typeof props.defaultSessionCount === 'number' || typeof props.defaultSessionCount === 'string') ? { defaultSessionCount: props.defaultSessionCount } : {}),
    ...((typeof props.minSessions === 'number' || typeof props.minSessions === 'string') ? { minSessions: props.minSessions } : {}),
    ...((typeof props.maxSessions === 'number' || typeof props.maxSessions === 'string') ? { maxSessions: props.maxSessions } : {}),
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
    ...(Array.isArray(props.presets) && props.presets.length ? { presets: props.presets } : {}),
    ...(Array.isArray(props.steps) && props.steps.length ? { steps: props.steps } : {}),
    ...(showcaseLayout ? { layout: showcaseLayout, bg_style: props.bg_style } : {}),
    // Zod schemas strip unknown keys — forward Card text so Category Showcase overlays honor it.
    ...(typeof props.tile_text === 'string' && props.tile_text.trim()
      ? { tile_text: props.tile_text.trim() }
      : {}),
    // Live-synced Property Listing / Property Detail (Sales → Property Listings). Falls back to static/mock when no live listings exist yet.
    ...(liveProperties.length ? { liveProperties } : {}),
    // Live-synced Course Catalog / Course Detail (Sales → Course Catalog). Falls back to static/mock when no live courses exist yet.
    ...(liveCourses.length ? { liveCourses } : {}),
    // Live-synced Fitness Schedule (Sales → Fitness Schedule). Falls back to static/mock when no live classes exist yet.
    ...(liveClasses.length ? { liveClasses } : {}),
    // Live-synced Auto Inventory / Vehicle Detail (Sales → Vehicle Inventory). Falls back to static/mock when no live vehicles exist yet.
    ...(liveVehicles.length ? { liveVehicles } : {}),
    // Live-synced Ticket Picker (Sales → Ticketed Events). Falls back to static/mock when no live events exist yet.
    ...(liveEvents.length ? { liveEvents } : {}),
    // Live-synced Recurring Booking (Sales → Recurring Bookings). Falls back to static/mock when no live plans exist yet.
    ...(liveRecurringPlans.length ? { liveRecurringPlans } : {}),
    // Live-synced Booking Wizard (Sales → Booking Wizard). Falls back to static/mock when no live steps exist yet.
    ...(liveWizardSteps.length ? { liveWizardSteps } : {}),
    // Live-synced Resource Picker (Sales → Resources). Falls back to static/mock when no live resources exist yet.
    ...(liveResources.length ? { liveResources } : {}),
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
