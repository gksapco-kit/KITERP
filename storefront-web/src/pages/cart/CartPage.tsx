import { Link } from 'react-router-dom'
import { ShoppingBag, ChevronRight, ArrowLeft, Package } from 'lucide-react'
import { OrderSummary } from '@/checkout/components/OrderSummary'
import { CheckoutConfigProvider } from '@/checkout/config'
import {
  useCart,
  useUpdateCartItem,
  useRemoveCartItem,
  useStoreInfo,
  useCartProducts,
  useChangeCartVariant,
} from '@/hooks/useStore'
import { useAuthStore } from '@/stores/authStore'
import { useBranch } from '@/contexts/BranchContext'
import { useVendor } from '@/contexts/VendorContext'
import { useBuilderSiteCheckoutTheme } from '@/hooks/useBuilderSiteCheckoutTheme'
import {
  computeCartTaxAmount,
  resolveDeliveryCharge,
} from '@/lib/deliveryConditions'
import { TableSkeleton } from '@/kit/states/StateScreens'
import { CartDetailLineItem } from './CartDetailLineItem'
import type { ProductVariant } from '@/types'
import { variantDisplayLabel } from '@/lib/variantOptions'
import { maxCartLineQty, validateCartLineQtyChange } from '@/lib/cartLineStock'
import { toast } from 'sonner'

