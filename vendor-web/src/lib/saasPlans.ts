/** Canonical public SaaS tiers — must match backend PUBLIC_SAAS_PLAN_SLUGS. */
export const SAAS_PLAN_SLUGS = ['starter', 'growth', 'professional'] as const

export type SaasPlanSlug = (typeof SAAS_PLAN_SLUGS)[number]

export function isSaasPlanSlug(slug: string | null | undefined): slug is SaasPlanSlug {
  return SAAS_PLAN_SLUGS.includes((slug || '').trim().toLowerCase() as SaasPlanSlug)
}

export function sortSaasPlans<T extends { slug: string }>(plans: T[]): T[] {
  return [...plans].sort(
    (a, b) =>
      SAAS_PLAN_SLUGS.indexOf(a.slug as SaasPlanSlug) -
      SAAS_PLAN_SLUGS.indexOf(b.slug as SaasPlanSlug),
  )
}

export function filterPublicSaasPlans<T extends { slug: string }>(plans: T[] | undefined): T[] {
  if (!plans?.length) return []
  return sortSaasPlans(plans.filter((p) => isSaasPlanSlug(p.slug)))
}
