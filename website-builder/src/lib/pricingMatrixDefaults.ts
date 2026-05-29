import { v4 as uuid } from 'uuid'
import type { PricingMatrixPlan, PricingMatrixRow } from '../types/builder'

export const PRICING_MATRIX_DEFAULTS = {
  pricingMatrixLayout: 'table' as const,
  pricingMatrixTheme: 'premium' as const,
  showPricingMatrixCta: true,
}

export function createPricingMatrixPlan(overrides: Partial<PricingMatrixPlan> = {}): PricingMatrixPlan {
  return {
    id: uuid(),
    name: 'Plan',
    price: '$29',
    period: '/mo',
    buttonText: 'Get started',
    buttonLink: '#',
    enabled: true,
    ...overrides,
  }
}

export function createPricingMatrixRow(overrides: Partial<PricingMatrixRow> = {}): PricingMatrixRow {
  return {
    id: uuid(),
    feature: 'Feature name',
    cells: ['yes', 'yes', 'no'],
    enabled: true,
    ...overrides,
  }
}

export function defaultPricingMatrixPlans(): PricingMatrixPlan[] {
  return [
    createPricingMatrixPlan({
      id: 'starter',
      name: 'Starter',
      price: '$19',
      period: '/mo',
      description: 'For solo creators',
      buttonText: 'Start free trial',
    }),
    createPricingMatrixPlan({
      id: 'pro',
      name: 'Pro',
      price: '$49',
      period: '/mo',
      description: 'Growing teams',
      buttonText: 'Upgrade to Pro',
      highlighted: true,
      badge: 'Most popular',
    }),
    createPricingMatrixPlan({
      id: 'enterprise',
      name: 'Enterprise',
      price: '$99',
      period: '/mo',
      description: 'Scale without limits',
      buttonText: 'Contact sales',
    }),
  ]
}

export function defaultPricingMatrixRows(planCount = 3): PricingMatrixRow[] {
  const fill = (values: string[]) => values.slice(0, planCount).concat(Array(Math.max(0, planCount - values.length)).fill('—'))

  return [
    { id: 'projects', feature: 'Active projects', cells: fill(['3', '15', 'Unlimited']), enabled: true },
    { id: 'storage', feature: 'Storage', cells: fill(['5 GB', '50 GB', '500 GB']), enabled: true },
    { id: 'team', feature: 'Team members', cells: fill(['1', '5', 'Unlimited']), enabled: true },
    { id: 'analytics', feature: 'Advanced analytics', cells: fill(['no', 'yes', 'yes']), enabled: true },
    { id: 'support', feature: 'Priority support', cells: fill(['no', 'yes', 'yes']), enabled: true },
    { id: 'api', feature: 'API access', cells: fill(['no', 'partial', 'yes']), enabled: true },
  ]
}

export function defaultPricingMatrixProps() {
  const plans = defaultPricingMatrixPlans()
  return {
    text: 'Compare plans',
    subtitle: 'Find the right fit for your team — upgrade or downgrade anytime',
    pricingMatrixPlans: plans,
    pricingMatrixRows: defaultPricingMatrixRows(plans.length),
    ...PRICING_MATRIX_DEFAULTS,
  }
}

export function normalizeMatrixCells(cells: string[], planCount: number): string[] {
  if (cells.length === planCount) return cells
  if (cells.length > planCount) return cells.slice(0, planCount)
  return [...cells, ...Array(planCount - cells.length).fill('—')]
}
