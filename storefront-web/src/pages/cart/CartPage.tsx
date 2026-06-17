import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, ChevronRight, ArrowLeft } from 'lucide-react'
import { LineItem } from '@/checkout/components/LineItem'
import { OrderSummary } from '@/checkout/components/OrderSummary'
import { CheckoutConfigProvider } from '@/checkout/config'
import { buildGuestCart, useCart, useUpdateCartItem, useRemoveCartItem, useStoreInfo } from '@/hooks/useStore'
import { useAuthStore } from '@/stores/authStore'
import { useGuestCartStore } from '@/stores/guestCartStore'
import { useCartStore } from '@/stores/cartStore'
import { useBranch } from '@/contexts/BranchContext'
import { useVendor } from '@/contexts/VendorContext'
import { useBuilderSiteCheckoutTheme } from '@/hooks/useBuilderSiteCheckoutTheme'
import { TableSkeleton } from '@/kit/states/StateScreens'

export default function CartPage() {
  const { storePath } = useBranch()
  const { vendorSlug } = useVendor()
  const { isAuthenticated } = useAuthStore()
  const { data: storeInfo } = useStoreInfo()
  const { data: serverCart, isLoading } = useCart()
  const guestItems = useGuestCartStore((s) => s.byVendor[vendorSlug] ?? [])
  const cartFromStore = useCartStore((s) => s.cart)
  const updateItem = useUpdateCartItem()
  const removeItem = useRemoveCartItem()
  const checkoutTheme = useBuilderSiteCheckoutTheme()

  const guestCart = useMemo(() => buildGuestCart(guestItems), [guestItems])
  const cart = isAuthenticated ? (cartFromStore ?? serverCart) : guestCart

  const storeName = storeInfo?.display_name ?? storeInfo?.business_name ?? 'Store'
  const currency = 'INR'

  const cartItems = ((cart?.items ?? []) as any[]).map((item: Record<string, unknown>, i: number) => ({
    id: String(i),
    productId: String(item.product_id ?? i),
    variantId: String(item.variant_id ?? i),
    name: String(item.name ?? ''),
    variantLabel: item.variant_label ? String(item.variant_label) : undefined,
    imageUrl: item.image_url ? String(item.image_url) : undefined,
    unitPrice: { amount: Math.round(Number(item.price) * 100), currency },
    quantity: Number(item.qty),
    inStock: true,
  }))

  const subtotalAmount = Math.round(
    ((cart?.items ?? []) as any[]).reduce((s: number, i: any) => s + i.price * i.qty, 0) * 100
  )
  const taxAmount = Math.round(subtotalAmount * 0.18)
  const discountAmount = Math.round(Number(cart?.discount_amount ?? 0) * 100)

  const checkoutCart = {
    id: 'store_cart',
    items: cartItems,
    subtotal: { amount: subtotalAmount, currency },
    shipping: { amount: 0, currency },
    discounts: discountAmount > 0
      ? [{ code: 'DISCOUNT', label: 'Discount', amount: { amount: discountAmount, currency } }]
      : [],
    taxes: [{ label: 'GST (18%)', amount: { amount: taxAmount, currency } }],
    total: { amount: subtotalAmount + taxAmount - discountAmount, currency },
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
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
          <div className="mb-5 flex items-center gap-2 text-sm">
            <Link to={storePath('/')} className="ck-btn-ghost flex items-center gap-1 p-0">
              <ArrowLeft size={14} /> Continue shopping
            </Link>
            <span className="ck-text-subtle">·</span>
            <Link to={storePath('/products')} className="ck-btn-ghost p-0">Products</Link>
          </div>

          <h1 className="mb-6 text-2xl font-semibold md:text-3xl">
            Your cart
            {!empty && (
              <span className="ml-2 text-base font-normal" style={{ color: 'hsl(var(--text-muted))' }}>
                ({cartItems.reduce((s, i) => s + i.quantity, 0)} items)
              </span>
            )}
          </h1>

          {empty ? (
            <EmptyState storePath={storePath} />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
              <div className="ck-surface ck-border ck-radius-md p-2 md:p-4">
                {cartItems.map((item, i) => (
                  <div key={`${item.productId}-${i}`} className={i > 0 ? 'ck-border-t' : ''}>
                    <LineItem
                      item={item}
                      editable
                      onUpdateQuantity={(id, q) => {
                        const index = Number(id)
                        if (q <= 0) removeItem.mutate(index)
                        else updateItem.mutate({ index, qty: q })
                      }}
                      onRemove={(id) => removeItem.mutate(Number(id))}
                    />
                  </div>
                ))}
                <div className="ck-border-t mt-2 flex items-center justify-between p-4">
                  <Link to={storePath('/products')} className="ck-btn-ghost flex items-center gap-1">
                    <ArrowLeft size={14} /> Continue shopping
                  </Link>
                </div>
              </div>

              <div>
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
              </div>
            </div>
          )}
        </main>
      </div>
    </CheckoutConfigProvider>
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
      <div className="mt-6 flex gap-3">
        <Link
          to={storePath('/products')}
          className="ck-btn-primary no-underline"
          style={{ width: 'auto', padding: '12px 24px' }}
        >
          Browse products
        </Link>
        <Link
          to={storePath('/services')}
          className="ck-btn-secondary no-underline"
          style={{ textAlign: 'center', padding: '12px 24px' }}
        >
          View services
        </Link>
      </div>
    </div>
  )
}