export default function CartPage() {
  const { storePath } = useBranch()
  const { vendorSlug, vendor } = useVendor()
  const { isAuthenticated } = useAuthStore()
  const { data: storeInfo } = useStoreInfo()
  const { data: cart, isLoading } = useCart()
  const updateItem = useUpdateCartItem()
  const removeItem = useRemoveCartItem()
  const changeVariant = useChangeCartVariant()
  const checkoutTheme = useBuilderSiteCheckoutTheme()

  const rawItems = (cart?.items ?? []) as Array<Record<string, unknown>>
  const { data: productMap = {} } = useCartProducts(
    rawItems.map((i) => ({
      product_id: String(i.product_id ?? ''),
      slug: i.slug ? String(i.slug) : undefined,
    })),
  )

  const storeName = storeInfo?.display_name ?? storeInfo?.business_name ?? 'Store'
  const currency = 'INR'

  const cartItems = rawItems.map((item: Record<string, unknown>, i: number) => {
    const variantLabel = item.variant_label
      ? String(item.variant_label)
      : undefined
    const productId = String(item.product_id ?? i)
    const variantId = item.variant_id ? String(item.variant_id) : undefined
    return {
      id: String(i),
      productId,
      variantId: variantId ?? undefined,
      name: String(item.name ?? ''),
      variantLabel,
      imageUrl: item.image_url ? String(item.image_url) : undefined,
      unitPrice: { amount: Math.round(Number(item.price) * 100), currency },
      quantity: Number(item.qty),
      inStock: true,
    }
  })

  const subtotalAmount = Math.round(
    ((cart?.items ?? []) as any[]).reduce((s: number, i: any) => s + i.price * i.qty, 0) * 100
  )
  const subtotalRupees = subtotalAmount / 100
  const vendorSettings = (vendor?.settings ?? {}) as Record<string, unknown>
  const { shippingAmount: shippingRupees } = resolveDeliveryCharge(vendorSettings, subtotalRupees)
  const shippingAmount = Math.round(shippingRupees * 100)
  const { taxAmount: taxRupees, taxLabel } = computeCartTaxAmount(
    (cart?.items ?? []) as Array<{ product_id?: string; price: number; qty: number }>,
    productMap,
    vendorSettings,
    vendor?.is_gst_registered,
    vendor?.default_tax_rate,
  )
  const taxAmount = Math.round(taxRupees * 100)
  const discountAmount = Math.round(Number(cart?.discount_amount ?? 0) * 100)

  const checkoutCart = {
    id: 'store_cart',
    items: cartItems,
    subtotal: { amount: subtotalAmount, currency },
    shipping: { amount: shippingAmount, currency },
    discounts: discountAmount > 0
      ? [{ code: 'DISCOUNT', label: 'Discount', amount: { amount: discountAmount, currency } }]
      : [],
    taxes: taxLabel
      ? [{ label: taxLabel, amount: { amount: taxAmount, currency } }]
      : [],
    total: { amount: subtotalAmount + shippingAmount + taxAmount - discountAmount, currency },
  }

  const empty = !cartItems.length

  if (isLoading && isAuthenticated) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <TableSkeleton rows={4} />
      </div>
    )
  }

  return (
    <CheckoutConfigProvider config={{ storeName, showCoupon: true, showTrustBadges: true }}>
      <div className="checkout-root" style={checkoutTheme}>
        <main className="mx-auto max-w-6xl px-3 py-6 sm:px-4 md:px-6 md:py-8">
          <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-4">
            <h1 className="text-xl font-semibold sm:text-2xl md:text-3xl">Your Cart</h1>
            {!empty && (
              <CartItemsBadge count={cartItems.reduce((s, i) => s + i.quantity, 0)} />
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <Link to={storePath('/')} className="ck-btn-ghost flex items-center gap-1 p-0">
                <ArrowLeft size={14} /> Continue shopping
              </Link>
              <span className="ck-text-subtle hidden sm:inline">·</span>
              <Link to={storePath('/products')} className="ck-btn-ghost p-0">Products</Link>
            </div>
          </div>

          {empty ? (
            <EmptyState storePath={storePath} />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
              <div className="ck-surface ck-border ck-radius-md p-2 sm:p-3 md:p-4">
                {cartItems.map((item, i) => {
                  const lineMaxQty = maxCartLineQty({
                    vendorSlug,
                    isAuthenticated,
                    product: productMap[item.productId],
                    line: item,
                  })
                  return (
                  <div key={`${item.productId}-${i}`} className={i > 0 ? 'ck-border-t' : ''}>
                    <CartDetailLineItem
                      item={item}
                      product={productMap[item.productId]}
                      editable
                      variantChangePending={changeVariant.isPending}
                      maxQuantity={lineMaxQty}
                      onUpdateQuantity={(id, q) => {
                        const index = Number(id)
                        if (Number.isNaN(index)) return
                        if (q <= 0) {
                          removeItem.mutate({
                            productId: item.productId,
                            variantId: item.variantId,
                          })
                          return
                        }
                        const stockCheck = validateCartLineQtyChange({
                          vendorSlug,
                          isAuthenticated,
                          product: productMap[item.productId],
                          line: item,
                          newQty: q,
                        })
                        if (!stockCheck.ok) {
                          toast.error(stockCheck.message)
                          return
                        }
                        updateItem.mutate({ index, qty: q })
                      }}
                      onRemove={() => {
                        removeItem.mutate({
                          productId: item.productId,
                          variantId: item.variantId,
                        })
                      }}
                      onVariantChange={(variant: ProductVariant) => {
                        const raw = rawItems[i]
                        const rawVariantId = raw?.variant_id ? String(raw.variant_id) : undefined
                        if (rawVariantId && variant.id === rawVariantId) return
                        changeVariant.mutate({
                          index: i,
                          item: {
                            product_id: item.productId,
                            variant_id: variant.id,
                            variant_label: variantDisplayLabel(variant) || variant.name,
                            slug: raw?.slug ? String(raw.slug) : productMap[item.productId]?.slug,
                            name: String(raw?.name ?? item.name).split(' - ')[0] || item.name,
                            qty: item.quantity,
                            price: variant.price,
                            image_url:
                              variant.media?.find((m) => m.is_primary)?.url ??
                              variant.media?.[0]?.url ??
                              item.imageUrl,
                          },
                        })
                      }}
                    />
                  </div>
                  )
                })}
                <div className="ck-border-t mt-2 flex items-center justify-between p-4">
                  <Link to={storePath('/products')} className="ck-btn-ghost flex items-center gap-1">
                    <ArrowLeft size={14} /> Continue shopping
                  </Link>
                </div>
              </div>

              <aside className="min-w-0 lg:sticky lg:top-24 lg:z-10 lg:self-start">
                <OrderSummary
                  cart={checkoutCart}
                  showItems={false}
                  showCouponInput={false}
                />
                <Link
                  to={storePath('/checkout')}
                  className="ck-btn-primary mt-3 flex items-center justify-center gap-2 no-underline"
                >
                  Proceed to checkout <ChevronRight size={16} />
                </Link>
              </aside>
            </div>
          )}
        </main>
      </div>
    </CheckoutConfigProvider>
  )
}

function CartItemsBadge({ count }: { count: number }) {
  const label = count === 1 ? 'item in cart' : 'items in cart'
  return (
    <div
      className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5"
      style={{
        borderColor: 'hsl(var(--border))',
        background: 'hsl(var(--surface-muted))',
      }}
      aria-label={`${count} ${label}`}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: 'hsl(var(--brand-primary) / 0.12)',
          color: 'hsl(var(--brand-primary))',
        }}
      >
        <Package className="h-4 w-4" aria-hidden />
      </div>
      <div className="text-left">
        <span className="block text-lg font-bold leading-none tabular-nums">{count}</span>
        <span className="mt-0.5 block text-[11px] font-medium capitalize leading-none ck-text-muted">
          {label}
        </span>
      </div>
    </div>
  )
}

function EmptyState({ storePath }: { storePath: (path: string) => string }) {
  return (
    <div className="ck-surface ck-border ck-radius-md flex flex-col items-center justify-center px-6 py-16 text-center">
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center"
        style={{ borderRadius: '999px', background: 'hsl(var(--surface-muted))' }}
      >
        <ShoppingBag size={24} className="ck-text-muted" />
      </div>
      <h2 className="text-xl font-semibold">Your cart is empty</h2>
      <p className="ck-text-muted mt-1 max-w-md text-sm">
        Looks like you haven't added anything yet. Browse our products and services.
      </p>
      <div className="mt-6 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <Link
          to={storePath('/products')}
          className="ck-btn-primary no-underline w-full text-center sm:w-auto"
          style={{ padding: '12px 24px' }}
        >
          Browse products
        </Link>
        <Link
          to={storePath('/services')}
          className="ck-btn-secondary no-underline w-full text-center sm:w-auto"
          style={{ padding: '12px 24px' }}
        >
          View services
        </Link>
      </div>
    </div>
  )
}
