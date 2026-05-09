// Storefront data contract — every template only depends on this interface.

export interface Money {
  amount: number; // minor units (cents/paise)
  currency: string; // ISO 4217, e.g. "USD", "INR"
}

export interface Image {
  url: string;
  alt: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description?: string;
  image?: Image;
  parentId?: string | null;
}

export interface ProductVariant {
  id: string;
  name: string;
  options: Record<string, string>;
  price: Money;
  compareAtPrice?: Money;
  inStock: boolean;
  sku?: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  brand?: string;
  categoryIds: string[];
  images: Image[];
  variants: ProductVariant[];
  rating?: { value: number; count: number };
  tags?: string[];
  attributes?: Record<string, string>;
  badges?: string[];
}

export interface CartLine {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  /** Rich metadata needed by the checkout UI — populated on add */
  name: string;
  variantLabel?: string;
  imageUrl?: string;
  unitPrice: Money;
  inStock?: boolean;
  maxQuantity?: number;
  /** For services: duration in minutes */
  durationMinutes?: number;
  /** For services: provider name */
  providerName?: string;
}

export interface Cart {
  id: string;
  lines: CartLine[];
  subtotal: Money;
  total: Money;
}

export interface ListProductsParams {
  categorySlug?: string;
  query?: string;
  tag?: string;
  limit?: number;
  cursor?: string;
}

export interface ListProductsResult {
  items: Product[];
  nextCursor?: string;
  total: number;
}

export interface ServiceProvider {
  id: string;
  name: string;
  role: string;
  avatar?: Image;
  bio?: string;
}

export interface ServiceItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  durationMinutes: number;
  price: Money;
  image?: Image;
  providerIds: string[];
}

export interface AddToCartInput {
  productId: string
  variantId: string
  quantity: number
  name: string
  variantLabel?: string
  imageUrl?: string
  unitPrice: Money
  inStock?: boolean
  maxQuantity?: number
  durationMinutes?: number
  providerName?: string
}

export interface StorefrontDataAdapter {
  listCategories(): Promise<Category[]>;
  listProducts(params?: ListProductsParams): Promise<ListProductsResult>;
  getProduct(slug: string): Promise<Product | null>;
  getCart(cartId?: string): Promise<Cart>;
  addToCart(input: AddToCartInput & { cartId?: string }): Promise<Cart>;
  updateCartLine(input: { cartId: string; lineId: string; quantity: number }): Promise<Cart>;
  removeCartLine(input: { cartId: string; lineId: string }): Promise<Cart>;
  listServices?(): Promise<ServiceItem[]>;
  listProviders?(): Promise<ServiceProvider[]>;
}
