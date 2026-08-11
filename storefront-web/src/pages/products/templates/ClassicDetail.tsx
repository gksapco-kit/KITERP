import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { formatCurrency, imgUrl } from '@/lib/utils'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  ShoppingBag,
  Truck, ShieldCheck, RefreshCw, ChevronRight, Tag, Package, Box,
  Award, Zap, Check, Info, Calendar, Ruler, Repeat, MessageSquare, Send, X, Loader2,
} from 'lucide-react'
import type { QuoteFormField } from '@/types'
import { QuoteFormFieldInput } from '@/components/quote/QuoteFormFieldInput'
import { isQuoteFieldEmpty } from '@/components/quote/quoteFieldHelpers'
import SubscriptionConfigurator from '@/components/SubscriptionConfigurator'
import { subscriptionBillingFootnote } from '@/lib/serviceStorefrontCta'
import { hasStorefrontDisplayPrice } from '@/lib/servicePricing'
import StarRating from '@/components/StarRating'
import ReviewSection from '@/components/ReviewSection'
import MerchProductGrid from './MerchProductGrid'
import MediaViewer from '@/components/MediaViewer'
import ColorSwatchPicker from '@/components/products/ColorSwatchPicker'
import { ProductPurchaseActions } from '@/components/products/ProductPurchaseActions'
import { ProductMediaWishlistOverlay } from '@/components/products/ProductMediaWishlistOverlay'
import { isCombinationAvailable, variantFlatOptionDescription, variantFlatOptionTitle } from '@/lib/variantOptions'
import { getEffectiveStockStatus } from '@/lib/stockValidation'
import type { ProductDetailTemplateProps } from './types'
import { isDisplayFieldEnabled } from '@/lib/storefrontDisplayFields'
import { formatUomDisplay } from '@/lib/uomDisplay'
import { themeUi } from '@/lib/themeColors'

const catalogCard = `rounded-xl border ${themeUi.cardSurface} ${themeUi.cardBorder}`

// ── Product Quote Request Modal ───────────────────────────────────
const FALLBACK_QUOTE_FIELDS: QuoteFormField[] = [
  { key: 'name', label: 'Full Name', type: 'text', required: true, enabled: true, placeholder: 'Your name' },
  { key: 'email', label: 'Email', type: 'email', required: true, enabled: true, placeholder: 'Email address' },
  { key: 'message', label: 'Message', type: 'textarea', required: true, enabled: true, placeholder: 'Describe your requirements...' },
  { key: 'quantity', label: 'Quantity', type: 'number', required: false, enabled: true, placeholder: 'Qty' },
  { key: 'preferred_date', label: 'Preferred Date', type: 'date', required: false, enabled: true },
]

