import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { formatCurrency, imgUrl } from '@/lib/utils'
import {
  Minus, Plus, ShoppingCart, Loader2, ShoppingBag,
  Truck, ShieldCheck, RefreshCw, ChevronRight, Tag, Package,
  Award, Zap, Check, Info, Box, Repeat, MessageSquare,
} from 'lucide-react'
import SubscriptionConfigurator from '@/components/SubscriptionConfigurator'
import StarRating from '@/components/StarRating'
import ReviewSection from '@/components/ReviewSection'
import MerchProductGrid from './MerchProductGrid'
import MediaViewer from '@/components/MediaViewer'
import type { ProductDetailTemplateProps } from './types'

type Tab = 'description' | 'specs' | 'shipping' | 'reviews'

export default function ModernDetail(props: ProductDetailTemplateProps) {
  const {
    product, selectedVariant, activeVariants, hasVariants,
    setSelectedVariantId, qty, setQty,
    displayPrice, displayCompare, displayCurrency, displayStock,
    displayOfferLabel, displayOnSale, discount, variantColors,
    selectedImage, setSelectedImage, displayMedia,
    selectedVariantId,
    handleAddToCart, handleBuyNow, isAuthenticated, addToCartPending,
    storePath, warrantyDays, warrantyType, returnDays, returnPolicy,
    returnConditions, refundPolicy, isReturnable, specs,
    crossSellProducts, upsellProducts,
    isSubscription, subscriptionInterval, subscriptionPrice,
    subscriptionPriceType, subscriptionUom,
    subscriptionTrialDays, subscriptionSetupFee, subscriptionBillingCycles,
    subscriptionScheduleModes,
    canQuote, setShowQuote,
  } = props

  const intervalLabel: Record<string, string> = {
    daily: 'Daily', weekly: 'Weekly', biweekly: 'Bi-Weekly', monthly: 'Monthly',
    quarterly: 'Quarterly', biannual: 'Half-Yearly', yearly: 'Yearly',
  }
  const intervalShort: Record<string, string> = {
    daily: '/day', weekly: '/wk', biweekly: '/2wk', monthly: '/mo',
    quarterly: '/qtr', biannual: '/6mo', yearly: '/yr',
  }

  const [activeTab, setActiveTab] = useState<Tab>('description')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'description', label: 'Description' },
    ...(specs ? [{ id: 'specs' as Tab, label: 'Specifications' }] : []),
    { id: 'shipping', label: 'Shipping & Returns' },
    { id: 'reviews', label: `Reviews${product.review_count ? ` (${product.review_count})` : ''}` },
  ]

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4 flex items-center flex-wrap gap-1">
        <Link to={storePath('/')} className="hover:text-blue-600">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={storePath('/products')} className="hover:text-blue-600">Products</Link>
        {product.category && (
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
              badges={
                <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                  {discount > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow">-{discount}%</span>}
                  {product.is_new_arrival && (
                    <span className="bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow flex items-center gap-1"><Zap className="w-3 h-3" /> New</span>
                  )}
                  {product.is_best_seller && (
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
              {product.brand && <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">{product.brand}</span>}
              {product.category && <span className="text-xs text-gray-400">in {product.category}</span>}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{product.name}</h1>
            {(product.avg_rating ?? 0) > 0 && (
              <div className="mt-2"><StarRating rating={product.avg_rating!} showValue reviewCount={product.review_count} /></div>
            )}
          </div>

          {product.short_description && <p className="text-sm text-gray-600 leading-relaxed">{product.short_description}</p>}

          {/* Variant / Plan Selector */}
          {hasVariants && (
            <div className="space-y-4 border-t pt-5">
              {variantColors && !isSubscription && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Color</p>
                  <div className="flex flex-wrap gap-2">
                    {variantColors.map(vc => (
                      <button key={vc.id} onClick={() => setSelectedVariantId(vc.id)} title={vc.name}
                        className={`w-10 h-10 rounded-full border-2 transition-all hover:scale-110 ${
                          selectedVariant?.id === vc.id ? 'border-gray-900 ring-2 ring-gray-300 scale-110' : 'border-gray-200'
                        }`} style={{ backgroundColor: vc.color }} />
                    ))}
                  </div>
                </div>
              )}

              {isSubscription ? (
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3 flex items-center gap-1.5">
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
                                  <span className="text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                                    {v.subscription_trial_days}d trial
                                  </span>
                                )}
                                {hasSetup && (
                                  <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                    {formatCurrency(v.subscription_setup_fee!, v.currency)} setup
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-lg font-extrabold ${isSelected ? 'text-primary' : 'text-gray-900'}`}>
                                {formatCurrency(v.price, v.currency)}
                              </p>
                              <p className="text-[11px] text-gray-400">{vShort}</p>
                            </div>
                          </div>
                          {v.compare_at_price && v.compare_at_price > v.price && (
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
              ) : (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Options</p>
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
                          {v.compare_at_price && v.compare_at_price > v.price && (
                            <p className="text-xs text-gray-400 line-through">{formatCurrency(v.compare_at_price, v.currency)}</p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {product.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full"><Tag className="w-3 h-3" />{tag}</span>
              ))}
            </div>
          )}

          {/* Tabbed content */}
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
              {activeTab === 'description' && (
                <div className="prose prose-sm max-w-none">
                  {product.description ? (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{product.description}</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No description available.</p>
                  )}
                </div>
              )}

              {activeTab === 'specs' && specs && (
                <div className="divide-y">
                  {Object.entries(specs).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-5 py-3 text-sm">
                      <span className="col-span-2 text-gray-500 font-medium">{key}</span>
                      <span className="col-span-3 text-gray-900">{value}</span>
                    </div>
                  ))}
                  {product.weight_kg && (
                    <div className="grid grid-cols-5 py-3 text-sm">
                      <span className="col-span-2 text-gray-500 font-medium">Weight</span>
                      <span className="col-span-3 text-gray-900">{product.weight_kg} kg</span>
                    </div>
                  )}
                  {(product.length_cm || product.width_cm || product.height_cm) && (
                    <div className="grid grid-cols-5 py-3 text-sm">
                      <span className="col-span-2 text-gray-500 font-medium">Dimensions</span>
                      <span className="col-span-3 text-gray-900">
                        {[product.length_cm && `${product.length_cm}L`, product.width_cm && `${product.width_cm}W`, product.height_cm && `${product.height_cm}H`].filter(Boolean).join(' × ')} cm
                      </span>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'shipping' && (
                <div className="space-y-5">
                  {product.requires_shipping !== false && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2"><Truck className="w-4 h-4 text-blue-600" /> Shipping</h4>
                      <ul className="space-y-2 text-sm text-gray-600">
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" />
                          {product.shipping_cost_type === 'free' || !product.shipping_cost ? 'Free Delivery' : `Shipping: ${formatCurrency(product.shipping_cost)}`}
                        </li>
                        {product.free_shipping_threshold && <li className="flex items-center gap-2"><Info className="w-4 h-4 text-blue-500 shrink-0" />Free on orders above {formatCurrency(product.free_shipping_threshold)}</li>}
                        {product.shipping_class && <li className="flex items-center gap-2"><Package className="w-4 h-4 text-gray-400 shrink-0" /><span className="capitalize">{product.shipping_class} shipping</span></li>}
                      </ul>
                    </div>
                  )}
                  {(returnPolicy || returnDays || isReturnable !== undefined) && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2"><RefreshCw className="w-4 h-4 text-green-600" /> Returns</h4>
                      <ul className="space-y-2 text-sm text-gray-600">
                        {isReturnable === false ? (
                          <li className="text-red-600 font-medium">This item is non-returnable</li>
                        ) : (
                          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" />{returnDays ? `${returnDays}-day return window` : 'Returns accepted'}</li>
                        )}
                        {returnPolicy && <li className="text-xs text-gray-500">{returnPolicy}</li>}
                        {returnConditions && <li className="text-xs text-gray-500">{returnConditions}</li>}
                        {refundPolicy && <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" /><span className="capitalize">{refundPolicy.replace(/_/g, ' ')}</span></li>}
                      </ul>
                    </div>
                  )}
                  {(warrantyType || warrantyDays) && (
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

              {activeTab === 'reviews' && <ReviewSection reviewType="product" targetId={product.id} />}
            </div>
          </div>
        </div>

        {/* Right — Sticky Buy Box */}
        <div className="lg:col-span-3">
          <div className="lg:sticky lg:top-4 bg-white rounded-2xl border p-5 space-y-4">
            {/* Price */}
            <div>
              {displayOfferLabel && displayOnSale && (
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
              {displayCompare && displayCompare > displayPrice && (
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
            {displayStock && (
              <div className={`text-sm font-semibold ${
                displayStock === 'in_stock' ? 'text-green-600' : displayStock === 'low_stock' ? 'text-amber-600' : 'text-red-600'
              }`}>
                {displayStock === 'in_stock' ? 'In Stock' : displayStock === 'low_stock' ? 'Only a few left' :
                 displayStock === 'out_of_stock' ? 'Currently Unavailable' : displayStock.replace(/_/g, ' ')}
              </div>
            )}

            {/* SKU */}
            {(product.sku || selectedVariant?.sku) && (
              <p className="text-xs text-gray-400">SKU: {selectedVariant?.sku || product.sku}</p>
            )}

            <div className="border-t pt-4" />

            {/* Quantity */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Quantity</p>
              <div className="flex items-center border rounded-lg overflow-hidden w-fit">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 flex items-center justify-center hover:bg-gray-50"><Minus className="w-4 h-4" /></button>
                <span className="w-12 h-10 flex items-center justify-center border-x text-sm font-bold bg-gray-50">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="w-10 h-10 flex items-center justify-center hover:bg-gray-50"><Plus className="w-4 h-4" /></button>
              </div>
              {selectedVariant && qty > 1 && (
                <p className="text-xs text-gray-500 mt-1">Total: {formatCurrency(displayPrice * qty, displayCurrency)}</p>
              )}
            </div>

            {/* Buttons */}
            {isAuthenticated ? (
              <div className="space-y-2">
                {isSubscription ? (
                  <p className="text-xs text-gray-400 text-center">Use the subscription plan above to subscribe.</p>
                ) : (
                  <>
                    <Button className="w-full h-12 gap-2 bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold text-sm"
                      onClick={handleAddToCart} disabled={addToCartPending || displayStock === 'out_of_stock'}>
                      {addToCartPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
                      {displayStock === 'out_of_stock' ? 'Out of Stock' : 'Add to Cart'}
                    </Button>
                    <Button className="w-full h-12 font-bold text-sm" onClick={handleBuyNow}
                      disabled={addToCartPending || displayStock === 'out_of_stock'}>Buy Now</Button>
                  </>
                )}
                {canQuote && (
                  <Button variant="outline" className="w-full h-11 font-bold rounded-xl mt-2" onClick={() => setShowQuote(true)}>
                    <MessageSquare className="w-5 h-5 mr-2" /> Request a Quote
                  </Button>
                )}
              </div>
            ) : (
              <Link to={storePath('/login')}>
                <Button className="w-full h-12 font-bold bg-amber-400 hover:bg-amber-500 text-slate-900">Sign in to Buy</Button>
              </Link>
            )}

            {/* Trust strip */}
            <div className="border-t pt-4 space-y-2.5">
              {[
                { icon: Truck, text: product.shipping_cost ? `Delivery: ${formatCurrency(product.shipping_cost)}` : 'Free Delivery' },
                { icon: RefreshCw, text: returnDays ? `${returnDays}-Day Returns` : isReturnable === false ? 'Non-returnable' : 'Easy Returns' },
                { icon: ShieldCheck, text: warrantyDays ? `${warrantyDays >= 365 ? `${Math.floor(warrantyDays / 365)}Y` : `${warrantyDays}D`} Warranty` : 'Secure Purchase' },
              ].map(b => (
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
