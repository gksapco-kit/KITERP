import { defaultCatalogProducts } from './productDefaults'

export const RECENTLY_VIEWED_DEFAULTS = {
  recentlyViewedLayout: 'scroll' as const,
  recentlyViewedTheme: 'light' as const,
  showRecentlyViewedPrices: true,
}

export function defaultRecentlyViewedProps() {
  return {
    text: 'Recently viewed',
    subtitle: 'Pick up where you left off',
    products: defaultCatalogProducts(),
    ...RECENTLY_VIEWED_DEFAULTS,
  }
}
