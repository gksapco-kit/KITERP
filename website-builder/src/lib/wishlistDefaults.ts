import { defaultCatalogProducts } from './productDefaults'

export const WISHLIST_DEFAULTS = {
  wishlistLayout: 'grid' as const,
  wishlistTheme: 'light' as const,
  showWishlistPrices: true,
  columns: 3,
}

export function defaultWishlistProps() {
  return {
    text: 'Your wishlist',
    subtitle: 'Save items you love and come back anytime',
    products: defaultCatalogProducts().slice(0, 4),
    buttonText: 'Add all to cart',
    ...WISHLIST_DEFAULTS,
  }
}
