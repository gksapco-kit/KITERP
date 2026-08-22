import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProduct, useAddToCart, useRequestQuote } from '@/hooks/useStore'
import { useAuthStore } from '@/stores/authStore'
import { useIsCustomerLoggedIn } from '@/hooks/useAuthHydrated'
import { useVendor } from '@/contexts/VendorContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Loader2, ShoppingBag } from 'lucide-react'
import type { ProductVariant } from '@/types'
import {
  buildProductCardOptionRows,
  getProductPageColorOptions,
  getVariantOptionDimensions,
  isColorDimension,
  resolveCardDefaultSelections,
  resolveVariantForCardPricing,
  validateVariantCombination,
  type ProductCardOptionRow,
  type ProductColorOption,
  variantDisplayLabel,
} from '@/lib/variantOptions'
import { ClassicDetail, ModernDetail, MinimalDetail, ProductQuoteModal } from './templates'
import { trackView } from '@/lib/recentlyViewed'
import { claimSessionTrack, getVisitorId } from '@/lib/visitorId'
import { assertCanAddToCart, getMaxAddQuantity, getMinAddQuantity, getOnHandQuantity, getEffectiveStockStatus } from '@/lib/stockValidation'
import { resolveProductThumbnailUrl, resolveVariantThumbnailUrl } from '@/lib/productImageUtils'
import { usePrefetchImages } from '@/hooks/usePrefetchImages'
import { proceedSubscribeToCheckout } from '@/lib/subscribeCheckout'
import { useQueryClient } from '@tanstack/react-query'
import { setPendingBuyNow } from '@/lib/pendingBuyNow'
import { isSignInMandatory } from '@/lib/deliveryConditions'
import { hasStorefrontDisplayPrice } from '@/lib/servicePricing'
import { storeApi } from '@/api/store'
import { toast } from 'sonner'
import { useDocumentSeo, vendorPageTitle } from '@/lib/documentSeo'
import { breadcrumbJsonLd, compactJsonLd, productJsonLd, seoKeywords } from '@/lib/catalogSeo'

