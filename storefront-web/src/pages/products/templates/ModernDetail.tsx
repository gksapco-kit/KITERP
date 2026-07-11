import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { formatCurrency, imgUrl } from '@/lib/utils'
import {
  ShoppingBag,
  Truck, ShieldCheck, RefreshCw, ChevronRight, Tag, Package,
  Award, Zap, Check, Info, Box, Repeat, MessageSquare,
} from 'lucide-react'
import SubscriptionConfigurator from '@/components/SubscriptionConfigurator'
import StarRating from '@/components/StarRating'
import ReviewSection from '@/components/ReviewSection'
import MerchProductGrid from './MerchProductGrid'
import MediaViewer from '@/components/MediaViewer'
import ColorSwatchPicker from '@/components/products/ColorSwatchPicker'
import { ProductPurchaseActions } from '@/components/products/ProductPurchaseActions'
import { ProductMediaWishlistOverlay } from '@/components/products/ProductMediaWishlistOverlay'
import { isCombinationAvailable } from '@/lib/variantOptions'
import type { ProductDetailTemplateProps } from './types'
import { isDisplayFieldEnabled } from '@/lib/storefrontDisplayFields'
import { themeUi } from '@/lib/themeColors'

type Tab = 'description' | 'specs' | 'shipping' | 'reviews'

