import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProduct, useAddToCart, useRequestQuote, useCreateSubscription } from '@/hooks/useStore'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Loader2, ShoppingBag } from 'lucide-react'
import type { ProductVariant } from '@/types'
import {
  buildProductCardOptionRows,
  getProductPageColorOptions,
  resolveVariantForCardPricing,
  selectionsFromVariant,
  validateVariantCombination,
  type ProductCardOptionRow,
  type ProductColorOption,
  variantDisplayLabel,
} from '@/lib/variantOptions'
import { ClassicDetail, ModernDetail, MinimalDetail, ProductQuoteModal } from './templates'
import { trackView } from '@/lib/recentlyViewed'
import { assertCanAddToCart, getMaxAddQuantity } from '@/lib/stockValidation'
import { toast } from 'sonner'

export default function ProductDetail() {
  const { storePath, vendorSlug, displayFields } = useVendor()
  const sf = displayFields.product
  const { product_detail_template } = useTheme()
  const { slug } = useParams<{ slug: string }>()
  const { data: product, isLoading } = useProduct(slug!)
  const addToCart = useAddToCart()
  const navigate = useNavigate()
  const { isAuthenticated, customer } = useAuthStore()
  const requestQuote = useRequestQuote()
  const createSubscription = useCreateSubscription()
  const [qty, setQty] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [showQuote, setShowQuote] = useState(false)

  const handleSelectVariant = (id: string) => {
    setSelectedVariantId(id)
    setSelectedImage(0)
  }

  const activeVariants = useMemo(
    () => (product?.variants || []).filter(v => v.is_active !== false),
    [product?.variants],
  )

  const hasVariants = activeVariants.length > 0

  const [selectedColorName, setSelectedColorName] = useState<string | undefined>(undefined)
  const [selections, setSelections] = useState<Record<string, string>>({})

  const optionRows = useMemo(
    () => (product ? buildProductCardOptionRows(activeVariants, product.images) : []),
    [activeVariants, product?.images, product],
  )
  const hasStructuredOptions = optionRows.length > 0

  useEffect(() => {
    if (!product || !activeVariants.length) return
    const first = activeVariants.find((v) => v.is_active !== false) ?? activeVariants[0]
    const nextSelections = selectionsFromVariant(first)
    setSelections(nextSelections)
    setSelectedVariantId(first.id)
    const colors = getProductPageColorOptions(activeVariants, product.images)
    const colorRow = optionRows.find((r) => r.type === 'color')
    if (colorRow?.type === 'color') {
      const match = colorRow.swatches.find((s) => s.variantId === first.id)
      setSelectedColorName(match?.value ?? colors[0]?.name)
    } else {
      setSelectedColorName(undefined)
    }
  }, [product?.id, activeVariants.length])

  const variantValidation = useMemo(
    () => validateVariantCombination(activeVariants, selections, selectedColorName),
    [activeVariants, selections, selectedColorName],
  )

  const handleSelectColor = (option: ProductColorOption) => {
    setSelectedColorName(option.name)
    setSelectedVariantId(option.variantId)
    if (option.imageIndex != null) setSelectedImage(option.imageIndex)
    else setSelectedImage(0)
  }

  const handleSelectSize = (dimension: string, value: string) => {
    setSelections((prev) => ({ ...prev, [dimension]: value }))
  }

  useEffect(() => {
    if (variantValidation.valid && variantValidation.variant) {
      setSelectedVariantId(variantValidation.variant.id)
    }
  }, [variantValidation.valid, variantValidation.variant?.id])

  const selectedVariant: ProductVariant | null = useMemo(() => {
    if (!hasVariants) return null
    if (variantValidation.valid && variantValidation.variant) {
      return activeVariants.find((v) => v.id === variantValidation.variant!.id) || activeVariants[0]
    }
    if (selectedVariantId) return activeVariants.find(v => v.id === selectedVariantId) || activeVariants[0]
    return activeVariants[0]
  }, [hasVariants, variantValidation, selectedVariantId, activeVariants])

  const pricingVariant = useMemo(() => {
    if (!hasVariants || !product) return selectedVariant
    return (
      resolveVariantForCardPricing(activeVariants, optionRows, selections, selectedColorName) ??
      selectedVariant
    )
  }, [hasVariants, product, activeVariants, optionRows, selections, selectedColorName, selectedVariant])

  const displayPrice = pricingVariant?.price ?? product?.price ?? 0
  const displayCompare = pricingVariant?.compare_at_price ?? product?.compare_at_price
  const displayCurrency = pricingVariant?.currency ?? product?.currency ?? 'INR'
  const displayStock = pricingVariant?.stock_status ?? product?.stock_status
  const displayOfferLabel = pricingVariant?.offer_label ?? product?.offer_label
  const displayOnSale = pricingVariant?.is_on_sale ?? product?.is_on_sale

  const maxAddQty = useMemo(() => {
    if (!product) return null
    const variant = pricingVariant ?? selectedVariant ?? undefined
    return getMaxAddQuantity({
      vendorSlug,
      isAuthenticated,
      productId: product.id,
      product,
      variant: variant ?? undefined,
    })
  }, [product, pricingVariant, selectedVariant, vendorSlug, isAuthenticated])

  useEffect(() => {
    if (maxAddQty === null || maxAddQty < 1) return
    setQty((current) => (current > maxAddQty ? maxAddQty : current))
  }, [maxAddQty, pricingVariant?.id, selectedVariant?.id])

  useEffect(() => {
    if (!product) return
    trackView({
      id: product.id,
      title: product.name,
      url: `${storePath('/products')}/${product.slug}`,
      image_url: product.images?.[0]?.url || null,
      price: displayPrice,
      currency: displayCurrency,
    })
  }, [product?.id, displayPrice, displayCurrency, storePath, product?.images, product?.name, product?.slug])

  const variantColors = useMemo(() => {
    const options = getProductPageColorOptions(activeVariants, product?.images)
    return options.length > 0 ? options : null
  }, [activeVariants, product?.images])

  // Variant media priority: if selected variant has its own media, use it; otherwise fall back to product media
  const displayMedia = useMemo(() => {
    const vm = selectedVariant?.media
    if (vm && vm.length > 0) return vm.map(m => ({ id: m.url, url: m.url, alt_text: m.alt_text, is_primary: m.is_primary, media_type: m.media_type }))
    return product?.images || []
  }, [selectedVariant, product?.images])

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8 animate-pulse">
          <div className="aspect-square bg-muted rounded-lg" />
          <div className="space-y-4">
            <div className="h-6 bg-muted rounded w-3/4" />
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-20 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
          </div>
        </div>
      </div>
    )
  }
  if (!product) {
    return (
      <div className="text-center py-20">
        <ShoppingBag className="w-16 h-16 text-gray-200 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-1">Product not found</h2>
        <p className="text-gray-500 text-sm">This product may have been removed or is no longer available.</p>
      </div>
    )
  }

  const handleSetQty = (next: number) => {
    const newQty = Math.max(1, next)
    const variant = pricingVariant ?? selectedVariant ?? undefined
    const stockCheck = assertCanAddToCart({
      vendorSlug,
      isAuthenticated,
      productId: product.id,
      productName: product.name,
      product,
      variant: variant ?? undefined,
      variantLabel: variant ? variantDisplayLabel(variant) || variant.name : undefined,
      requestQty: newQty,
    })
    if (!stockCheck.ok) {
      toast.error(stockCheck.message)
      return
    }
    setQty(newQty)
  }

  const handleAddToCart = () => {
    if (!variantValidation.valid || !product) return
    const stockCheck = assertCanAddToCart({
      vendorSlug,
      isAuthenticated,
      productId: product.id,
      productName: product.name,
      product,
      variant: selectedVariant ?? undefined,
      variantLabel: selectedVariant
        ? variantDisplayLabel(selectedVariant) || selectedVariant.name
        : undefined,
      requestQty: qty,
    })
    if (!stockCheck.ok) {
      toast.error(stockCheck.message)
      return
    }
    const img = displayMedia?.[0]?.url || product.images?.[0]?.url || ''
    addToCart.mutate({
      product_id: product.id,
      variant_id: selectedVariant?.id,
      variant_label: selectedVariant ? variantDisplayLabel(selectedVariant) || selectedVariant.name : undefined,
      slug: product.slug,
      name: product.name,
      qty,
      price: displayPrice,
      image_url: img,
    })
  }

  const handleBuyNow = () => {
    if (!variantValidation.valid || !product) return
    const stockCheck = assertCanAddToCart({
      vendorSlug,
      isAuthenticated,
      productId: product.id,
      productName: product.name,
      product,
      variant: selectedVariant ?? undefined,
      variantLabel: selectedVariant
        ? variantDisplayLabel(selectedVariant) || selectedVariant.name
        : undefined,
      requestQty: qty,
    })
    if (!stockCheck.ok) {
      toast.error(stockCheck.message)
      return
    }
    const img = displayMedia?.[0]?.url || product.images?.[0]?.url || ''
    addToCart.mutate(
      {
        product_id: product.id,
        variant_id: selectedVariant?.id,
        variant_label: selectedVariant ? variantDisplayLabel(selectedVariant) || selectedVariant.name : undefined,
        slug: product.slug,
        name: product.name,
        qty,
        price: displayPrice,
        image_url: img,
      },
      { onSuccess: () => navigate(storePath('/checkout')) },
    )
  }

  const handleSubscribe = (config: {
    interval: string; cycles: number; total: number
    startDate: string; endDate: string
    selectedDates?: string[]; weeklyDay?: number
    recurrence?: { every: number; unit: string; weekdays?: number[] }
  }) => {
    if (!isAuthenticated) {
      navigate(storePath('/login'), { state: { from: storePath(`/products/${product.slug}`) } })
      return
    }
    const cartName = selectedVariant ? `${product.name} - ${selectedVariant.name}` : product.name
    createSubscription.mutate(
      {
        item_type: 'product',
        product_id: product.id,
        variant_id: selectedVariant?.id,
        item_name: cartName,
        interval: config.interval || selectedVariant?.subscription_interval || product.subscription_interval || 'monthly',
        price_per_cycle: displayPrice,
        qty,
        schedule_config: config,
      },
      { onSuccess: () => navigate(storePath('/account/subscriptions')) },
    )
  }

  const discount = displayCompare && displayCompare > displayPrice
    ? Math.round((1 - displayPrice / displayCompare) * 100)
    : 0

  const specs = product.specifications && Object.keys(product.specifications).length > 0 ? product.specifications : null

  const warrantyDays = selectedVariant?.warranty_period_days ?? product.warranty_period_days
  const warrantyType = selectedVariant?.warranty_type ?? product.warranty_type
  const returnDays = selectedVariant?.return_days ?? product.return_days
  const returnPolicy = selectedVariant?.return_policy ?? product.return_policy
  const returnConditions = selectedVariant?.return_conditions ?? product.return_conditions
  const refundPolicy = selectedVariant?.refund_policy ?? product.refund_policy
  const isReturnable = selectedVariant?.is_returnable ?? product.is_returnable

  const templateProps = {
    displayFields: sf,
    product, selectedVariant, activeVariants, hasVariants,
    selectedVariantId, setSelectedVariantId: handleSelectVariant,
    qty, setQty: handleSetQty, maxAddQty,
    displayPrice, displayCompare, displayCurrency, displayStock,
    displayOfferLabel, displayOnSale, discount, variantColors, onSelectColor: handleSelectColor,
    optionRows, selections, onSelectSize: handleSelectSize, selectedColorName,
    variantValidation, hasStructuredOptions,
    selectedImage, setSelectedImage,
    displayMedia,
    handleAddToCart, handleBuyNow, handleSubscribe,
    subscribePending: createSubscription.isPending,
    isAuthenticated,
    addToCartPending: addToCart.isPending,
    storePath, warrantyDays, warrantyType, returnDays,
    returnPolicy, returnConditions, refundPolicy, isReturnable, specs,
    crossSellProducts: sf.cross_sell !== false ? (product.cross_sell_products || []) : [],
    upsellProducts: sf.upsell !== false ? (product.upsell_products || []) : [],
    isSubscription: !!product.is_subscription,
    subscriptionInterval: selectedVariant?.subscription_interval || product.subscription_interval,
    subscriptionPrice: displayPrice,
    subscriptionPriceType: selectedVariant?.price_type || 'per_unit',
    subscriptionUom: selectedVariant?.uom || product.uom || 'piece',
    subscriptionTrialDays: selectedVariant?.subscription_trial_days ?? product.subscription_trial_days,
    subscriptionSetupFee: selectedVariant?.subscription_setup_fee ?? product.subscription_setup_fee,
    subscriptionBillingCycles: selectedVariant?.subscription_billing_cycles ?? product.subscription_billing_cycles,
    subscriptionScheduleModes: selectedVariant?.subscription_schedule_modes,
    canQuote: !!product.allow_quote_request && sf.quote_request !== false,
    quoteFormConfig: product.quote_form_config,
    showQuote, setShowQuote,
    requestQuote,
    customerInfo: customer ? { name: customer.full_name, email: customer.email, phone: customer.phone } : undefined,
  }

  let template
  switch (product_detail_template) {
    case 'modern':
      template = <ModernDetail {...templateProps} />; break
    case 'minimal':
      template = <MinimalDetail {...templateProps} />; break
    default:
      template = <ClassicDetail {...templateProps} />
  }

  return (
    <>
      {template}
      {showQuote && (
        <ProductQuoteModal
          productId={product.id}
          productName={selectedVariant ? `${product.name} — ${selectedVariant.name}` : product.name}
          formConfig={product.quote_form_config}
          customerInfo={customer ? { name: customer.full_name, email: customer.email, phone: customer.phone } : undefined}
          requestQuote={requestQuote}
          onClose={() => setShowQuote(false)}
        />
      )}
    </>
  )
}
