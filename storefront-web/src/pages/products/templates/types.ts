import type { Product, ProductVariant, ProductCard, QuoteFormField } from '@/types'
import type { ProductColorOption, ProductCardOptionRow, VariantValidationResult } from '@/lib/variantOptions'
import type { DisplayFieldMap } from '@/lib/storefrontDisplayFields'
import type { StockValidationResult } from '@/lib/stockValidation'

export interface ProductDetailTemplateProps {
  displayFields: DisplayFieldMap
  product: Product
  selectedVariant: ProductVariant | null
  activeVariants: ProductVariant[]
  hasVariants: boolean
  selectedVariantId: string | null
  setSelectedVariantId: (id: string) => void
  qty: number
  setQty: (qty: number) => void
  validateQtyChange?: (next: number) => StockValidationResult
  maxAddQty?: number | null
  minAddQty?: number
  onHandQty?: number | null
  displayPrice: number
  /** False when price_type is not_applicable or amount is ≤ 0 — hide ₹0 on storefront. */
  hasDisplayPrice: boolean
  displayCompare?: number
  displayCurrency: string
  displayStock?: string
  displayOfferLabel?: string
  displayOnSale?: boolean
  discount: number
  variantColors: ProductColorOption[] | null
  onSelectColor: (option: ProductColorOption) => void
  optionRows: ProductCardOptionRow[]
  selections: Record<string, string>
  onSelectSize: (dimension: string, value: string) => void
  selectedColorName?: string
  variantValidation: VariantValidationResult
  hasStructuredOptions: boolean
  selectedImage: number
  setSelectedImage: (i: number) => void
  displayMedia: { id: string; url: string; alt_text?: string; is_primary: boolean; media_type?: 'image' | 'video' | 'model3d' }[]
  handleAddToCart: () => void
  handleBuyNow: () => void
  handleSubscribe?: (config: {
    interval: string; cycles: number; total: number
    startDate: string; endDate: string
    selectedDates?: string[]; weeklyDay?: number
    recurrence?: { every: number; unit: string; weekdays?: number[] }
  }) => void
  subscribePending?: boolean
  isAuthenticated: boolean
  signInMandatory?: boolean
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
  isTaxable?: boolean
  taxRate?: number | null
  // Quote Request
  canQuote: boolean
  quoteFormConfig?: QuoteFormField[]
  showQuote: boolean
  setShowQuote: (v: boolean) => void
  requestQuote: { mutate: (data: any, opts?: any) => void; isPending: boolean }
  customerInfo?: { name?: string; email?: string; phone?: string }
}
