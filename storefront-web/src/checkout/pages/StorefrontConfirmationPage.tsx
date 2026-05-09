import { useParams, Link } from 'react-router-dom'
import { CheckCircle2, Mail, Package, MapPin } from 'lucide-react'
import { CheckoutHeader, CheckoutFooter } from '../components/Header'
import { CheckoutConfigProvider, formatMoney, useCheckoutConfig } from '../config'
import { LineItem } from '../components/LineItem'
import type { Order } from '../types'

interface Props {
  basePath: string
  storeName?: string
}

export default function StorefrontConfirmationPage({ basePath, storeName = 'Store' }: Props) {
  return (
    <CheckoutConfigProvider config={{ storeName }}>
      <Inner basePath={basePath} />
    </CheckoutConfigProvider>
  )
}

function Inner({ basePath }: { basePath: string }) {
  const { locale } = useCheckoutConfig()
  const { orderId } = useParams<{ orderId: string }>()

  const order: Order | null = (() => {
    try {
      const raw = sessionStorage.getItem(`sf_order_${orderId}`)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })()

  if (!order) {
    return (
      <div className="checkout-root min-h-screen">
        <CheckoutHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold mb-4">Order not found</h1>
          <Link to={basePath} className="ck-btn-primary no-underline" style={{ width: 'auto', padding: '12px 24px' }}>
            Return to store
          </Link>
        </main>
        <CheckoutFooter />
      </div>
    )
  }

  return (
    <div className="checkout-root min-h-screen">
      <CheckoutHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 md:px-6">
        <div
          className="ck-radius-lg mb-6 flex flex-col items-center px-6 py-10 text-center"
          style={{ background: 'hsl(var(--brand-primary) / 0.04)' }}
        >
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center"
            style={{ borderRadius: '999px', background: 'hsl(var(--success) / 0.15)', color: 'hsl(var(--success))' }}
          >
            <CheckCircle2 size={28} />
          </div>
          <h1 className="text-2xl font-semibold md:text-3xl">
            Thank you{order.customer.firstName ? `, ${order.customer.firstName}` : ''}!
          </h1>
          <p className="ck-text-muted mt-1 text-sm">
            Your order <span className="font-medium">{order.number}</span> has been placed.
          </p>
          <p className="ck-text-muted mt-1 text-sm">
            A confirmation email is on its way to {order.customer.email}.
          </p>
        </div>

        <div className="ck-surface ck-border ck-radius-md mb-4 p-4 md:p-6">
          <h2 className="mb-3 text-base font-semibold">What happens next</h2>
          <ul className="space-y-3">
            <NextStep icon={<Mail size={16} />} title="Order confirmation" body="You'll receive a confirmation email shortly." />
            <NextStep icon={<Package size={16} />} title="Packing & shipping" body="We'll notify you when your order ships." />
            <NextStep icon={<MapPin size={16} />} title="Delivery" body="Track your package any time from the order status page." />
          </ul>
        </div>

        {order.shippingAddress && (
          <div className="ck-surface ck-border ck-radius-md mb-4 p-4 md:p-6">
            <h2 className="mb-3 text-base font-semibold">Order details</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Block label="Shipping to">
                {order.shippingAddress.fullName}
                <br />
                {order.shippingAddress.line1}
                {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
                <br />
                {order.shippingAddress.city}, {order.shippingAddress.region} {order.shippingAddress.postalCode}
              </Block>
              <Block label="Payment">{order.paymentSummary.method}</Block>
              <Block label="Shipping method">{order.shippingMethod.label}</Block>
              <Block label="Total">{formatMoney(order.cart.total, locale)}</Block>
            </div>
          </div>
        )}

        <div className="ck-surface ck-border ck-radius-md mb-6 p-4 md:p-6">
          <h2 className="mb-2 text-base font-semibold">Items</h2>
          {order.cart.items.map((it, i) => (
            <div key={it.id} className={i > 0 ? 'ck-border-t' : ''}>
              <LineItem item={it} compact />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            to={basePath}
            className="ck-btn-secondary no-underline"
            style={{ textAlign: 'center' }}
          >
            Continue shopping
          </Link>
        </div>
      </main>
      <CheckoutFooter />
    </div>
  )
}

function NextStep({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center"
        style={{
          borderRadius: '999px',
          background: 'hsl(var(--surface-muted))',
          color: 'hsl(var(--text-muted))',
        }}
      >
        {icon}
      </span>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="ck-text-muted text-sm">{body}</div>
      </div>
    </li>
  )
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="ck-text-subtle mb-1 text-xs uppercase tracking-wide">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  )
}
