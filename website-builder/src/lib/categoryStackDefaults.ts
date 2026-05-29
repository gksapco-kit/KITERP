import { v4 as uuid } from 'uuid'
import { createDefaultCard } from './cardDefaults'
import type { TabCategory } from '../types/builder'

function makeItems(count: number, prefix: string) {
  return Array.from({ length: count }, (_, i) =>
    createDefaultCard({
      title: `${prefix} Item ${i + 1}`,
      description: `Description for ${prefix.toLowerCase()} item ${i + 1}.`,
      badge: i % 3 === 0 ? 'New' : undefined,
      price: i % 2 === 0 ? `$${(i + 1) * 19}` : undefined,
      buttonText: 'View details',
    }),
  )
}

export function createDefaultStackCategory(label: string, itemCount = 8): TabCategory {
  return {
    id: uuid(),
    label,
    items: makeItems(itemCount, label),
  }
}

export function defaultStackCategories(): TabCategory[] {
  return [
    { ...createDefaultStackCategory('Cat 1', 12), label: 'Cat 1' },
    { ...createDefaultStackCategory('Cat 2', 8), label: 'Cat 2' },
  ]
}

export function defaultCategoryStackProps() {
  return {
    text: 'Browse collections',
    subtitle: 'Each row is a category — open See all or tap an item',
    columns: 4,
    stackSeeAllLabel: 'See all',
    stackCategories: defaultStackCategories(),
    visible: true,
  }
}
