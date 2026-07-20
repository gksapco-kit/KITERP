/**
 * Shared fallbacks for service price/duration display across storefront pages.
 *
 * Services created with per-plan pricing (Sales → Services → "Add plan") often have no
 * top-level price set — the real price lives on the first plan instead. Without this
 * fallback, listing/booking pages show "₹0" even though the service is fully priced.
 */
type PlanLike = {
  price?: number | null
  duration_minutes?: number | null
  is_active?: boolean
  sort_order?: number
}

type ServiceLike = {
  price?: number | null
  price_min?: number | null
  price_type?: string | null
  duration_minutes?: number | null
  plans?: PlanLike[] | null
}

function firstUsablePlan(plans: PlanLike[] | null | undefined): PlanLike | undefined {
  if (!plans?.length) return undefined
  const active = plans.filter(p => p.is_active !== false)
  const pool = active.length ? active : plans
  return [...pool].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]
}

/** Resolve a displayable price: service price → price_min → first plan's price → 0. */
export function resolveServicePrice(service: ServiceLike | null | undefined): number {
  if (!service) return 0
  if (service.price != null) return service.price
  if (service.price_min != null) return service.price_min
  const plan = firstUsablePlan(service.plans)
  return plan?.price ?? 0
}

/** True when a numeric price should be shown as currency (not Free / quote). */
export function isPricedAmount(price: number | null | undefined): price is number {
  return price != null && price > 0
}

/** Hide PRICE on business front — customers use quotation instead of RFQ/currency. */
export function isPriceNotApplicable(priceType?: string | null): boolean {
  return priceType === 'not_applicable'
}

/**
 * Storefront price label when currency should not be shown.
 * Matches vendor admin + Home: free → "Free", zero/null/quote → quote fallback.
 * Returns null when price is not applicable (caller should hide the price UI).
 */
export function servicePriceFallbackLabel(
  price: number | null | undefined,
  priceType?: string | null,
  quoteLabel = 'Get a Quote',
): string | null {
  if (isPriceNotApplicable(priceType)) return null
  if (priceType === 'free') return 'Free'
  if (!isPricedAmount(price)) return quoteLabel
  return quoteLabel
}

/** Resolve a displayable duration (minutes): service duration → first plan's duration → default. */
export function resolveServiceDuration(service: ServiceLike | null | undefined, fallback = 60): number {
  if (!service) return fallback
  if (service.duration_minutes != null) return service.duration_minutes
  const plan = firstUsablePlan(service.plans)
  return plan?.duration_minutes ?? fallback
}
