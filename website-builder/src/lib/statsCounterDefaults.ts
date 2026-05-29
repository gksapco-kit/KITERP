import { v4 as uuid } from 'uuid'
import type { StatCounterItem } from '../types/builder'

export const STATS_COUNTER_DEFAULTS = {
  statsCounterLayout: 'grid' as const,
  statsDivider: true,
}

export function createStatItem(overrides: Partial<StatCounterItem> = {}): StatCounterItem {
  return {
    id: uuid(),
    value: '100',
    label: 'Stat label',
    enabled: true,
    ...overrides,
  }
}

export function defaultStatItems(): StatCounterItem[] {
  return [
    { id: 'customers', value: '50K+', label: 'Happy customers', icon: 'users', enabled: true },
    { id: 'countries', value: '120+', label: 'Countries served', icon: 'globe', enabled: true },
    { id: 'rating', value: '4.9', label: 'Average rating', icon: 'star', enabled: true },
    { id: 'support', value: '24/7', label: 'Customer support', icon: 'headphones', enabled: true },
  ]
}

export function defaultStatsCounterProps() {
  return {
    text: 'By the numbers',
    subtitle: 'Trusted by shoppers and brands worldwide',
    statItems: defaultStatItems(),
    ...STATS_COUNTER_DEFAULTS,
  }
}