export default function ModernDetail(props: ProductDetailTemplateProps) {
  const {
    displayFields,
    product, selectedVariant, activeVariants, hasVariants,
    setSelectedVariantId, qty, setQty, validateQtyChange, maxAddQty, minAddQty, onHandQty,
    displayPrice, displayCompare, displayCurrency, displayStock,
    displayOfferLabel, displayOnSale, discount, variantColors, onSelectColor,
    optionRows, selections, onSelectSize, selectedColorName, variantValidation, hasStructuredOptions,
    selectedImage, setSelectedImage, displayMedia,
    selectedVariantId,
    handleAddToCart, handleBuyNow, isAuthenticated, signInMandatory, addToCartPending,
    storePath, warrantyDays, warrantyType, returnDays, returnPolicy,
    returnConditions, refundPolicy, isReturnable, specs,
    crossSellProducts, upsellProducts,
    isSubscription, subscriptionInterval, subscriptionPrice,
    subscriptionPriceType, subscriptionUom,
    subscriptionTrialDays, subscriptionSetupFee, subscriptionBillingCycles,
    subscriptionScheduleModes,
    canQuote, setShowQuote,
  } = props
  const qtyMax = maxAddQty ?? 99

  const sf = displayFields
  const showCompare = isDisplayFieldEnabled(sf, 'compare_at_price')
  const showVariants = isDisplayFieldEnabled(sf, 'variants') && hasVariants

  const intervalLabel: Record<string, string> = {
    daily: 'Daily', weekly: 'Weekly', biweekly: 'Bi-Weekly', monthly: 'Monthly',
    quarterly: 'Quarterly', biannual: 'Half-Yearly', yearly: 'Yearly',
  }
  const intervalShort: Record<string, string> = {
    daily: '/day', weekly: '/wk', biweekly: '/2wk', monthly: '/mo',
    quarterly: '/qtr', biannual: '/6mo', yearly: '/yr',
  }

  const hasSpecsContent = Boolean(specs && Object.keys(specs).length > 0)
  const showWeight = isDisplayFieldEnabled(sf, 'weight') && Boolean(product.weight_kg)
  const showDimensions = isDisplayFieldEnabled(sf, 'dimensions') && Boolean(product.length_cm || product.width_cm || product.height_cm)
  const showShippingSection = isDisplayFieldEnabled(sf, 'shipping_info') && product.requires_shipping !== false
  const showReturnsSection = isDisplayFieldEnabled(sf, 'return_policy') && Boolean(returnPolicy || returnDays || isReturnable !== undefined)
  const showWarrantySection = isDisplayFieldEnabled(sf, 'warranty') && Boolean(warrantyType || warrantyDays)

  const tabs: { id: Tab; label: string }[] = []
  if (isDisplayFieldEnabled(sf, 'description') && product.description) {
    tabs.push({ id: 'description', label: 'Description' })
  }
  if (isDisplayFieldEnabled(sf, 'specifications') && hasSpecsContent) {
    tabs.push({ id: 'specs', label: 'Specifications' })
  }
  if (showShippingSection || showReturnsSection || showWarrantySection || showWeight || showDimensions) {
    tabs.push({ id: 'shipping', label: 'Shipping & Returns' })
  }
  if (isDisplayFieldEnabled(sf, 'reviews')) {
    tabs.push({ id: 'reviews', label: `Reviews${product.review_count ? ` (${product.review_count})` : ''}` })
  }

  const [activeTab, setActiveTab] = useState<Tab>('description')

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0].id)
    }
  }, [tabs, activeTab])

  return (
    <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4 flex items-center flex-wrap gap-1">
        <Link to={storePath('/')} className="hover:text-blue-600">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={storePath('/products')} className="hover:text-blue-600">Products</Link>
        {isDisplayFieldEnabled(sf, 'category') && product.category && (
          <>
            <ChevronRight className="w-3 h-3" />
            <Link to={storePath(`/products?category=${encodeURIComponent(product.category)}`)} className="hover:text-blue-600">{product.category}</Link>
          </>
        )}
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900 font-medium">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left — Sticky Image Gallery */}
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-4">
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
                  {showCompare && discount > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow">-{discount}%</span>}
                  {isDisplayFieldEnabled(sf, 'new_arrival_badge') && product.is_new_arrival && (
                    <span className="bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow flex items-center gap-1"><Zap className="w-3 h-3" /> New</span>
                  )}
                  {isDisplayFieldEnabled(sf, 'best_seller_badge') && product.is_best_seller && (
                    <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow flex items-center gap-1"><Award className="w-3 h-3" /> Bestseller</span>
                  )}
                </div>
              }
            />
          </div>
        </div>

        {/* Center — Product Info */}
        <div className="lg:col-span-4 space-y-5">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {isDisplayFieldEnabled(sf, 'brand') && product.brand && (
                <span className="text-xs font-medium text-blue-600 uppercase tracking-wider">{product.brand}</span>
              )}
              {isDisplayFieldEnabled(sf, 'category') && product.category && (
                <span className="text-xs text-gray-400">in {product.category}</span>
              )}
              {isDisplayFieldEnabled(sf, 'subcategory') && product.subcategory && (
                <span className="text-xs text-gray-400">/ {product.subcategory}</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{product.name}</h1>
            {isDisplayFieldEnabled(sf, 'reviews') && (product.avg_rating ?? 0) > 0 && (
              <div className="mt-2"><StarRating rating={product.avg_rating!} showValue reviewCount={product.review_count} /></div>
            )}
          </div>

          {isDisplayFieldEnabled(sf, 'short_description') && product.short_description && (
            <p className="text-sm text-gray-600 leading-relaxed">{product.short_description}</p>
          )}

          {/* Variant / Plan Selector */}
          {showVariants && (
            <div className="space-y-4 border-t pt-5">
              {optionRows.filter((r) => r.type === 'size').map((sizeRow) => (
                sizeRow.type === 'size' ? (
                  <div key={`size-${sizeRow.label}`}>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                      {sizeRow.label}
                      {selections[sizeRow.label] ? (
                        <span className="ml-1.5 font-normal normal-case text-gray-400">— {selections[sizeRow.label]}</span>
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
                                ? 'border-gray-900 bg-gray-900 text-white'
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
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Color
                    {selectedColorName ? (
                      <span className="ml-1.5 font-normal normal-case text-gray-400">— {selectedColorName}</span>
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

              {!variantValidation.valid && variantValidation.message ? (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {variantValidation.message}
                </p>
              ) : null}

              {isSubscription ? (
                <div>
                  <p className="text-xs font-medium text-primary uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5" /> Choose a Plan
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {activeVariants.map(v => {
                      const isSelected = selectedVariant?.id === v.id
                      const vInterval = v.subscription_interval || 'monthly'
                      const vPriceType = v.price_type || 'per_cycle'
                      const vShort = vPriceType === 'per_unit' ? `/${v.uom || 'unit'}` : (intervalShort[vInterval] || '/mo')
                      const hasTrial = v.subscription_trial_days && v.subscription_trial_days > 0
                      const hasSetup = v.subscription_setup_fee && v.subscription_setup_fee > 0
                      return (
                        <button key={v.id} onClick={() => setSelectedVariantId(v.id)}
                          className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                            isSelected ? 'border-primary bg-accent/80' : 'border-gray-200 hover:border-primary/40'
                          }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-gray-900'}`}>{v.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${isSelected ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'}`}>
                                  {intervalLabel[vInterval] || vInterval}
                                </span>
                                {hasTrial && (
                                  <span className="text-xs font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                                    {v.subscription_trial_days}d trial
                                  </span>
                                )}
                                {hasSetup && (
                                  <span className="text-xs font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                    {formatCurrency(v.subscription_setup_fee!, v.currency)} setup
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-lg font-extrabold ${isSelected ? 'text-primary' : 'text-gray-900'}`}>
                                {formatCurrency(v.price, v.currency)}
                              </p>
                              <p className="text-xs text-gray-400">{vShort}</p>
                            </div>
                          </div>
                          {showCompare && v.compare_at_price && v.compare_at_price > v.price && (
                            <p className="text-xs text-gray-400 line-through mt-1">{formatCurrency(v.compare_at_price, v.currency)}</p>
                          )}
                          {isSelected && (
                            <div className="absolute top-3 right-3">
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
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Options</p>
                  <div className="grid grid-cols-2 gap-2">
                    {activeVariants.map(v => {
                      const isSelected = selectedVariant?.id === v.id
                      return (
                        <button key={v.id} onClick={() => setSelectedVariantId(v.id)}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            isSelected ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                          }`}>
                          <p className="text-sm font-semibold text-gray-900">{v.name}</p>
                          <p className="text-sm font-bold mt-0.5">{formatCurrency(v.price, v.currency)}</p>
                          {showCompare && v.compare_at_price && v.compare_at_price > v.price && (
                            <p className="text-xs text-gray-400 line-through">{formatCurrency(v.compare_at_price, v.currency)}</p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Tags */}
          {isDisplayFieldEnabled(sf, 'tags') && product.tags && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {product.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full"><Tag className="w-3 h-3" />{tag}</span>
              ))}
            </div>
          )}

          {/* Tabbed content */}
          {tabs.length > 0 && (
          <div className="border-t pt-5">
            <div className="flex gap-1 border-b">
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === tab.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}>{tab.label}</button>
              ))}
            </div>

            <div className="pt-5 min-h-[200px]">
              {activeTab === 'description' && isDisplayFieldEnabled(sf, 'description') && (
                <div className="prose prose-sm max-w-none">
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{product.description}</p>
                </div>
              )}

              {activeTab === 'specs' && isDisplayFieldEnabled(sf, 'specifications') && hasSpecsContent && (
                <div className="divide-y">
                  {Object.entries(specs!).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-5 py-3 text-sm">
                      <span className="col-span-2 text-gray-500 font-medium">{key}</span>
                      <span className="col-span-3 text-gray-900">{value}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'shipping' && (
                <div className="space-y-5">
                  {showShippingSection && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2"><Truck className="w-4 h-4 text-blue-600" /> Shipping</h4>
                      <ul className="space-y-2 text-sm text-gray-600">
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" />
                          {product.shipping_cost_type === 'free' || !product.shipping_cost ? 'Free Delivery' : `Shipping: ${formatCurrency(product.shipping_cost)}`}
                        </li>
                        {product.free_shipping_threshold && <li className="flex items-center gap-2"><Info className="w-4 h-4 text-blue-500 shrink-0" />Free on orders above {formatCurrency(product.free_shipping_threshold)}</li>}
                        {product.shipping_class && <li className="flex items-center gap-2"><Package className="w-4 h-4 text-gray-400 shrink-0" /><span className="capitalize">{product.shipping_class} shipping</span></li>}
                        {showWeight && <li className="flex items-center gap-2"><Box className="w-4 h-4 text-gray-400 shrink-0" />Weight: {product.weight_kg} kg</li>}
                        {showDimensions && (
                          <li className="flex items-center gap-2"><Box className="w-4 h-4 text-gray-400 shrink-0" />
                            Dimensions: {[product.length_cm && `${product.length_cm}L`, product.width_cm && `${product.width_cm}W`, product.height_cm && `${product.height_cm}H`].filter(Boolean).join(' × ')} cm
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                  {!showShippingSection && (showWeight || showDimensions) && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2"><Box className="w-4 h-4 text-gray-400" /> Package Details</h4>
                      <ul className="space-y-2 text-sm text-gray-600">
                        {showWeight && <li>Weight: {product.weight_kg} kg</li>}
                        {showDimensions && (
                          <li>Dimensions: {[product.length_cm && `${product.length_cm}L`, product.width_cm && `${product.width_cm}W`, product.height_cm && `${product.height_cm}H`].filter(Boolean).join(' × ')} cm</li>
                        )}
                      </ul>
                    </div>
                  )}
                  {showReturnsSection && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2"><RefreshCw className="w-4 h-4 text-green-600" /> Returns</h4>
                      <ul className="space-y-2 text-sm text-gray-600">
                        {isReturnable === false ? (
                          <li className="text-red-600 font-medium">This item is non-returnable</li>
                        ) : (
                          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" />{returnDays ? `${returnDays}-day return window` : 'Returns accepted'}</li>
                        )}
                        {returnPolicy && <li className="text-xs text-gray-500">{returnPolicy}</li>}
                        {isDisplayFieldEnabled(sf, 'return_conditions') && returnConditions && <li className="text-xs text-gray-500">{returnConditions}</li>}
                        {isDisplayFieldEnabled(sf, 'refund_policy') && refundPolicy && <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" /><span className="capitalize">{refundPolicy.replace(/_/g, ' ')}</span></li>}
                      </ul>
                    </div>
                  )}
                  {showWarrantySection && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Warranty</h4>
                      <ul className="space-y-2 text-sm text-gray-600">
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" />
                          {warrantyDays ? warrantyDays >= 365 ? `${Math.floor(warrantyDays / 365)} Year Warranty` : `${warrantyDays} Day Warranty` : 'Warranty Included'}
                        </li>
                        {warrantyType && <li className="capitalize text-gray-500">{warrantyType} warranty</li>}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'reviews' && isDisplayFieldEnabled(sf, 'reviews') && (
                <ReviewSection reviewType="product" targetId={product.id} />
              )}
            </div>
          </div>
          )}
        </div>

        {/* Right — Sticky Buy Box */}
        <div className="lg:col-span-3">
          <div className={`lg:sticky lg:top-4 rounded-2xl border p-5 space-y-4 ${themeUi.cardSurface} ${themeUi.cardBorder}`}>
            {/* Price */}
            <div>
              {isDisplayFieldEnabled(sf, 'offer_label') && displayOfferLabel && displayOnSale && (
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full mb-2 inline-block">{displayOfferLabel}</span>
              )}
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">
                  {formatCurrency(displayPrice, displayCurrency)}
                  {isSubscription && subscriptionInterval && (
                    <span className="text-sm font-normal text-gray-400 ml-1">
                      {subscriptionPriceType === 'per_unit'
                        ? `/${subscriptionUom || 'unit'}`
                        : (intervalShort[subscriptionInterval] || `/${subscriptionInterval}`)}
                    </span>
                  )}
                </span>
              </div>
              {showCompare && displayCompare && displayCompare > displayPrice && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-400 line-through">M.R.P.: {formatCurrency(displayCompare, displayCurrency)}</span>
                  {discount > 0 && <span className="text-sm font-bold text-red-600">Save {discount}%</span>}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {isSubscription && subscriptionInterval
                  ? `Billed ${intervalLabel[subscriptionInterval] || subscriptionInterval} · Inclusive of all taxes`
                  : 'Inclusive of all taxes'}
              </p>
            </div>

            {/* Subscription Configurator */}
            {isSubscription && subscriptionInterval && (
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
                onSubscribe={() => handleBuyNow()}
                subscribePending={addToCartPending}
                disabled={displayStock === 'out_of_stock'}
              />
            )}

            {/* Stock */}
            {isDisplayFieldEnabled(sf, 'stock_status') && displayStock && (
              <div className={`text-sm font-semibold ${
                displayStock === 'in_stock' ? 'text-green-600' : displayStock === 'low_stock' ? 'text-amber-600' : 'text-red-600'
              }`}>
                {displayStock === 'in_stock' ? 'In Stock' : displayStock === 'low_stock' ? 'Only a few left' :
                 displayStock === 'out_of_stock' ? 'Currently Unavailable' : displayStock.replace(/_/g, ' ')}
              </div>
            )}

            {/* SKU / Barcode */}
            {((isDisplayFieldEnabled(sf, 'sku') && (selectedVariant?.sku || product.sku))
              || (isDisplayFieldEnabled(sf, 'barcode') && (selectedVariant?.barcode || product.barcode))) && (
              <div className="space-y-0.5">
                {isDisplayFieldEnabled(sf, 'sku') && (selectedVariant?.sku || product.sku) && (
                  <p className="text-xs text-gray-400">SKU: {selectedVariant?.sku || product.sku}</p>
                )}
                {isDisplayFieldEnabled(sf, 'barcode') && (selectedVariant?.barcode || product.barcode) && (
                  <p className="text-xs text-gray-400">Barcode: {selectedVariant?.barcode || product.barcode}</p>
                )}
              </div>
            )}

            <ProductPurchaseActions
              qty={qty}
              setQty={setQty}
              validateQtyChange={validateQtyChange}
              maxQty={maxAddQty}
              minQty={minAddQty}
              onHandQty={onHandQty}
              displayPrice={displayPrice}
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
              className="space-y-4 border-t pt-4"
            />

            {/* Trust strip */}
            <div className="border-t pt-4 space-y-2.5">
              {[
                isDisplayFieldEnabled(sf, 'shipping_info') && {
                  icon: Truck,
                  text: product.shipping_cost ? `Delivery: ${formatCurrency(product.shipping_cost)}` : 'Free Delivery',
                },
                isDisplayFieldEnabled(sf, 'return_policy') && {
                  icon: RefreshCw,
                  text: returnDays ? `${returnDays}-Day Returns` : isReturnable === false ? 'Non-returnable' : 'Easy Returns',
                },
                isDisplayFieldEnabled(sf, 'warranty') && {
                  icon: ShieldCheck,
                  text: warrantyDays ? `${warrantyDays >= 365 ? `${Math.floor(warrantyDays / 365)}Y` : `${warrantyDays}D`} Warranty` : 'Secure Purchase',
                },
              ].filter((badge): badge is { icon: typeof Truck; text: string } => Boolean(badge)).map(b => (
                <div key={b.text} className="flex items-center gap-3 text-sm text-gray-600">
                  <b.icon className="w-4 h-4 text-gray-400 shrink-0" /><span>{b.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <MerchProductGrid title="Frequently Bought Together" subtitle="Customers also purchased these items"
        products={crossSellProducts} storePath={storePath} />
      <MerchProductGrid title="You May Also Like" subtitle="Upgrade your experience"
        products={upsellProducts} storePath={storePath} />
    </div>
  )
}
