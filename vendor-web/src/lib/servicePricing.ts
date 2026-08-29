import { formatCurrency } from '@/lib/utils'

type PlanLike = {
  price?: number | null
  price_min?: number | null
  price_max?: number | null
  plan_price_type?: string | null
  is_active?: boolean
  sort_order?: number
}

export type ServicePriceLike = {
  price?: number | null
  price_min?: number | null
  price_max?: number | null
  price_type?: string | null
  currency?: string | null
  plans?: PlanLike[] | null
}

function isPricedAmount(price: number | null | undefined): price is number {
  return price != null && Number(price) > 0
}

function planAmounts(plan: PlanLike): number[] {
  if (plan.plan_price_type === 'not_applicable' || plan.plan_price_type === 'free') return []
  const amounts: number[] = []
  if (isPricedAmount(plan.price)) amounts.push(Number(plan.price))
  if (isPricedAmount(plan.price_min)) amounts.push(Number(plan.price_min))
  if (isPricedAmount(plan.price_max)) amounts.push(Number(plan.price_max))
  return amounts
}

/** All displayable amounts: service price, range, then active plan prices. */
export function collectServicePrices(service: ServicePriceLike | null | undefined): number[] {
  if (!service) return []
  if (service.price_type === 'not_applicable' || service.price_type === 'free') return []

  const amounts: number[] = []
  if (isPricedAmount(service.price)) amounts.push(Number(service.price))
  if (isPricedAmount(service.price_min)) amounts.push(Number(service.price_min))
  if (isPricedAmount(service.price_max)) amounts.push(Number(service.price_max))

  const plans = service.plans || []
  const active = plans.filter((p) => p.is_active !== false)
  const pool = [...(active.length ? active : plans)].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  for (const plan of pool) {
    amounts.push(...planAmounts(plan))
  }

  return amounts
}

/** Lowest displayable amount — used for sort and share text. */
export function resolveServiceDisplayAmount(service: ServicePriceLike | null | undefined): number {
  const amounts = collectServicePrices(service)
  return amounts.length ? Math.min(...amounts) : 0
}

export function formatServiceListPrice(service: ServicePriceLike | null | undefined): {
  text: string
  sub: string
  hasAmount: boolean
} {
  if (!service) return { text: '—', sub: '', hasAmount: false }
  if (service.price_type === 'not_applicable') return { text: '—', sub: '', hasAmount: false }
  if (service.price_type === 'free') return { text: 'Free', sub: '', hasAmount: false }

  const currency = service.currency || 'INR'
  const amounts = collectServicePrices(service)
  if (!amounts.length) {
    if (service.price_type === 'quote') return { text: 'Quote', sub: '', hasAmount: false }
    return { text: '—', sub: '', hasAmount: false }
  }

  const low = Math.min(...amounts)
  const high = Math.max(...amounts)
  const text =
    low === high
      ? formatCurrency(low, currency)
      : `${formatCurrency(low, currency)} – ${formatCurrency(high, currency)}`

  const pricedPlans = (service.plans || []).filter((p) => planAmounts(p).length > 0)
  const fromPlans = !isPricedAmount(service.price) && !isPricedAmount(service.price_min) && pricedPlans.length > 0
  const sub = fromPlans
    ? pricedPlans.length === 1
      ? 'from plan'
      : `from ${pricedPlans.length} plans`
    : ''

  return { text, sub, hasAmount: true }
}
