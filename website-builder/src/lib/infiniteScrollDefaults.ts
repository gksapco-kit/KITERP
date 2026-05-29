import { defaultCatalogProducts } from './productDefaults'

export const INFINITE_SCROLL_DEFAULTS = {
  infiniteScrollInitialCount: 3,
  infiniteScrollLoadCount: 3,
  infiniteScrollTrigger: 'button' as const,
  infiniteScrollColumns: 3,
  showInfiniteScrollLoader: true,
  showInfiniteScrollPrices: true,
}

export function defaultInfiniteScrollProps() {
  return {
    text: 'Shop all products',
    subtitle: 'Scroll or load more to discover the full collection',
    products: [
      ...defaultCatalogProducts(),
      ...defaultCatalogProducts().map((p, i) => ({ ...p, id: `${p.id}-dup-${i}`, name: `${p.name} (Alt)` })),
    ],
    buttonText: 'Load more',
    ...INFINITE_SCROLL_DEFAULTS,
  }
}
