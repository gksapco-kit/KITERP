import { v4 as uuid } from 'uuid'
import { createDefaultCard } from './cardDefaults'
import type { TabCategory } from '../types/builder'

export function createDefaultTabCategory(label: string, itemOverrides?: Parameters<typeof createDefaultCard>[0][]): TabCategory {
  const items = itemOverrides?.length
    ? itemOverrides.map((o) => createDefaultCard(o))
    : [
        createDefaultCard({ title: `${label} item 1`, badge: label }),
        createDefaultCard({ title: `${label} item 2`, buttonText: 'View', link: '#products' }),
      ]
  return { id: uuid(), label, items }
}

export function defaultTabCategories(): TabCategory[] {
  return [
    createDefaultTabCategory('Featured', [
      { title: 'Premium Plan', description: 'Our most popular choice for growing teams.', price: '$49/mo', badge: 'Featured' },
      { title: 'Starter Kit', description: 'Everything you need to get going quickly.', buttonText: 'Get started', link: '#contact' },
    ]),
    createDefaultTabCategory('Services', [
      { title: 'Consulting', description: 'Expert guidance tailored to your goals.', buttonText: 'Book a call', link: '#contact' },
      { title: 'Support', description: '24/7 help when you need it most.', badge: 'Popular' },
    ]),
    createDefaultTabCategory('Products', [
      { title: 'Analytics Suite', description: 'Insights that drive better decisions.', price: '$29', link: '#products' },
      { title: 'Design Toolkit', description: 'Beautiful assets for every project.', buttonText: 'Browse', link: '#products' },
    ]),
  ]
}

export function defaultCategoryTabsProps() {
  return {
    text: 'Browse by category',
    subtitle: 'Switch tabs to explore items in each group',
    columns: 2,
    tabCategories: defaultTabCategories(),
    cardImageHeight: '176px',
    visible: true,
  }
}
