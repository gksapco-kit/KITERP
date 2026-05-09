export type ProductStatus = 'draft' | 'active' | 'archived'

export interface ProductVariant {
  id: string
  name: string
  sku?: string
  price: number
  compare_at_price?: number
  cost_price?: number
  quantity: number
  attributes: Record<string, string>
  is_active: boolean
  created_at: string
}

export interface ProductImage {
  id: string
  url: string
  alt_text?: string
  position: number
  is_primary: boolean
}

export interface ProductCreate {
  name: string
  slug?: string
  description?: string
  short_description?: string
  category?: string
  subcategory?: string
  tags: string[]
  price: number
  compare_at_price?: number
  cost_price?: number
  currency: string
  is_taxable: boolean
  tax_rate?: number
  hsn_code?: string
  sku?: string
  barcode?: string
  track_inventory: boolean
  quantity: number
  low_stock_threshold: number
  is_featured: boolean
  is_visible: boolean
  meta_title?: string
  meta_description?: string
  attributes?: Record<string, unknown>
  specifications?: Record<string, unknown>
}

export interface ProductUpdate {
  name?: string
  description?: string
  short_description?: string
  category?: string
  subcategory?: string
  tags?: string[]
  price?: number
  compare_at_price?: number
  cost_price?: number
  is_taxable?: boolean
  tax_rate?: number
  hsn_code?: string
  sku?: string
  barcode?: string
  track_inventory?: boolean
  quantity?: number
  low_stock_threshold?: number
  status?: ProductStatus
  is_featured?: boolean
  is_visible?: boolean
  meta_title?: string
  meta_description?: string
  attributes?: Record<string, unknown>
  specifications?: Record<string, unknown>
}

export interface Product {
  id: string
  vendor_id: string
  name: string
  slug: string
  description?: string
  short_description?: string
  category?: string
  subcategory?: string
  tags: string[]
  price: number
  compare_at_price?: number
  cost_price?: number
  currency: string
  is_taxable: boolean
  tax_rate?: number
  hsn_code?: string
  sku?: string
  barcode?: string
  track_inventory: boolean
  quantity: number
  low_stock_threshold: number
  status: ProductStatus
  is_featured: boolean
  is_visible: boolean
  meta_title?: string
  meta_description?: string
  attributes: Record<string, unknown>
  specifications: Record<string, unknown>
  variants: ProductVariant[]
  images: ProductImage[]
  created_at: string
  updated_at: string
  published_at?: string
}

export interface ProductListResponse {
  items: Product[]
  total: number
  page: number
  size: number
  pages: number
}
