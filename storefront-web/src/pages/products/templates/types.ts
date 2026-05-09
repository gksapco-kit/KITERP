import type { Product, ProductVariant, ProductCard, QuoteFormField } from '@/types'

export interface ProductDetailTemplateProps {
  product: Product
  selectedVariant: ProductVariant | null
  activeVariants: ProductVariant[]
  hasVariants: boolean
  selectedVariantId: string | null
  setSelectedVariantId: (id: string) => void
  qty: number
  setQty: (qty: number) => void
  displayPrice: number
  displayCompare?: number
  displayCurrency: string
  displayStock?: string
  displayOfferLabel?: string
  displayOnSale?: boolean
  discount: number
  variantColors: { id: string; color: string; name: string }[] | null
  selectedImage: number
  setSelectedImage: (i: number) => void
  displayMedia: { id: string; url: string; alt_text?: string; is_primary: boolean; media_type?: 'image' | 'video' | 'model3d' }[]
  handleAddToCart: () => void
  handleBuyNow: () => void
  isAuthenticated: boolean
  addToCartPending: boolean
  storePath: (p: string) => string
  warrantyDays?: number
  warrantyType?: string
  returnDays?: number
  returnPolicy?: string
  returnConditions?: string
  refundPolicy?: string
  isReturnable?: boolean
  specs: Record<string, string> | null
  crossSellProducts: ProductCard[]
  upsellProducts: ProductCard[]
  // Subscription
  isSubscription: boolean
  subscriptionInterval?: string
  subscriptionPrice?: number
  subscriptionPriceType?: string
  subscriptionUom?: string
  subscriptionTrialDays?: number
  subscriptionSetupFee?: number
  subscriptionBillingCycles?: number
  subscriptionScheduleModes?: string[]
  // Quote Request
  canQuote: boolean
  quoteFormConfig?: QuoteFormField[]
  showQuote: boolean
  setShowQuote: (v: boolean) => void
  requestQuote: { mutate: (data: any, opts?: any) => void; isPending: boolean }
  customerInfo?: { name?: string; email?: string; phone?: string }
}
