import { useMemo, type ComponentType, type CSSProperties } from 'react'
import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import { blocks as commerceBlocks } from '@/commerce-blocks/blocks/registry'
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
  if (!liveItems.length) return
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
  if (!liveItems.length) return
  if (blockType.startsWith('product.') || blockType.startsWith('commerce.')) {
    hydrateProducts(liveItems)
    hydrateCategories(liveItems)
  } else if (blockType.startsWith('service.')) {
    if (blockType.includes('testimonial')) hydrateTestimonials(liveItems)
    else if (blockType.includes('team')) hydrateTeam(liveItems)
    else hydrateServices(liveItems)
  } else if (blockType.startsWith('menu.')) {
    hydrateMenuFromProducts(liveItems)
  }
}

export default function CommerceLibraryBlock({ props, liveItems, blockType }: Props) {
  useMemo(() => {
    hydrateLiveData(blockType, liveItems)
  }, [blockType, liveItems])

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

  const variantId = (props.variant as string) || (props.layout as string) || def.defaultVariantId || def.variants[0]?.id
  const variant = def.variants.find((v) => v.id === variantId) || def.variants[0]
  const Component = variant.Component as ComponentType<Record<string, unknown>>
  const parsedProps = def.propsSchema.safeParse({ ...def.defaultProps, ...props })
  const componentProps = parsedProps.success ? parsedProps.data : { ...def.defaultProps, ...props }

  return (
    <div
      className="commerce-block bg-background text-foreground"
      style={{
        // Match the semantic token system shipped in commerce-blocks.zip.
        '--background': '0 0% 100%',
        '--foreground': '222 20% 12%',
        '--card': '0 0% 100%',
        '--card-foreground': '222 20% 12%',
        '--primary': '222 47% 20%',
        '--primary-foreground': '210 40% 98%',
        '--secondary': '210 20% 96%',
        '--secondary-foreground': '222 47% 15%',
        '--muted': '210 20% 96%',
        '--muted-foreground': '215 14% 45%',
        '--accent': '210 20% 94%',
        '--accent-foreground': '222 47% 15%',
        '--destructive': '0 75% 55%',
        '--destructive-foreground': '0 0% 100%',
        '--success': '142 65% 38%',
        '--success-foreground': '0 0% 100%',
        '--warning': '38 92% 50%',
        '--warning-foreground': '26 60% 12%',
        '--border': '214 22% 90%',
        '--input': '214 22% 90%',
        '--ring': '222 47% 20%',
        '--radius': '0.625rem',
      } as CSSProperties}
    >
      <Component {...componentProps} />
    </div>
  )
}
