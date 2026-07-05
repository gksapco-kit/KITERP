import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { formatCurrency, imgUrl } from '@/lib/utils'
import {
  Minus, Plus, ShoppingCart, Loader2, ShoppingBag,
  Truck, ShieldCheck, RefreshCw, ChevronRight, Tag,
  Award, Zap, Check, Repeat, MessageSquare,
} from 'lucide-react'
import SubscriptionConfigurator from '@/components/SubscriptionConfigurator'
import StarRating from '@/components/StarRating'
import ReviewSection from '@/components/ReviewSection'
import MerchProductGrid from './MerchProductGrid'
import MediaViewer from '@/components/MediaViewer'
import ColorSwatchPicker from '@/components/products/ColorSwatchPicker'
import { isCombinationAvailable } from '@/lib/variantOptions'
import type { ProductDetailTemplateProps } from './types'
import { isDisplayFieldEnabled } from '@/lib/storefrontDisplayFields'

export default function MinimalDetail(props: ProductDetailTemplateProps) {
  const {
    displayFields,
    product, selectedVariant, activeVariants, hasVariants,
    setSelectedVariantId, qty, setQty, maxAddQty,
    displayPrice, displayCompare, displayCurrency, displayStock,
    displayOfferLabel, displayOnSale, discount, variantColors, onSelectColor,
    optionRows, selections, onSelectSize, selectedColorName, variantValidation, hasStructuredOptions,
    selectedImage, setSelectedImage, displayMedia,
    selectedVariantId,
    handleAddToCart, handleBuyNow, isAuthenticated, addToCartPending,
    storePath, warrantyDays, returnDays, isReturnable, specs,
    warrantyType, returnPolicy, returnConditions, refundPolicy,
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

  const showShippingSection = isDisplayFieldEnabled(sf, 'shipping_info') && product.requires_shipping !== false
  const showReturnSection = isDisplayFieldEnabled(sf, 'return_policy') && (returnPolicy || returnDays || isReturnable !== undefined)
  const showWarrantySection = isDisplayFieldEnabled(sf, 'warranty') && (warrantyDays || warrantyType)

  const trustBadges = [
    isDisplayFieldEnabled(sf, 'shipping_info') && {
      icon: Truck,
      text: product.shipping_cost ? `${formatCurrency(product.shipping_cost)} Shipping` : 'Free Delivery',
    },
    isDisplayFieldEnabled(sf, 'return_policy') && {
      icon: RefreshCw,
      text: returnDays ? `${returnDays}-Day Returns` : isReturnable === false ? 'Non-returnable' : 'Easy Returns',
    },
    isDisplayFieldEnabled(sf, 'warranty') && {
      icon: ShieldCheck,
      text: warrantyDays ? `${warrantyDays >= 365 ? `${Math.floor(warrantyDays / 365)}Y` : `${warrantyDays}D`} Warranty` : 'Secure Buy',
    },
  ].filter((badge): badge is { icon: typeof Truck; text: string } => Boolean(badge))

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 mb-8 flex items-center gap-1">
        <Link to={storePath('/')} className="hover:text-gray-600">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={storePath('/products')} className="hover:text-gray-600">Products</Link>
        {isDisplayFieldEnabled(sf, 'category') && product.category && (
          <>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-500">{product.category}</span>
          </>
        )}
      </nav>

      {/* Hero Media */}
      <div className="mb-8">
        <MediaViewer
          items={displayMedia}
          selectedIndex={selectedImage}
          onSelect={setSelectedImage}
          productName={product.name}
          badges={
            <div className="absolute top-4 left-4 flex gap-2">
              {isDisplayFieldEnabled(sf, 'new_arrival_badge') && product.is_new_arrival && (
                <span className="bg-black text-white text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1"><Zap className="w-3 h-3" /> New</span>
              )}
              {isDisplayFieldEnabled(sf, 'best_seller_badge') && product.is_best_seller && (
                <span className="bg-amber-500 text-white text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1"><Award className="w-3 h-3" /> Bestseller</span>
              )}
            </div>
          }
        />
      </div>

      {/* Product Title — Centered */}
      <div className="text-center mb-6">
        {isDisplayFieldEnabled(sf, 'brand') && product.brand && (
          <p className="text-xs font-medium text-gray-400 uppercase tracking-[0.2em] mb-2">{product.brand}</p>
        )}
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">{product.name}</h1>
        {isDisplayFieldEnabled(sf, 'reviews') && (product.avg_rating ?? 0) > 0 && (
          <div className="mt-3 flex justify-center">
            <StarRating rating={product.avg_rating!} showValue reviewCount={product.review_count} />
          </div>
        )}
        {isDisplayFieldEnabled(sf, 'short_description') && product.short_description && (
          <p className="mt-4 text-gray-500 text-sm max-w-md mx-auto leading-relaxed">{product.short_description}</p>
        )}
      </div>

      {/* Price — Centered */}
      <div className="text-center mb-8">
        <div className="flex items-baseline justify-center gap-3">
          <span className="text-3xl font-bold text-gray-900">
            {formatCurrency(displayPrice, displayCurrency)}
            {isSubscription && subscriptionInterval && (
              <span className="text-base font-normal text-gray-400 ml-1">
                {subscriptionPriceType === 'per_unit'
                  ? `/${subscriptionUom || 'unit'}`
                  : (intervalShort[subscriptionInterval] || `/${subscriptionInterval}`)}
              </span>
            )}
          </span>
          {showCompare && displayCompare && displayCompare > displayPrice && (
            <span className="text-lg text-gray-400 line-through">{formatCurrency(displayCompare, displayCurrency)}</span>
          )}
          {showCompare && discount > 0 && (
            <span className="text-sm font-bold text-red-500">-{discount}%</span>
          )}
        </div>
        {isDisplayFieldEnabled(sf, 'offer_label') && displayOfferLabel && displayOnSale && (
          <span className="inline-block mt-2 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full">{displayOfferLabel}</span>
        )}
        <p className="text-xs text-gray-400 mt-1">
          {isSubscription && subscriptionInterval
            ? `Billed ${intervalLabel[subscriptionInterval] || subscriptionInterval} · Inclusive of all taxes`
            : 'Inclusive of all taxes'}
        </p>
      </div>

      {/* Subscription Configurator */}
      {isSubscription && subscriptionInterval && (
        <div className="mb-8 max-w-md mx-auto">
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
        </div>
      )}

      {/* Variant / Plan Selector */}
      {showVariants && (
        <div className="mb-8 space-y-4">
          {optionRows.filter((r) => r.type === 'size').map((sizeRow) => (
            sizeRow.type === 'size' ? (
              <div key={`size-${sizeRow.label}`} className="text-center">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                  {sizeRow.label}
                  {selections[sizeRow.label] ? (
                    <span className="ml-1.5 font-normal normal-case text-gray-500">— {selections[sizeRow.label]}</span>
                  ) : null}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
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
                        className={`min-w-[2.75rem] px-4 py-2 rounded-full border-2 text-sm font-semibold uppercase transition-all ${
                          isSelected
                            ? 'border-black bg-black text-white'
                            : unavailable
                              ? 'border-gray-200 bg-gray-50 text-gray-400 opacity-60'
                              : 'border-gray-200 text-gray-700 hover:border-gray-400'
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
            <div className="flex justify-center">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide text-center mb-3">
                  Color
                  {selectedColorName ? (
                    <span className="ml-1.5 font-normal normal-case text-gray-500">— {selectedColorName}</span>
                  ) : null}
                </p>
                <ColorSwatchPicker
                  options={variantColors}
                  selectedVariantId={selectedVariant?.id}
                  selectedImageIndex={selectedImage}
                  selectedColorName={selectedColorName}
                  onSelect={onSelectColor}
                  className="justify-center"
                />
              </div>
            </div>
          )}

          {!variantValidation.valid && variantValidation.message ? (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-center max-w-md mx-auto">
              {variantValidation.message}
            </p>
          ) : null}

          {isSubscription ? (
            <div className="max-w-md mx-auto">
              <p className="text-xs font-medium text-primary/80 uppercase tracking-[0.15em] text-center mb-4 flex items-center justify-center gap-1.5">
                <Repeat className="w-3.5 h-3.5" /> Choose a Plan
              </p>
              <div className="space-y-2">
                {activeVariants.map(v => {
                  const isSelected = selectedVariant?.id === v.id
                  const vInterval = v.subscription_interval || 'monthly'
                  const vPriceType = v.price_type || 'per_cycle'
                  const vShort = vPriceType === 'per_unit' ? `/${v.uom || 'unit'}` : (intervalShort[vInterval] || '/mo')
                  const hasTrial = v.subscription_trial_days && v.subscription_trial_days > 0
                  const hasSetup = v.subscription_setup_fee && v.subscription_setup_fee > 0
                  return (
                    <button key={v.id} onClick={() => setSelectedVariantId(v.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                        isSelected ? 'border-black bg-black text-white' : 'border-gray-200 hover:border-gray-400'
                      }`}>
                      <div className="text-left">
                        <p className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>{v.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            isSelected ? 'bg-white/20 text-white/90' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {intervalLabel[vInterval] || vInterval}
                          </span>
                          {hasTrial && (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                              isSelected ? 'bg-green-400/20 text-green-200' : 'text-green-700 bg-green-50'
                            }`}>
                              {v.subscription_trial_days}d trial
                            </span>
                          )}
                          {hasSetup && (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                              isSelected ? 'bg-amber-400/20 text-amber-200' : 'text-amber-700 bg-amber-50'
                            }`}>
                              {formatCurrency(v.subscription_setup_fee!, v.currency)} setup
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-extrabold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                          {formatCurrency(v.price, v.currency)}
                        </p>
                        <p className={`text-xs ${isSelected ? 'text-white/60' : 'text-gray-400'}`}>{vShort}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : !hasStructuredOptions ? (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide text-center mb-3">Options</p>
              <div className="flex flex-wrap justify-center gap-2">
                {activeVariants.map(v => {
                  const isSelected = selectedVariant?.id === v.id
                  return (
                    <button key={v.id} onClick={() => setSelectedVariantId(v.id)}
                      className={`px-5 py-2.5 rounded-full border-2 text-sm font-medium transition-all ${
                        isSelected ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-700 hover:border-gray-400'
                      }`}>
                      {v.name} · {formatCurrency(v.price, v.currency)}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Stock */}
      {isDisplayFieldEnabled(sf, 'stock_status') && displayStock && (
        <div className="text-center mb-6">
          <span className={`text-sm font-medium ${
            displayStock === 'in_stock' ? 'text-green-600' : displayStock === 'low_stock' ? 'text-amber-600' : 'text-red-600'
          }`}>
            {displayStock === 'in_stock' ? 'In Stock' : displayStock === 'low_stock' ? 'Low Stock — Order Soon' :
             displayStock === 'out_of_stock' ? 'Out of Stock' : displayStock.replace(/_/g, ' ')}
          </span>
        </div>
      )}

      {/* Quantity & Buy */}
      <div className="max-w-sm mx-auto mb-12 space-y-4">
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center border rounded-full overflow-hidden">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 flex items-center justify-center hover:bg-gray-50"><Minus className="w-4 h-4" /></button>
            <span className="w-10 h-10 flex items-center justify-center text-sm font-bold">{qty}</span>
            <button onClick={() => setQty(qty + 1)} className="w-10 h-10 flex items-center justify-center hover:bg-gray-50"><Plus className="w-4 h-4" /></button>
          </div>
          {selectedVariant && qty > 1 && (
            <span className="text-sm text-gray-500">Total: <span className="font-semibold text-gray-900">{formatCurrency(displayPrice * qty, displayCurrency)}</span></span>
          )}
        </div>

        {isAuthenticated ? (
          <div className="space-y-2">
            {isSubscription ? (
              <p className="text-xs text-gray-400 text-center">Use the subscription plan above to subscribe.</p>
            ) : (
              <>
                <Button className="w-full h-12 rounded-full gap-2 bg-black hover:bg-gray-800 text-white font-medium"
                  onClick={handleAddToCart} disabled={addToCartPending || displayStock === 'out_of_stock' || !variantValidation.valid}>
                  {addToCartPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
                  {displayStock === 'out_of_stock' ? 'Out of Stock' : 'Add to Cart'}
                </Button>
                <Button variant="outline" className="w-full h-12 rounded-full font-medium" onClick={handleBuyNow}
                  disabled={addToCartPending || displayStock === 'out_of_stock' || !variantValidation.valid}>Buy Now</Button>
              </>
            )}
            {canQuote && (
              <Button variant="outline" className="w-full h-11 font-medium rounded-full mt-2" onClick={() => setShowQuote(true)}>
                <MessageSquare className="w-5 h-5 mr-2" /> Request a Quote
              </Button>
            )}
          </div>
        ) : (
          <Link to={storePath('/login')}>
            <Button className="w-full h-12 rounded-full font-medium bg-black hover:bg-gray-800 text-white">Sign in to Buy</Button>
          </Link>
        )}
      </div>

      {/* Trust Row */}
      {trustBadges.length > 0 && (
        <div className="flex justify-center gap-8 mb-12 py-6 border-y">
          {trustBadges.map(b => (
            <div key={b.text} className="flex items-center gap-2 text-sm text-gray-500">
              <b.icon className="w-4 h-4" /><span>{b.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Description */}
      {isDisplayFieldEnabled(sf, 'description') && product.description && (
        <div className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-3">About this item</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{product.description}</p>
        </div>
      )}

      {/* Specifications */}
      {isDisplayFieldEnabled(sf, 'specifications') && specs && (
        <div className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Specifications</h2>
          <div className="divide-y border rounded-xl overflow-hidden">
            {Object.entries(specs).map(([key, value]) => (
              <div key={key} className="grid grid-cols-3 text-sm">
                <span className="px-4 py-3 text-gray-500 bg-gray-50 font-medium">{key}</span>
                <span className="col-span-2 px-4 py-3 text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shipping / Returns / Warranty */}
      {(showShippingSection || showReturnSection || showWarrantySection) && (
        <div className="mb-10 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {showShippingSection && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5"><Truck className="w-4 h-4" /> Shipping</h3>
              <p className="text-sm text-gray-500">
                {product.shipping_cost_type === 'free' || !product.shipping_cost ? 'Free delivery' : `${formatCurrency(product.shipping_cost)} delivery`}
                {product.free_shipping_threshold ? `. Free above ${formatCurrency(product.free_shipping_threshold)}` : ''}
                {isDisplayFieldEnabled(sf, 'weight') && product.weight_kg ? ` · Weight: ${product.weight_kg} kg` : ''}
                {isDisplayFieldEnabled(sf, 'dimensions') && (product.length_cm || product.width_cm || product.height_cm)
                  ? ` · ${[product.length_cm && `${product.length_cm}L`, product.width_cm && `${product.width_cm}W`, product.height_cm && `${product.height_cm}H`].filter(Boolean).join(' × ')} cm`
                  : ''}
              </p>
            </div>
          )}
          {showReturnSection && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5"><RefreshCw className="w-4 h-4" /> Returns</h3>
              <p className="text-sm text-gray-500">
                {isReturnable === false ? 'Non-returnable' : returnDays ? `${returnDays}-day return window` : 'Returns accepted'}
                {returnPolicy ? `. ${returnPolicy}` : ''}
                {isDisplayFieldEnabled(sf, 'return_conditions') && returnConditions ? `. ${returnConditions}` : ''}
                {isDisplayFieldEnabled(sf, 'refund_policy') && refundPolicy ? `. ${refundPolicy.replace(/_/g, ' ')}` : ''}
              </p>
            </div>
          )}
          {showWarrantySection && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Warranty</h3>
              <p className="text-sm text-gray-500">
                {warrantyDays ? warrantyDays >= 365 ? `${Math.floor(warrantyDays / 365)} year warranty` : `${warrantyDays} day warranty` : 'Warranty included'}
                {warrantyType ? ` (${warrantyType})` : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {isDisplayFieldEnabled(sf, 'tags') && product.tags && product.tags.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {product.tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 text-xs text-gray-400 border px-3 py-1 rounded-full"><Tag className="w-3 h-3" />{tag}</span>
          ))}
        </div>
      )}

      <MerchProductGrid title="Frequently Bought Together" subtitle="Customers also purchased these items"
        products={crossSellProducts} storePath={storePath} />
      <MerchProductGrid title="You May Also Like" subtitle="Upgrade your experience"
        products={upsellProducts} storePath={storePath} />

      {/* Reviews */}
      {isDisplayFieldEnabled(sf, 'reviews') && (
        <div className="border-t pt-8">
          <ReviewSection reviewType="product" targetId={product.id} />
        </div>
      )}
    </div>
  )
}
