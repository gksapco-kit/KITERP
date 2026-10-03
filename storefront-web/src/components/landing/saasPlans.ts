/** Public SaaS plans shown on the KIT ERP landing page (#pricing). */
export type SaasPlanSlug = 'starter' | 'growth' | 'professional'

export const PLAN_FEATURES = [
  ['branded_app', 'Branded App'],
  ['custom_domain', 'Custom Domain'],
  ['analytics', 'Analytics'],
  ['api_access', 'API Access'],
  ['priority_support', 'Priority Support'],
  ['white_label', 'White Label'],
  ['restaurant', 'Restaurant'],
  ['pos', 'POS'],
] as const

export type PlanFeatureKey = (typeof PLAN_FEATURES)[number][0]
export type PlanFeatures = Record<PlanFeatureKey, boolean>

export type SaasPlan = {
  slug: SaasPlanSlug
  name: string
  priceMonthly: number
  priceLabel: string
  blurb: string
  appsLabel: string
  featured?: boolean
  cta: string
  features: PlanFeatures
  productsLabel: string
  teamLabel: string
  storageLabel: string
}

const starterFeatures: PlanFeatures = {
  branded_app: false,
  custom_domain: false,
  analytics: true,
  api_access: false,
  priority_support: false,
  white_label: false,
  restaurant: true,
  pos: true,
}

const growthFeatures: PlanFeatures = {
  branded_app: false,
  custom_domain: true,
  analytics: true,
  api_access: false,
  priority_support: true,
  white_label: false,
  restaurant: true,
  pos: true,
}

const professionalFeatures: PlanFeatures = {
  branded_app: true,
  custom_domain: true,
  analytics: true,
  api_access: true,
  priority_support: true,
  white_label: false,
  restaurant: true,
  pos: true,
}

export const SAAS_PLANS: SaasPlan[] = [
  {
    slug: 'starter',
    name: 'Starter',
    priceMonthly: 199,
    priceLabel: '₹199',
    blurb: 'My Kit plus any 1 app. Upgrade anytime for more modules.',
    appsLabel: 'My Kit + 1 app',
    cta: 'Start with Starter',
    features: starterFeatures,
    productsLabel: '100',
    teamLabel: '3',
    storageLabel: '2 GB',
  },
  {
    slug: 'growth',
    name: 'Growth',
    priceMonthly: 599,
    priceLabel: '₹599',
    blurb: 'My Kit plus up to 6 apps. Best for growing teams.',
    appsLabel: 'My Kit + 6 apps',
    featured: true,
    cta: 'Choose Growth',
    features: growthFeatures,
    productsLabel: '1,000',
    teamLabel: '10',
    storageLabel: '10 GB',
  },
  {
    slug: 'professional',
    name: 'Professional',
    priceMonthly: 999,
    priceLabel: '₹999',
    blurb: 'My Kit plus all apps — full KIT ERP platform.',
    appsLabel: 'My Kit + All apps',
    cta: 'Go Professional',
    features: professionalFeatures,
    productsLabel: '∞',
    teamLabel: '50',
    storageLabel: '50 GB',
  },
]

export function saasSignupHref(slug: SaasPlanSlug): string {
  return `/create-business?plan=${slug}`
}

export function kitAppsLabel(maxApps: number | null | undefined, fallback: string) {
  if (maxApps == null || Number.isNaN(Number(maxApps))) return fallback
  const limit = Number(maxApps)
  if (limit < 0) return 'My Kit + All apps'
  if (limit === 1) return 'My Kit + 1 app'
  return `My Kit + ${limit} apps`
}

export function limitLabel(value: number | null | undefined, fallback: string) {
  if (value == null || Number.isNaN(Number(value))) return fallback
  const amount = Number(value)
  if (amount < 0) return '∞'
  return amount.toLocaleString('en-IN')
}

export function storageLabelFromMb(mb: number | null | undefined, fallback: string) {
  if (mb == null || Number.isNaN(Number(mb))) return fallback
  const value = Number(mb)
  if (value < 0) return '∞'
  if (value >= 1000) {
    const gb = value / 1000
    const text = Number.isInteger(gb) ? String(gb) : gb.toFixed(1)
    return `${text} GB`
  }
  return `${value} MB`
}