export function ProductQuoteModal({ productId, productName, formConfig, customerInfo, requestQuote, onClose }: {
  productId: string; productName: string; formConfig?: QuoteFormField[]
  customerInfo?: { name?: string; email?: string; phone?: string }
  requestQuote: { mutate: (d: any, o?: any) => void; isPending: boolean }
  onClose: () => void
}) {
  const fields = (formConfig && formConfig.length > 0) ? formConfig.filter(f => f.enabled) : FALLBACK_QUOTE_FIELDS
  const initialData: Record<string, string> = {}
  if (customerInfo?.name) initialData.name = customerInfo.name
  if (customerInfo?.email) initialData.email = customerInfo.email
  if (customerInfo?.phone) initialData.phone = customerInfo.phone

  const [formData, setFormData] = useState<Record<string, string>>(initialData)
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const today = new Date().toISOString().split('T')[0]
  const autoKeys = new Set(Object.keys(initialData).filter(k => initialData[k]))

  const updateField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: false }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, boolean> = {}
    for (const f of fields) {
      if (f.required && isQuoteFieldEmpty(f, formData[f.key] || '')) newErrors[f.key] = true
    }
    if (Object.keys(newErrors).length) { setErrors(newErrors); return }
    requestQuote.mutate(
      { product_id: productId, product_name: productName, item_type: 'product', form_data: formData },
      { onSuccess: () => onClose() },
    )
  }

  const inputCls = (key: string) =>
    `w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors ${
      errors[key] ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-300 focus:ring-2 focus:ring-ring focus:border-primary'
    }`
  const readOnlyCls = 'bg-gray-50 text-gray-500 cursor-not-allowed'

  const renderField = (f: QuoteFormField) => (
    <QuoteFormFieldInput
      field={f}
      value={formData[f.key] || ''}
      onChange={(v) => updateField(f.key, v)}
      inputClassName={inputCls}
      readOnly={autoKeys.has(f.key)}
      readOnlyClassName={readOnlyCls}
      today={today}
    />
  )

  const dateTimeFields = fields.filter((f) => f.type === 'date' || f.type === 'time')
  const otherFields = fields.filter((f) => f.type !== 'date' && f.type !== 'time')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 fade-in-0 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-gray-900">Request a Quote</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-accent border border-primary/20 rounded-xl p-3">
            <p className="text-sm text-primary font-medium">{productName}</p>
            <p className="text-xs text-primary mt-0.5">The vendor will review your request and respond with pricing.</p>
          </div>
          {otherFields.map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {renderField(f)}
              {errors[f.key] && <p className="text-xs text-red-500 mt-1">{f.label} is required</p>}
            </div>
          ))}
          {dateTimeFields.length > 0 && (
            <div className={`grid gap-3 ${dateTimeFields.length >= 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              {dateTimeFields.map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {renderField(f)}
                  {errors[f.key] && <p className="text-xs text-red-500 mt-1">{f.label} is required</p>}
                </div>
              ))}
            </div>
          )}
          <Button type="submit" disabled={requestQuote.isPending}
            className="w-full h-11 font-bold bg-primary hover:bg-primary/90 text-white rounded-xl" size="lg">
            {requestQuote.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Submit Quote Request
          </Button>
        </form>
      </div>
    </div>
  )
}

export default function ClassicDetail(props: ProductDetailTemplateProps) {
  const {
    displayFields,
    product, selectedVariant, activeVariants, hasVariants,
    setSelectedVariantId, qty, setQty, validateQtyChange, maxAddQty, minAddQty, onHandQty,
    displayPrice, hasDisplayPrice, displayCompare, displayCurrency, displayStock,
    displayOfferLabel, displayOnSale, discount, variantColors, onSelectColor,
    optionRows, selections, onSelectSize, selectedColorName, variantValidation, hasStructuredOptions,
    selectedImage, setSelectedImage, displayMedia,
    selectedVariantId,
    handleAddToCart, handleBuyNow, handleSubscribe, subscribePending, isAuthenticated, signInMandatory, addToCartPending,
    storePath, warrantyDays, warrantyType, returnDays, returnPolicy,
    returnConditions, refundPolicy, isReturnable, specs,
    crossSellProducts, upsellProducts,
    isSubscription, subscriptionInterval, subscriptionPrice,
    subscriptionPriceType, subscriptionUom,
    subscriptionTrialDays, subscriptionSetupFee, subscriptionBillingCycles,
    subscriptionScheduleModes,
    isTaxable, taxRate,
    canQuote, quoteFormConfig, showQuote, setShowQuote,
    requestQuote, customerInfo,
  } = props
  const qtyMax = maxAddQty ?? 99

  const sf = displayFields
  const showCompare = isDisplayFieldEnabled(sf, 'compare_at_price') && hasDisplayPrice
  const showVariants = isDisplayFieldEnabled(sf, 'variants') && hasVariants
  const showUom = isDisplayFieldEnabled(sf, 'uom')
  const displayUomLabel = showUom
    ? formatUomDisplay(
        selectedVariant?.uom_quantity ?? product.uom_quantity,
        selectedVariant?.uom || product.uom,
      )
    : null

  const intervalLabel: Record<string, string> = {
    daily: 'Daily', weekly: 'Weekly', biweekly: 'Bi-Weekly', monthly: 'Monthly',
    quarterly: 'Quarterly', biannual: 'Half-Yearly', yearly: 'Yearly',
  }
  const intervalShort: Record<string, string> = {
    daily: '/day', weekly: '/wk', biweekly: '/2wk', monthly: '/mo',
    quarterly: '/qtr', biannual: '/6mo', yearly: '/yr',
  }
  const billingFootnote = hasDisplayPrice
    ? subscriptionBillingFootnote({
        interval: isSubscription ? (intervalLabel[subscriptionInterval!] || subscriptionInterval) : null,
        priceType: isSubscription ? subscriptionPriceType : null,
        uom: isSubscription ? subscriptionUom : null,
        isTaxable,
        taxRate,
      })
    : null

  return (
    <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6 flex items-center flex-wrap gap-1">
        <Link to={storePath('/')} className="hover:text-blue-600">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={storePath('/products')} className="hover:text-blue-600">Products</Link>
        {isDisplayFieldEnabled(sf, 'category') && product.category && (
          <>
            <ChevronRight className="w-3 h-3" />
            <Link to={storePath(`/products?category=${encodeURIComponent(product.category)}`)} className="hover:text-blue-600">
              {product.category}
            </Link>
          </>
        )}
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900 font-medium">{product.name}</span>
      </nav>

      <div className={`${catalogCard} p-4 sm:p-6 lg:p-8`}>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] gap-8 lg:gap-10 items-start">
          {/* Media Gallery — variant media takes priority over product media */}
          <MediaViewer
            items={displayMedia}
            selectedIndex={selectedImage}
            onSelect={setSelectedImage}
            productName={product.name}
            thumbnailPosition="left"
            topRightOverlay={
              <ProductMediaWishlistOverlay
                product={product}
                selectedVariant={selectedVariant}
                displayPrice={displayPrice}
                displayMedia={displayMedia}
                selectedImage={selectedImage}
              />
            }
            badges={
              <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                {showCompare && discount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-md shadow">-{discount}%</span>
                )}
                {isDisplayFieldEnabled(sf, 'new_arrival_badge') && product.is_new_arrival && (
                  <span className="bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-md shadow flex items-center gap-1">
                    <Zap className="w-3 h-3" /> New
                  </span>
                )}
                {isDisplayFieldEnabled(sf, 'best_seller_badge') && product.is_best_seller && (
                  <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-md shadow flex items-center gap-1">
                    <Award className="w-3 h-3" /> Bestseller
                  </span>
                )}
              </div>
            }
          />

          {/* Product Info */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {isDisplayFieldEnabled(sf, 'category') && product.category && (
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full uppercase tracking-wide">{product.category}</span>
              )}
              {isDisplayFieldEnabled(sf, 'subcategory') && product.subcategory && (
                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">{product.subcategory}</span>
              )}
              {isDisplayFieldEnabled(sf, 'brand') && product.brand && (
                <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-full">{product.brand}</span>
              )}
              {isDisplayFieldEnabled(sf, 'offer_label') && displayOfferLabel && displayOnSale && (
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full">{displayOfferLabel}</span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mt-2 leading-tight">{product.name}</h1>

            {isDisplayFieldEnabled(sf, 'reviews') && (product.avg_rating ?? 0) > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <StarRating rating={product.avg_rating!} showValue reviewCount={product.review_count} />
              </div>
            )}

            <div className="border-t mt-4 pt-4" />

            {/* Price */}
            {(hasDisplayPrice || billingFootnote) && (
            <>
            <div className="flex items-baseline gap-3 flex-wrap">
              {showCompare && discount > 0 && (
                <span className="bg-red-500 text-white text-sm font-bold px-2 py-0.5 rounded">-{discount}%</span>
              )}
              {hasDisplayPrice && (
              <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                {formatCurrency(displayPrice, displayCurrency)}
                {isSubscription && subscriptionInterval && (
                  <span className="text-base font-normal text-gray-400 ml-1">
                    {subscriptionPriceType === 'per_unit'
                      ? `/${subscriptionUom || 'unit'}`
                      : (intervalShort[subscriptionInterval] || `/${subscriptionInterval}`)}
                  </span>
                )}
                {!isSubscription && displayUomLabel && (
                  <span className="text-base font-normal text-gray-400 ml-1">/{displayUomLabel}</span>
                )}
              </span>
              )}
              {showCompare && (displayCompare ?? 0) > displayPrice && (
                <span className="text-base text-gray-400 line-through">M.R.P.: {formatCurrency(displayCompare!, displayCurrency)}</span>
              )}
            </div>
            {billingFootnote && (
            <p className="text-sm text-gray-500 mt-1">
              {billingFootnote}
            </p>
            )}
            </>
            )}

            {/* Subscription Configurator */}
            {isSubscription && subscriptionInterval && (
              <div className="mt-4">
                <SubscriptionConfigurator
                  key={`${selectedVariantId || 'default'}-${subscriptionInterval}`}
                  interval={subscriptionInterval}
                  pricePerCycle={subscriptionPrice ?? displayPrice}
                  currency={displayCurrency}
                  priceType={subscriptionPriceType}
                  uom={subscriptionUom}
                  trialDays={subscriptionTrialDays}
                  setupFee={subscriptionSetupFee}
                  maxCycles={subscriptionBillingCycles}
                  allowedModes={subscriptionScheduleModes}
                  isTaxable={isTaxable}
                  taxRate={taxRate}
                  onSubscribe={(config) => (handleSubscribe ? handleSubscribe(config) : handleBuyNow())}
                  subscribePending={subscribePending ?? addToCartPending}
                  disabled={displayStock === 'out_of_stock'}
                />
              </div>
            )}

            {/* Stock — product-level status is only meaningful when variants exist */}
            {hasVariants && isDisplayFieldEnabled(sf, 'stock_status') && displayStock && (
              <div className="mt-3 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-sm font-medium px-2.5 py-0.5 rounded-full ${
                  displayStock === 'in_stock' ? 'text-green-700 bg-green-50' :
                  displayStock === 'low_stock' ? 'text-amber-700 bg-amber-50' :
                  displayStock === 'backorder' ? 'text-blue-700 bg-blue-50' : 'text-red-700 bg-red-50'
                }`}>
                  {displayStock === 'in_stock' && <Check className="w-3.5 h-3.5" />}
                  {displayStock === 'in_stock' ? 'In Stock' :
                   displayStock === 'low_stock' ? 'Low Stock — Order Soon' :
                   displayStock === 'backorder' ? 'Available on Backorder' :
                   displayStock === 'out_of_stock' ? 'Out of Stock' :
                   displayStock === 'discontinued' ? 'Discontinued' : displayStock}
                </span>
              </div>
            )}

            {/* Variant / Plan Selector */}
            {showVariants && (
              <div className="mt-5 space-y-3">
                {optionRows.filter((r) => r.type === 'size').map((sizeRow) => (
                  sizeRow.type === 'size' ? (
                    <div key={`size-${sizeRow.label}`}>
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        {sizeRow.label}
                        {selections[sizeRow.label] ? (
                          <span className="ml-1.5 font-normal text-gray-500">— {selections[sizeRow.label]}</span>
                        ) : null}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {sizeRow.values.map((value) => {
                          const isSelected = selections[sizeRow.label] === value
                          const unavailable =
                            !!selectedColorName &&
                            !isCombinationAvailable(activeVariants, { ...selections, [sizeRow.label]: value }, selectedColorName)
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => onSelectSize(sizeRow.label, value)}
                              className={`min-w-[2.75rem] px-3 py-2 rounded-lg border-2 text-sm font-semibold uppercase transition-all ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                                  : unavailable
                                    ? 'border-gray-200 bg-gray-50 text-gray-400 opacity-60'
                                    : 'border-gray-200 hover:border-gray-400 bg-white text-gray-800'
                              }`}
                            >
                              {value}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null
                ))}

                {variantColors && !isSubscription && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Color
                      {selectedColorName ? (
                        <span className="ml-1.5 font-normal text-gray-500">— {selectedColorName}</span>
                      ) : null}
                    </p>
                    <ColorSwatchPicker
                      options={variantColors}
                      selectedVariantId={selectedVariant?.id}
                      selectedImageIndex={selectedImage}
                      selectedColorName={selectedColorName}
                      onSelect={onSelectColor}
                    />
                  </div>
                )}

                {hasStructuredOptions && !variantValidation.valid && variantValidation.message ? (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {variantValidation.message}
                  </p>
                ) : null}

                {isSubscription ? (
                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
                      <Repeat className="w-4 h-4 text-primary" /> Choose a Plan
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeVariants.map(v => {
                        const isSelected = selectedVariant?.id === v.id
                        const vInterval = v.subscription_interval || 'monthly'
                        const vPriceType = v.price_type || 'per_cycle'
                        const vShort = vPriceType === 'per_unit' ? `/${v.uom || 'unit'}` : (intervalShort[vInterval] || '/mo')
                        const hasTrial = v.subscription_trial_days && v.subscription_trial_days > 0
                        const hasSetup = v.subscription_setup_fee && v.subscription_setup_fee > 0
                        const vDiscount = v.compare_at_price && v.compare_at_price > v.price
                          ? Math.round((1 - v.price / v.compare_at_price) * 100) : 0
                        return (
                          <button key={v.id} onClick={() => setSelectedVariantId(v.id)}
                            className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                              isSelected
                                ? 'border-primary bg-accent ring-1 ring-primary/25 shadow-sm'
                                : 'border-gray-200 hover:border-primary/40 bg-white'
                            }`}>
                            {showCompare && vDiscount > 0 && (
                              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full shadow">-{vDiscount}%</span>
                            )}
                            <div className="flex items-start justify-between">
                              <div>
                                <p className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-gray-900'}`}>{v.name}</p>
                                <p className={`text-xs font-medium mt-0.5 ${isSelected ? 'text-primary' : 'text-gray-500'}`}>
                                  {intervalLabel[vInterval] || vInterval}
                                  {vPriceType === 'per_unit' && ` · per ${v.uom || 'unit'}`}
                                </p>
                              </div>
                              <div className="text-right">
                                {hasStorefrontDisplayPrice(v.price, v.price_type) ? (
                                  <>
                                    <p className={`text-lg font-extrabold ${isSelected ? 'text-primary' : 'text-gray-900'}`}>
                                      {formatCurrency(v.price, v.currency)}
                                    </p>
                                    <p className="text-xs text-gray-400">{vShort}</p>
                                  </>
                                ) : null}
                              </div>
                            </div>
                            {(hasTrial || hasSetup) && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {hasTrial && (
                                  <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                                    {v.subscription_trial_days}d free trial
                                  </span>
                                )}
                                {hasSetup && (
                                  <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                    {formatCurrency(v.subscription_setup_fee!, v.currency)} setup
                                  </span>
                                )}
                              </div>
                            )}
                            {showCompare && hasStorefrontDisplayPrice(v.price, v.price_type) && (v.compare_at_price ?? 0) > v.price && (
                              <p className="text-xs text-gray-400 line-through mt-1">{formatCurrency(v.compare_at_price!, v.currency)}</p>
                            )}
                            {isSelected && (
                              <div className="absolute top-2 right-2">
                                <Check className="w-4 h-4 text-primary" />
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : !hasStructuredOptions ? (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Options:{' '}
                      <span className="font-normal text-gray-500">
                        {selectedVariant
                          ? variantFlatOptionTitle(selectedVariant, product)
                          : null}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {activeVariants.map(v => {
                        const isSelected = selectedVariant?.id === v.id
                        const showVPrice = hasStorefrontDisplayPrice(v.price, v.price_type)
                        const vDiscount = showVPrice && v.compare_at_price && v.compare_at_price > v.price
                          ? Math.round((1 - v.price / v.compare_at_price) * 100) : 0
                        const title = variantFlatOptionTitle(v, product)
                        const description = variantFlatOptionDescription(v, product)
                        const vUomLabel = showUom ? formatUomDisplay(v.uom_quantity, v.uom || product.uom) : null
                        // Avoid repeating UOM when it already is the card title
                        const priceUomSuffix = vUomLabel && vUomLabel !== title ? vUomLabel : null
                        return (
                          <button key={v.id} onClick={() => setSelectedVariantId(v.id)}
                            className={`relative px-4 py-2.5 rounded-lg border-2 text-left transition-all min-w-[100px] ${
                              isSelected ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-400 bg-white'
                            }`}>
                            {showCompare && vDiscount > 0 && (
                              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">-{vDiscount}%</span>
                            )}
                            <p className={`text-sm font-semibold ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>{title}</p>
                            {description && (
                              <p className={`text-xs mt-0.5 ${isSelected ? 'text-blue-500' : 'text-gray-500'}`}>{description}</p>
                            )}
                            {showVPrice && (
                              <p className={`text-sm font-bold mt-0.5 ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
                                {formatCurrency(v.price, v.currency)}
                                {priceUomSuffix && (
                                  <span className={`text-xs font-normal ml-0.5 ${isSelected ? 'text-blue-500' : 'text-gray-500'}`}>/{priceUomSuffix}</span>
                                )}
                              </p>
                            )}
                            {!showVPrice && !description && vUomLabel && vUomLabel !== title && (
                              <p className={`text-xs mt-0.5 ${isSelected ? 'text-blue-500' : 'text-gray-500'}`}>{vUomLabel}</p>
                            )}
                            {showCompare && showVPrice && (v.compare_at_price ?? 0) > v.price && (
                              <p className="text-xs text-gray-400 line-through">{formatCurrency(v.compare_at_price!, v.currency)}</p>
                            )}
                            {(() => {
                              const status = getEffectiveStockStatus(product, v)
                              return status !== 'in_stock' ? (
                                <p className="text-xs text-amber-600 font-medium mt-0.5">
                                  {status === 'out_of_stock' ? 'Out of stock' : status.replace(/_/g, ' ')}
                                </p>
                              ) : null
                            })()}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* SKU / Barcode */}
            {((isDisplayFieldEnabled(sf, 'sku') && (selectedVariant?.sku || product.sku))
              || (isDisplayFieldEnabled(sf, 'barcode') && (selectedVariant?.barcode || product.barcode))) && (
              <div className="mt-3 flex gap-4 text-xs text-gray-400">
                {isDisplayFieldEnabled(sf, 'sku') && (selectedVariant?.sku || product.sku) && (
                  <span>SKU: {selectedVariant?.sku || product.sku}</span>
                )}
                {isDisplayFieldEnabled(sf, 'barcode') && (selectedVariant?.barcode || product.barcode) && (
                  <span>Barcode: {selectedVariant?.barcode || product.barcode}</span>
                )}
              </div>
            )}

            {/* Quantity + Add to Cart — hide purchase controls when product has no variants */}
            {(hasVariants || canQuote) && (
              <>
                <div className="border-t mt-6 pt-6" />
                <ProductPurchaseActions
                  qty={qty}
                  setQty={setQty}
                  validateQtyChange={validateQtyChange}
                  maxQty={maxAddQty}
                  minQty={minAddQty}
                  onHandQty={onHandQty}
                  displayPrice={displayPrice}
                  hasDisplayPrice={hasDisplayPrice}
                  displayCurrency={displayCurrency}
                  displayStock={displayStock}
                  variantValidationValid={variantValidation.valid}
                  addToCartPending={addToCartPending}
                  handleAddToCart={handleAddToCart}
                  handleBuyNow={handleBuyNow}
                  isSubscription={isSubscription}
                  canQuote={canQuote}
                  onRequestQuote={() => setShowQuote(true)}
                  isAuthenticated={isAuthenticated}
                  signInMandatory={signInMandatory}
                  storePath={storePath}
                  hidePurchaseControls={!hasVariants}
                />
              </>
            )}

            {/* Trust badges */}
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                isDisplayFieldEnabled(sf, 'shipping_info') && {
                  icon: Truck,
                  text: product.shipping_cost ? `Shipping: ${formatCurrency(product.shipping_cost)}` : 'Free Delivery',
                  color: 'text-blue-600 bg-blue-50',
                },
                isDisplayFieldEnabled(sf, 'return_policy') && {
                  icon: RefreshCw,
                  text: returnDays ? `${returnDays}-Day Returns` : isReturnable === false ? 'Non-returnable' : 'Easy Returns',
                  color: 'text-green-600 bg-green-50',
                },
                isDisplayFieldEnabled(sf, 'warranty') && {
                  icon: ShieldCheck,
                  text: warrantyDays ? `${warrantyDays >= 365 ? `${Math.floor(warrantyDays / 365)}Y` : `${warrantyDays}D`} Warranty` : 'Secure Buy',
                  color: 'text-primary bg-accent',
                },
              ].filter((badge): badge is { icon: typeof Truck; text: string; color: string } => Boolean(badge)).map((badge) => (
                <div key={badge.text} className={`text-center p-2.5 rounded-lg ${badge.color}`}>
                  <badge.icon className="w-5 h-5 mx-auto mb-0.5" />
                  <p className="text-xs font-medium leading-tight">{badge.text}</p>
                </div>
              ))}
            </div>

            {isDisplayFieldEnabled(sf, 'short_description') && product.short_description && (
              <p className="mt-4 text-sm text-gray-600 leading-relaxed">{product.short_description}</p>
            )}
            {isDisplayFieldEnabled(sf, 'description') && product.description && (
              <div className="mt-5">
                <h3 className="text-sm font-bold text-gray-900 mb-2">About this item</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{product.description}</p>
              </div>
            )}
            {isDisplayFieldEnabled(sf, 'tags') && product.tags && product.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {product.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                    <Tag className="w-3 h-3" />{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {isDisplayFieldEnabled(sf, 'shipping_info') && product.requires_shipping !== false && (
          <div className={`${catalogCard} p-5`}>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><Truck className="w-4 h-4 text-blue-600" /> Shipping & Delivery</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-start gap-2"><Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <span className="text-gray-600">{product.shipping_cost_type === 'free' || !product.shipping_cost ? 'Free Delivery' : `Shipping: ${formatCurrency(product.shipping_cost)}`}</span>
              </div>
              {product.free_shipping_threshold && <div className="flex items-start gap-2"><Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" /><span className="text-gray-500">Free on orders above {formatCurrency(product.free_shipping_threshold)}</span></div>}
              {product.shipping_class && <div className="flex items-start gap-2"><Package className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><span className="text-gray-500 capitalize">{product.shipping_class} shipping</span></div>}
              {isDisplayFieldEnabled(sf, 'weight') && product.weight_kg && <div className="flex items-start gap-2"><Ruler className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><span className="text-gray-500">Weight: {product.weight_kg} kg</span></div>}
              {isDisplayFieldEnabled(sf, 'dimensions') && (product.length_cm || product.width_cm || product.height_cm) && (
                <div className="flex items-start gap-2"><Box className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <span className="text-gray-500">{[product.length_cm && `${product.length_cm}L`, product.width_cm && `${product.width_cm}W`, product.height_cm && `${product.height_cm}H`].filter(Boolean).join(' × ')} cm</span>
                </div>
              )}
            </div>
          </div>
        )}

        {isDisplayFieldEnabled(sf, 'return_policy') && (returnPolicy || returnDays || isReturnable !== undefined) && (
          <div className={`${catalogCard} p-5`}>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><RefreshCw className="w-4 h-4 text-green-600" /> Return Policy</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-start gap-2">
                {isReturnable === false ? (
                  <span className="text-red-600 font-medium">This item is non-returnable</span>
                ) : (
                  <><Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" /><span className="text-gray-600">{returnDays ? `${returnDays}-day return window` : 'Returns accepted'}</span></>
                )}
              </div>
              {returnPolicy && <p className="text-gray-500 text-xs leading-relaxed">{returnPolicy}</p>}
              {isDisplayFieldEnabled(sf, 'return_conditions') && returnConditions && <div className="flex items-start gap-2"><Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" /><span className="text-gray-500 text-xs">{returnConditions}</span></div>}
              {isDisplayFieldEnabled(sf, 'refund_policy') && refundPolicy && <div className="flex items-start gap-2"><Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" /><span className="text-gray-500 capitalize">{refundPolicy.replace(/_/g, ' ')}</span></div>}
            </div>
          </div>
        )}

        {isDisplayFieldEnabled(sf, 'warranty') && (warrantyType || warrantyDays) && (
          <div className={`${catalogCard} p-5`}>
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Warranty</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-start gap-2"><Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <span className="text-gray-600">{warrantyDays ? warrantyDays >= 365 ? `${Math.floor(warrantyDays / 365)} Year${Math.floor(warrantyDays / 365) > 1 ? 's' : ''} Warranty` : `${warrantyDays} Day Warranty` : 'Warranty Included'}</span>
              </div>
              {warrantyType && <div className="flex items-start gap-2"><Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" /><span className="text-gray-500 capitalize">{warrantyType} warranty</span></div>}
              {selectedVariant?.manufacture_date && <div className="flex items-start gap-2"><Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><span className="text-gray-500">Mfg: {selectedVariant.manufacture_date}</span></div>}
              {selectedVariant?.expiration_date && <div className="flex items-start gap-2"><Calendar className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" /><span className="text-gray-500">Expires: {selectedVariant.expiration_date}</span></div>}
            </div>
          </div>
        )}
      </div>

      {/* Variant / Plan Comparison Table */}
      {showVariants && activeVariants.length > 1 && (
        <div className={`${catalogCard} p-4 sm:p-6 lg:p-8 mt-6 overflow-x-auto`}>
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            {isSubscription ? <><Repeat className="w-5 h-5 text-primary" /> Compare Plans</> : <><Box className="w-5 h-5" /> Available Options</>}
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 font-semibold text-gray-700 pr-4">{isSubscription ? 'Plan' : 'Option'}</th>
                {isSubscription && <th className="pb-3 font-semibold text-gray-700 pr-4">Billing</th>}
                <th className="pb-3 font-semibold text-gray-700 pr-4">Price</th>
                {showCompare && activeVariants.some(v => v.compare_at_price) && <th className="pb-3 font-semibold text-gray-700 pr-4">M.R.P.</th>}
                {isSubscription && activeVariants.some(v => v.subscription_trial_days) && (
                  <th className="pb-3 font-semibold text-gray-700 pr-4">Trial</th>
                )}
                {isSubscription && activeVariants.some(v => v.subscription_setup_fee) && (
                  <th className="pb-3 font-semibold text-gray-700 pr-4">Setup</th>
                )}
                {!isSubscription && <th className="pb-3 font-semibold text-gray-700 pr-4">Stock</th>}
                {!isSubscription && activeVariants.some(v => v.color) && <th className="pb-3 font-semibold text-gray-700 pr-4">Color</th>}
                <th className="pb-3 font-semibold text-gray-700"></th>
              </tr>
            </thead>
            <tbody>
              {activeVariants.map(v => {
                const isSelected = selectedVariant?.id === v.id
                const vInterval = v.subscription_interval || 'monthly'
                const vPriceType = v.price_type || 'per_cycle'
                const priceUnit = isSubscription
                  ? (vPriceType === 'per_unit' ? `/${v.uom || 'unit'}` : (intervalShort[vInterval] || '/mo'))
                  : (showUom ? (() => {
                      const label = formatUomDisplay(v.uom_quantity, v.uom || product.uom)
                      return label ? `/${label}` : ''
                    })() : '')
                return (
                  <tr key={v.id} className={`border-b last:border-0 transition-colors ${
                    isSelected ? (isSubscription ? 'bg-accent/80' : 'bg-blue-50/50') : 'hover:bg-gray-50'
                  }`}>
                    <td className="py-3 pr-4">
                      <span className={`font-medium ${isSelected ? (isSubscription ? 'text-primary' : 'text-blue-700') : 'text-gray-900'}`}>{v.name}</span>
                    </td>
                    {isSubscription && (
                      <td className="py-3 pr-4">
                        <span className="text-xs font-medium text-primary bg-accent px-2 py-0.5 rounded-full">
                          {intervalLabel[vInterval] || vInterval}
                        </span>
                      </td>
                    )}
                    <td className="py-3 pr-4">
                      {hasStorefrontDisplayPrice(v.price, v.price_type) ? (
                        <>
                          <span className="font-bold text-gray-900">{formatCurrency(v.price, v.currency)}</span>
                          {isSubscription && <span className="text-xs text-gray-400 ml-0.5">{priceUnit}</span>}
                        </>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    {showCompare && activeVariants.some(av => av.compare_at_price) && (
                      <td className="py-3 pr-4 text-gray-400 line-through">{
                        hasStorefrontDisplayPrice(v.price, v.price_type) && v.compare_at_price
                          ? formatCurrency(v.compare_at_price, v.currency)
                          : '—'
                      }</td>
                    )}
                    {isSubscription && activeVariants.some(av => av.subscription_trial_days) && (
                      <td className="py-3 pr-4">
                        {v.subscription_trial_days && v.subscription_trial_days > 0
                          ? <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{v.subscription_trial_days}d free</span>
                          : <span className="text-xs text-gray-300">—</span>}
                      </td>
                    )}
                    {isSubscription && activeVariants.some(av => av.subscription_setup_fee) && (
                      <td className="py-3 pr-4 text-sm text-gray-600">
                        {v.subscription_setup_fee && v.subscription_setup_fee > 0
                          ? formatCurrency(v.subscription_setup_fee, v.currency)
                          : <span className="text-gray-300">—</span>}
                      </td>
                    )}
                    {!isSubscription && (
                      <td className="py-3 pr-4">
                        {(() => {
                          const status = getEffectiveStockStatus(product, v)
                          return (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              status === 'in_stock' ? 'text-green-700 bg-green-50'
                                : status === 'out_of_stock' ? 'text-red-700 bg-red-50'
                                : 'text-amber-700 bg-amber-50'
                            }`}>
                              {status.replace(/_/g, ' ')}
                            </span>
                          )
                        })()}
                      </td>
                    )}
                    {!isSubscription && activeVariants.some(av => av.color) && (
                      <td className="py-3 pr-4">
                        {v.color && <span className="w-4 h-4 rounded-full border border-gray-300 inline-block" style={{ backgroundColor: v.color }} />}
                      </td>
                    )}
                    <td className="py-3">
                      <button onClick={() => setSelectedVariantId(v.id)}
                        className={`text-xs font-medium px-3 py-1 rounded-md transition-colors ${
                          isSelected
                            ? (isSubscription ? 'bg-primary text-white' : 'bg-primary text-white')
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}>
                        {isSelected ? 'Selected' : 'Select'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {isDisplayFieldEnabled(sf, 'specifications') && specs && (
        <div className={`${catalogCard} p-4 sm:p-6 lg:p-8 mt-6`}>
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Box className="w-5 h-5" /> Specifications</h3>
          <div className="divide-y">
            {Object.entries(specs).map(([key, value]) => (
              <div key={key} className="grid grid-cols-3 py-3 text-sm">
                <span className="text-gray-500 font-medium">{key}</span>
                <span className="col-span-2 text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <MerchProductGrid title="Frequently Bought Together" subtitle="Customers also purchased these items"
        products={crossSellProducts} storePath={storePath} />
      <MerchProductGrid title="You May Also Like" subtitle="Upgrade your experience"
        products={upsellProducts} storePath={storePath} />

      {isDisplayFieldEnabled(sf, 'reviews') && (
      <div className={`${catalogCard} p-4 sm:p-6 lg:p-8 mt-6`}>
        <ReviewSection reviewType="product" targetId={product.id} />
      </div>
      )}

    </div>
  )
}
