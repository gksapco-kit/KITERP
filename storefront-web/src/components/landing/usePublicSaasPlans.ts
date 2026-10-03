import { useQuery } from '@tanstack/react-query'
import { getStorefrontApiBaseUrl } from '@/lib/apiBase'
import {
  PLAN_FEATURES,
  SAAS_PLANS,
  kitAppsLabel,
  limitLabel,
  storageLabelFromMb,
  type PlanFeatureKey,
  type PlanFeatures,
  type SaasPlan,
} from '@/components/landing/saasPlans'

type PublicPlanRow = {
  slug: string
  name: string
  description?: string | null
  price_monthly: number | string
  max_apps?: number | null
  max_products?: number | null
  max_team_members?: number | null
  max_storage_mb?: number | null
  is_featured?: boolean
  features?: Partial<Record<string, boolean>> | null
}

export function formatInr(amount: number) {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}

function liveFeatures(row: PublicPlanRow, fallback: PlanFeatures): PlanFeatures {
  const next = { ...fallback }
  for (const [key] of PLAN_FEATURES) {
    const value = row.features?.[key]
    if (typeof value === 'boolean') next[key as PlanFeatureKey] = value
  }
  return next
}

async function fetchPublicPlans(): Promise<PublicPlanRow[]> {
  const base = getStorefrontApiBaseUrl().replace(/\/$/, '')
  const response = await fetch(`${base}/vendors/plans/public`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`public plans ${response.status}`)
  const body: unknown = await response.json()
  if (!Array.isArray(body)) throw new Error('public plans payload')
  return body as PublicPlanRow[]
}

export function usePublicSaasPlans() {
  const query = useQuery({
    queryKey: ['public-saas-plans'],
    queryFn: fetchPublicPlans,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const plans: SaasPlan[] = SAAS_PLANS.map((fallback) => {
    const live = query.data?.find((row) => row.slug === fallback.slug)
    if (!live) return fallback
    const price = Number(live.price_monthly)
    if (!Number.isFinite(price)) return fallback
    return {
      ...fallback,
      name: live.name?.trim() || fallback.name,
      priceMonthly: price,
      priceLabel: formatInr(price),
      blurb: live.description?.trim() || fallback.blurb,
      appsLabel: kitAppsLabel(live.max_apps, fallback.appsLabel),
      featured: live.is_featured ?? fallback.featured,
      features: liveFeatures(live, fallback.features),
      productsLabel: limitLabel(live.max_products, fallback.productsLabel),
      teamLabel: limitLabel(live.max_team_members, fallback.teamLabel),
      storageLabel: storageLabelFromMb(live.max_storage_mb, fallback.storageLabel),
    }
  })

  const priced = [...plans].sort((a, b) => a.priceMonthly - b.priceMonthly)
  const fromPrice = priced[0]?.priceMonthly ?? 199
  const toPrice = priced[priced.length - 1]?.priceMonthly ?? fromPrice

  return {
    plans,
    fromPriceLabel: formatInr(fromPrice),
    toPriceLabel: formatInr(toPrice),
    isLoading: query.isLoading,
  }
}
