import { v4 as uuid } from 'uuid'
import type { CatalogProduct } from '../types/builder'

const IMG = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80'

export function createDefaultProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: uuid(),
    name: 'New Product',
    price: 29.99,
    imageUrl: IMG,
    description: 'Describe your product here.',
    ...overrides,
  }
}

export function defaultCatalogProducts(): CatalogProduct[] {
  return [
    createDefaultProduct({ name: 'Classic Tee', price: 29.99, description: 'Soft cotton, everyday comfort.' }),
    createDefaultProduct({ name: 'Wireless Earbuds', price: 79.99, description: 'Crystal-clear sound on the go.', imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80' }),
    createDefaultProduct({ name: 'Leather Wallet', price: 49.99, description: 'Slim profile, premium leather.', imageUrl: 'https://images.unsplash.com/photo-1627123427854-0294bb31cc2f?w=400&q=80' }),
  ]
}

export const PRODUCT_LISTING_DEFAULTS = {
  columns: 3,
  showPrices: true,
  showAddToCart: true,
}

export function defaultProductListingProps(products = defaultCatalogProducts()) {
  return {
    text: 'Our Products',
    subtitle: 'Browse our collection and add items to your cart.',
    products,
    showViewAllButton: false,
    viewAllButtonText: 'View all',
    viewAllButtonLink: '#products',
    cardImageHeight: '208px',
    ...PRODUCT_LISTING_DEFAULTS,
  }
}

export function resolveBlockProducts(
  props: { products?: CatalogProduct[] },
  catalogProducts: CatalogProduct[],
): CatalogProduct[] {
  if (props.products && props.products.length > 0) return props.products
  return catalogProducts
}
