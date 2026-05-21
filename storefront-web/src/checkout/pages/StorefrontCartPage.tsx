import { Link } from 'react-router-dom'
import { ShoppingBag, ChevronRight, ArrowLeft } from 'lucide-react'
import { CheckoutHeader, CheckoutFooter } from '../components/Header'
import { LineItem } from '../components/LineItem'
import { OrderSummary } from '../components/OrderSummary'
import { CheckoutConfigProvider } from '../config'
import { useStorefront } from '@/storefront/StorefrontContext'

interface Props {
  /** Base path for the enclosing storefront (e.g. /template-browser/storefront_fashion) */
  basePath: string
  storeName?: string
}

export default function StorefrontCartPage({ basePath, storeName = 'Store' }: Props) {
  const { cart, updateLine, removeLine } = useStorefront()
  const empty = !cart || cart.lines.length === 0

  // Bridge business front CartLine → checkout CartItem
  const cartItems = (cart?.lines ?? []).map((l) => ({
    id: l.id,
    productId: l.productId,
    variantId: l.variantId,
    name: l.name,
    variantLabel: l.variantLabel,
    imageUrl: l.imageUrl,
    unitPrice: l.unitPrice,
    quantity: l.quantity,
    inStock: l.inStock ?? true,
    maxQuantity: l.maxQuantity ?? 99,
  }))

  const currency = cart?.subtotal.currency ?? 'USD'
  const subtotalAmount = cart?.subtotal.amount ?? 0
  const taxAmount = Math.round(subtotalAmount * 0.08875)
  const total = subtotalAmount + 499 + taxAmount // include standard shipping estimate

  const checkoutCart = {
    id: cart?.id ?? '',
    items: cartItems,
    subtotal: { amount: subtotalAmount, currency },
    shipping: { amount: 499, currency },
    discounts: [],
    taxes: [{ label: 'Sales tax (8.875%)', amount: { amount: taxAmount, currency } }],
    total: { amount: total, currency },
  }

  return (
    <CheckoutConfigProvider config={{ storeName }}>
      <div className="checkout-root min-h-screen">
        <CheckoutHeader />
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
          <div className="mb-6 flex items-center gap-3">
            <Link to={basePath} className="ck-btn-ghost flex items-center gap-1 p-0">
              <ArrowLeft size={16} /> Back to store
            </Link>
          </div>

          <h1 className="mb-6 text-2xl font-semibold md:text-3xl">Your cart</h1>

          {empty ? (
            <EmptyState basePath={basePath} />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
              <div className="ck-surface ck-border ck-radius-md p-2 md:p-4">
                {cartItems.map((item, i) => (
                  <div key={item.id} className={i > 0 ? 'ck-border-t' : ''}>
                    <LineItem
                      item={item}
                      editable
                      onUpdateQuantity={(id, q) => {
                        if (q <= 0) removeLine(id)
                        else updateLine(id, q)
                      }}
                      onRemove={(id) => removeLine(id)}
                    />
                  </div>
                ))}
                <div className="ck-border-t mt-2 flex items-center justify-between p-4">
                  <Link to={basePath} className="ck-btn-ghost flex items-center gap-1">
                    <ArrowLeft size={14} /> Continue shopping
                  </Link>
                </div>
              </div>

              <div>
                <OrderSummary
                  cart={checkoutCart}
                  showItems={false}
                />
                <Link
                  to={`${basePath}/checkout`}
                  className="ck-btn-primary mt-3 flex items-center justify-center gap-2 no-underline"
                >
                  Checkout <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          )}
        </main>
        <CheckoutFooter />
      </div>
    </CheckoutConfigProvider>
  )
}

function EmptyState({ basePath }: { basePath: string }) {
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
        Looks like you haven&apos;t added anything yet. Find something you like and come back.
      </p>
      <Link
        to={basePath}
        className="ck-btn-primary mt-6 no-underline"
        style={{ width: 'auto', padding: '12px 24px' }}
      >
        Browse products
      </Link>
    </div>
  )
}
