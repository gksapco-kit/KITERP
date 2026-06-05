import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProduct, useAddToCart, useRequestQuote, useCreateSubscription } from '@/hooks/useStore'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Loader2, ShoppingBag } from 'lucide-react'
import type { ProductVariant } from '@/types'
import { ClassicDetail, ModernDetail, MinimalDetail, ProductQuoteModal } from './templates'
import { trackView } from '@/lib/recentlyViewed'

export default function ProductDetail() {
  const { storePath } = useVendor()
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
    setSelectedImage(0)  // reset gallery to first item when variant changes
  }

  const activeVariants = useMemo(
    () => (product?.variants || []).filter(v => v.is_active !== false),
    [product?.variants],
  )

  const hasVariants = activeVariants.length > 0

  const selectedVariant: ProductVariant | null = useMemo(() => {
    if (!hasVariants) return null
    if (selectedVariantId) return activeVariants.find(v => v.id === selectedVariantId) || activeVariants[0]
    return activeVariants[0]
  }, [hasVariants, selectedVariantId, activeVariants])

  const displayPrice = selectedVariant?.price ?? product?.price ?? 0
  const displayCompare = selectedVariant?.compare_at_price ?? product?.compare_at_price
  const displayCurrency = selectedVariant?.currency ?? product?.currency ?? 'INR'
  const displayStock = selectedVariant?.stock_status ?? product?.stock_status
  const displayOfferLabel = selectedVariant?.offer_label ?? product?.offer_label
  const displayOnSale = selectedVariant?.is_on_sale ?? product?.is_on_sale

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
    const colors = activeVariants.filter(v => v.color).map(v => ({ id: v.id, color: v.color!, name: v.name }))
    return colors.length > 0 ? colors : null
  }, [activeVariants])

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

  const handleAddToCart = () => {
    const img = product.images?.[0]?.url || ''
    const cartName = selectedVariant ? `${product.name} - ${selectedVariant.name}` : product.name
    addToCart.mutate({ product_id: product.id, name: cartName, qty, price: displayPrice, image_url: img })
  }

  const handleBuyNow = () => {
    const img = product.images?.[0]?.url || ''
    const cartName = selectedVariant ? `${product.name} - ${selectedVariant.name}` : product.name
    addToCart.mutate(
      { product_id: product.id, name: cartName, qty, price: displayPrice, image_url: img },
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
    product, selectedVariant, activeVariants, hasVariants,
    selectedVariantId, setSelectedVariantId: handleSelectVariant,
    qty, setQty,
    displayPrice, displayCompare, displayCurrency, displayStock,
    displayOfferLabel, displayOnSale, discount, variantColors,
    selectedImage, setSelectedImage,
    displayMedia,
    handleAddToCart, handleBuyNow, handleSubscribe,
    subscribePending: createSubscription.isPending,
    isAuthenticated,
    addToCartPending: addToCart.isPending,
    storePath, warrantyDays, warrantyType, returnDays,
    returnPolicy, returnConditions, refundPolicy, isReturnable, specs,
    crossSellProducts: product.cross_sell_products || [],
    upsellProducts: product.upsell_products || [],
    isSubscription: !!product.is_subscription,
    subscriptionInterval: selectedVariant?.subscription_interval || product.subscription_interval,
    subscriptionPrice: displayPrice,
    subscriptionPriceType: selectedVariant?.price_type || 'per_unit',
    subscriptionUom: selectedVariant?.uom || product.uom || 'piece',
    subscriptionTrialDays: selectedVariant?.subscription_trial_days ?? product.subscription_trial_days,
    subscriptionSetupFee: selectedVariant?.subscription_setup_fee ?? product.subscription_setup_fee,
    subscriptionBillingCycles: selectedVariant?.subscription_billing_cycles ?? product.subscription_billing_cycles,
    subscriptionScheduleModes: selectedVariant?.subscription_schedule_modes,
    canQuote: !!product.allow_quote_request,
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
