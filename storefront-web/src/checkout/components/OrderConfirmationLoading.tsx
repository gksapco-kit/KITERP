import { Loader2 } from 'lucide-react'
import { CheckoutHeader, CheckoutFooter } from './Header'

type Props = {
  theme?: React.CSSProperties
  message?: string
}

/** Shown on the confirmation route while order details are fetched. */
export function OrderConfirmationLoading({
  theme,
  message = 'Loading your order confirmation…',
}: Props) {
  return (
    <div className="checkout-root min-h-screen" style={theme}>
      <CheckoutHeader />
      <main className="mx-auto flex max-w-3xl flex-col items-center justify-center px-4 py-24 text-center">
        <div
          className="ck-radius-lg mb-6 flex w-full max-w-md flex-col items-center px-6 py-12"
          style={{ background: 'hsl(var(--brand-primary) / 0.04)' }}
        >
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-[hsl(var(--brand-primary))]" aria-hidden />
          <p className="text-base font-medium">{message}</p>
          <p className="ck-text-muted mt-2 text-sm">This usually takes a few seconds.</p>
        </div>
      </main>
      <CheckoutFooter />
    </div>
  )
}