export default function ProductDetail() {
  const { storePath, vendorSlug, displayFields, vendor } = useVendor()
  const sf = displayFields.product
  const { product_detail_template } = useTheme()
  const { slug } = useParams<{ slug: string }>()
  const { data: product, isLoading } = useProduct(slug!)
  const addToCart = useAddToCart()
  const navigate = useNavigate()
  const { isAuthenticated, customer } = useAuthStore()
  const { isLoggedIn } = useIsCustomerLoggedIn()
  const qc = useQueryClient()
  const [subscribePending, setSubscribePending] = useState(false)
  const requestQuote = useRequestQuote()
  const signInMandatory = isSignInMandatory(
    (vendor?.settings ?? {}) as Record<string, unknown>,
  )
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
    const rows = buildProductCardOptionRows(activeVariants, product.images)
    if (rows.length === 0) {
      // Manual / flat variants — pick by id, not Size×Color matrix
      setSelections({})
      setSelectedColorName(undefined)
      setSelectedVariantId(first.id)
      return
    }
    const defaults = resolveCardDefaultSelections(activeVariants, rows, first)
    setSelections(defaults.selections)
    setSelectedColorName(defaults.colorName)
    const validated = validateVariantCombination(activeVariants, defaults.selections, defaults.colorName)
    setSelectedVariantId(validated.variant?.id ?? first.id)
  }, [product?.id, activeVariants.length])

  const variantValidation = useMemo(() => {
    if (!activeVariants.length) return { valid: true as const }
    // Flat option cards (non–Fast entry): selection is by variant id only
    if (!hasStructuredOptions) {
      const byId = selectedVariantId
        ? activeVariants.find((v) => v.id === selectedVariantId)
        : undefined
      const pick = byId ?? activeVariants.find((v) => v.is_active !== false) ?? activeVariants[0]
      return { valid: true as const, variant: pick }
    }
    return validateVariantCombination(activeVariants, selections, selectedColorName)
  }, [activeVariants, hasStructuredOptions, selectedVariantId, selections, selectedColorName])

  const handleSelectColor = (option: ProductColorOption) => {
    setSelectedColorName(option.name)
    setSelectedVariantId(option.variantId)
    const colorDim = getVariantOptionDimensions(activeVariants).find(isColorDimension)
    if (colorDim) {
      setSelections((prev) => ({ ...prev, [colorDim]: option.name }))
    }
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

  const matchedVariant: ProductVariant | null = useMemo(() => {
    if (!hasVariants) return null
    if (variantValidation.valid && variantValidation.variant) {
      return activeVariants.find((v) => v.id === variantValidation.variant!.id) ?? null
    }
    if (!hasStructuredOptions && selectedVariantId) {
      return activeVariants.find((v) => v.id === selectedVariantId) ?? null
    }
    return null
  }, [hasVariants, hasStructuredOptions, variantValidation, selectedVariantId, activeVariants])

  const selectedVariant: ProductVariant | null = useMemo(() => {
    if (!hasVariants) return null
    if (matchedVariant) return matchedVariant
    if (selectedVariantId) return activeVariants.find((v) => v.id === selectedVariantId) ?? null
    return activeVariants[0] ?? null
  }, [hasVariants, matchedVariant, selectedVariantId, activeVariants])

  const pricingVariant = useMemo(() => {
    if (!hasVariants || !product) return matchedVariant
    return (
      matchedVariant ??
      resolveVariantForCardPricing(activeVariants, optionRows, selections, selectedColorName) ??
      null
    )
  }, [hasVariants, product, matchedVariant, activeVariants, optionRows, selections, selectedColorName])

  const displayPriceType = pricingVariant?.price_type ?? product?.price_type
  const rawDisplayPrice = pricingVariant?.price ?? product?.price
  const hasDisplayPrice = hasStorefrontDisplayPrice(rawDisplayPrice, displayPriceType)
  const displayPrice = hasDisplayPrice ? Number(rawDisplayPrice) : 0
  const displayCompare = hasDisplayPrice
    ? (pricingVariant?.compare_at_price ?? product?.compare_at_price)
    : undefined
  const displayCurrency = pricingVariant?.currency ?? product?.currency ?? 'INR'
  // Stock follows the matched variant. An unmatched combo is not the same as out of stock.
  const displayStock = product
    ? getEffectiveStockStatus(product, matchedVariant ?? undefined)
    : undefined
  const displayOfferLabel = pricingVariant?.offer_label ?? product?.offer_label
  const displayOnSale = pricingVariant?.is_on_sale ?? product?.is_on_sale

  const stockVariant = matchedVariant

  const onHandQty = useMemo(() => {
    if (!product) return null
    if (hasVariants && !stockVariant) return null
    return getOnHandQuantity(product, stockVariant ?? undefined)
  }, [product, hasVariants, stockVariant])

  const maxAddQty = useMemo(() => {
    if (!product) return null
    if (hasVariants && !stockVariant) return null
    return getMaxAddQuantity({
      vendorSlug,
      isAuthenticated,
      productId: product.id,
      product,
      variant: stockVariant ?? undefined,
    })
  }, [product, hasVariants, stockVariant, vendorSlug, isAuthenticated])

  const minAddQty = useMemo(() => {
    if (!product) return 1
    return getMinAddQuantity({ product, variant: stockVariant ?? undefined })
  }, [product, stockVariant])

  useEffect(() => {
    if (maxAddQty === null) return
    if (maxAddQty < minAddQty) {
      setQty(minAddQty)
      return
    }
    setQty((current) => (current > maxAddQty ? maxAddQty : current))
  }, [maxAddQty, minAddQty, stockVariant?.id])

  useEffect(() => {
    setQty((current) => (current < minAddQty ? minAddQty : current))
  }, [minAddQty, stockVariant?.id])

  useEffect(() => {
    if (!product) return
    trackView({
      id: product.id,
      title: product.name,
      url: `/products/${product.slug}`,
      image_url: resolveProductThumbnailUrl({ images: product.images, variants: activeVariants }),
      price: displayPrice,
      currency: displayCurrency,
    }, vendorSlug)
  }, [product?.id, displayPrice, displayCurrency, product?.images, product?.name, product?.slug, vendorSlug, activeVariants])

  // Unique product view (once per browser session; 24h server-side dedupe)
  useEffect(() => {
    if (!product?.slug) return
    if (!claimSessionTrack('product', product.slug)) return
    storeApi.recordProductView(product.slug, getVisitorId()).catch(() => {})
  }, [product?.slug])

  const productPath = storePath(`/products/${product?.slug || slug || ''}`)
  const productImage = product
    ? (product.og_image_url || resolveProductThumbnailUrl({ images: product.images, variants: activeVariants }))
    : null
  const productDescription = product?.meta_description || product?.short_description || product?.description
  const vendorName = vendor?.display_name || vendor?.business_name || vendorSlug
  useDocumentSeo({
    title: product
      ? (product.meta_title?.trim() || `${product.name} | ${vendorName}`)
      : vendorPageTitle('Product', vendorName),
    description: product
      ? (productDescription || `Buy ${product.name} from ${vendorName} on KIT ERP.`)
      : undefined,
    keywords: seoKeywords(product?.meta_keywords) || product?.tags?.join(', '),
    canonicalUrl: product?.canonical_url,
    canonicalPath: product?.canonical_url ? undefined : productPath,
    ogType: 'product',
    ogImage: productImage || vendor?.logo_url || '/favicon-192.png',
    ogImageAlt: product?.name || vendorName,
    ogSiteName: vendorName,
    jsonLd: product
      ? compactJsonLd([
          productJsonLd({
            name: product.name,
            description: productDescription,
            image: productImage,
            sku: product.sku,
            brand: product.brand || vendorName,
            price: hasDisplayPrice ? displayPrice : product.price,
            currency: displayCurrency,
            availability: displayStock,
            url: productPath,
            rating: product.avg_rating,
            reviewCount: product.review_count,
          }),
          breadcrumbJsonLd([
            { name: vendorName, path: storePath('/') },
            { name: 'Products', path: storePath('/products') },
            { name: product.name, path: productPath },
          ]),
        ])
      : null,
  })

  const variantColors = useMemo(() => {
    const options = getProductPageColorOptions(activeVariants, product?.images)
    return options.length > 0 ? options : null
  }, [activeVariants, product?.images])

  const displayMedia = useMemo(() => {
    const vm = selectedVariant?.media
    if (vm && vm.length > 0) {
      return vm.map(m => ({ id: m.url, url: m.url, alt_text: m.alt_text, is_primary: m.is_primary, media_type: m.media_type }))
    }
    if (product?.images?.length) return product.images
    for (const variant of activeVariants) {
      if (variant.media?.length) {
        return variant.media.map(m => ({ id: m.url, url: m.url, alt_text: m.alt_text, is_primary: m.is_primary, media_type: m.media_type }))
      }
    }
    return []
  }, [selectedVariant, product?.images, activeVariants])

  usePrefetchImages([
    ...(product?.images || []).map((img) => img.url),
    ...activeVariants.flatMap((v) => [
      resolveVariantThumbnailUrl(v),
      ...((v.media || []).map((m) => m.url)),
    ]),
  ])

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-3 py-6 sm:px-4 sm:py-8">
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

  const runStockCheck = (requestQty: number) => {
    if (!product) return { ok: false as const, message: 'Product unavailable.' }
    const variant = stockVariant ?? undefined
    return assertCanAddToCart({
      vendorSlug,
      isAuthenticated,
      productId: product.id,
      productName: product.name,
      product,
      variant,
      variantLabel: variant ? variantDisplayLabel(variant) || variant.name : undefined,
      requestQty,
    })
  }

  const handleSetQty = (next: number) => {
    setQty(Math.max(minAddQty, next))
  }

  const validateQtyChange = (next: number) => {
    return runStockCheck(Math.max(minAddQty, next))
  }

  const handleAddToCart = () => {
    if (!variantValidation.valid || !product) return
    const stockCheck = runStockCheck(qty)
    if (!stockCheck.ok) {
      toast.error(stockCheck.message)
      return
    }
    const img = resolveProductThumbnailUrl({ images: displayMedia, variants: [] })
      || resolveProductThumbnailUrl({ images: product.images, variants: activeVariants })
      || ''
    addToCart.mutate(
      {
        product_id: product.id,
        variant_id: stockVariant?.id,
        variant_label: stockVariant ? variantDisplayLabel(stockVariant) || stockVariant.name : undefined,
        slug: product.slug,
        name: product.name,
        qty,
        price: displayPrice,
        image_url: img,
      },
      { onSuccess: () => toast.success('Added to cart') },
    )
  }

  const handleBuyNow = () => {
    if (!variantValidation.valid || !product) return
    const stockCheck = runStockCheck(qty)
    if (!stockCheck.ok) {
      toast.error(stockCheck.message)
      return
    }
    const img = resolveProductThumbnailUrl({ images: displayMedia, variants: [] })
      || resolveProductThumbnailUrl({ images: product.images, variants: activeVariants })
      || ''
    const cartItem = {
      product_id: product.id,
      variant_id: stockVariant?.id,
      variant_label: stockVariant ? variantDisplayLabel(stockVariant) || stockVariant.name : undefined,
      slug: product.slug,
      name: product.name,
      qty,
      price: displayPrice,
      image_url: img,
    }

    if (!isLoggedIn && signInMandatory) {
      setPendingBuyNow({ vendorSlug, productId: product.id, item: cartItem })
      toast.info('Please sign in to continue to checkout')
      navigate(storePath('/login'), { state: { from: storePath('/checkout') } })
      return
    }

    addToCart.mutate(cartItem, { onSuccess: () => navigate(storePath('/checkout')) })
  }

  const handleSubscribe = async (config: {
    interval: string; cycles: number; total: number
    startDate: string; endDate: string
    selectedDates?: string[]; weeklyDay?: number
    recurrence?: { every: number; unit: string; weekdays?: number[] }
  }) => {
    if (subscribePending || !product) return
    const cartName = selectedVariant ? `${product.name} - ${selectedVariant.name}` : product.name
    const img = resolveProductThumbnailUrl({ images: displayMedia, variants: [] })
      || resolveProductThumbnailUrl({ images: product.images, variants: activeVariants })
      || ''
    const interval = config.interval || selectedVariant?.subscription_interval || product.subscription_interval || 'monthly'
    const scheduleLabel = `${config.cycles} ${interval} cycle${config.cycles !== 1 ? 's' : ''}`
    const cartItem = {
      product_id: product.id,
      variant_id: stockVariant?.id,
      variant_label: [
        stockVariant ? variantDisplayLabel(stockVariant) || stockVariant.name : null,
        scheduleLabel,
      ].filter(Boolean).join(' · '),
      item_type: 'product' as const,
      slug: product.slug,
      name: `${cartName} (Subscription)`,
      qty,
      price: config.total > 0 ? config.total / Math.max(qty, 1) : displayPrice,
      image_url: img,
    }
    setSubscribePending(true)
    try {
      await proceedSubscribeToCheckout({
        intent: {
          kind: 'subscription',
          vendorSlug,
          cartItem,
          payload: {
            item_type: 'product',
            product_id: product.id,
            variant_id: selectedVariant?.id,
            item_name: cartName,
            interval,
            price_per_cycle: displayPrice,
            qty,
            schedule_config: config,
          },
        },
        cartItem,
        vendorSlug,
        navigate,
        storePath,
        qc,
      })
    } finally {
      setSubscribePending(false)
    }
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
    qty, setQty: handleSetQty, validateQtyChange, maxAddQty, minAddQty, onHandQty,
    displayPrice, hasDisplayPrice, displayCompare, displayCurrency, displayStock,
    displayOfferLabel, displayOnSale, discount, variantColors, onSelectColor: handleSelectColor,
    optionRows, selections, onSelectSize: handleSelectSize, selectedColorName,
    variantValidation, hasStructuredOptions,
    selectedImage, setSelectedImage,
    displayMedia,
    handleAddToCart, handleBuyNow, handleSubscribe,
    subscribePending,
    isAuthenticated,
    signInMandatory,
    addToCartPending: addToCart.isPending,
    storePath, warrantyDays, warrantyType, returnDays,
    returnPolicy, returnConditions, refundPolicy, isReturnable, specs,
    crossSellProducts: sf.cross_sell !== false ? (product.cross_sell_products || []) : [],
    upsellProducts: sf.upsell !== false ? (product.upsell_products || []) : [],
    isSubscription: !!product.is_subscription,
    subscriptionInterval: selectedVariant?.subscription_interval || product.subscription_interval,
    subscriptionPrice: displayPrice,
    subscriptionPriceType: displayPriceType || selectedVariant?.price_type || 'per_unit',
    subscriptionUom: selectedVariant?.uom || product.uom || 'piece',
    subscriptionTrialDays: selectedVariant?.subscription_trial_days ?? product.subscription_trial_days,
    subscriptionSetupFee: selectedVariant?.subscription_setup_fee ?? product.subscription_setup_fee,
    subscriptionBillingCycles: selectedVariant?.subscription_billing_cycles ?? product.subscription_billing_cycles,
    subscriptionScheduleModes: selectedVariant?.subscription_schedule_modes,
    isTaxable: selectedVariant?.is_taxable ?? product.is_taxable,
    taxRate: selectedVariant?.gst_rate ?? selectedVariant?.tax_rate ?? product.gst_rate ?? product.tax_rate,
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
