import type { LiveItem } from '@/blocks/registry'

export type PricingPlanItem = {
  name: string
  price: number | string
  period?: string
  features: string[]
  highlighted?: boolean
  cta: string
  cta_url?: string
}

/** Block is synced to Sales → Pricing Plans (live ERP feed). */
export function isLivePlansDataSource(props: Record<string, unknown>): boolean {
  const ds = props.data_source as { type?: string } | undefined
  const t = typeof ds?.type === 'string' ? ds.type.replace(/^internal_/, '') : ''
  return t === 'plans'
}

export function filterActivePricingLiveItems(
  items: LiveItem[],
  includeInactive: boolean,
): LiveItem[] {
  if (includeInactive) return items
  return items.filter(item => item.meta?.is_active !== false)
}

export function liveItemsToPricingPlans(items: LiveItem[]): PricingPlanItem[] {
  const plans: PricingPlanItem[] = []
  for (const item of items) {
    const name = String(item.title ?? '').trim()
    if (!name) continue
    const meta = item.meta ?? {}
    const features = Array.isArray(meta.features)
      ? meta.features.map(f => String(f)).filter(Boolean)
      : []
    const currency = String(meta.currency ?? 'INR').trim()
    const priceVal = item.price
    let price: number | string
    if (priceVal != null && Number.isFinite(Number(priceVal))) {
      price = currency === 'INR'
        ? `₹${Number(priceVal).toLocaleString('en-IN')}`
        : `${currency} ${Number(priceVal).toLocaleString()}`
    } else if (item.price_formatted) {
      price = String(item.price_formatted)
    } else {
      price = '—'
    }
    plans.push({
      name,
      price,
      period: String(meta.period ?? item.subtitle ?? 'mo'),
      features,
      highlighted: Boolean(meta.highlighted ?? meta.is_featured),
      cta: String(meta.cta_label ?? 'Get started'),
      cta_url: String(meta.cta_url ?? item.url ?? '/contact'),
    })
  }
  return plans
}

export function resolvePricingPlans(
  props: Record<string, unknown>,
  liveItems: LiveItem[],
  options?: { includeInactive?: boolean },
): PricingPlanItem[] {
  const includeInactive = options?.includeInactive ?? false
  const synced = isLivePlansDataSource(props)
  const filteredLive = filterActivePricingLiveItems(liveItems, includeInactive)

  // Synced blocks always use the live feed — never stale props.plans snapshots.
  if (synced || filteredLive.length > 0) {
    return liveItemsToPricingPlans(filteredLive)
  }

  const raw = (props.plans as PricingPlanItem[] | undefined) || []
  return raw
}
