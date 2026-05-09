import { useSearchParams } from 'react-router-dom'
import { CheckoutHeader, CheckoutFooter } from '../components/Header'
import { CheckoutConfigProvider, CheckoutLayout, PaymentMode, useCheckoutConfig } from '../config'
import { TwoColumnLayout } from '../layouts/TwoColumnLayout'
import { WizardLayout } from '../layouts/WizardLayout'
import { AccordionLayout } from '../layouts/AccordionLayout'
import { useStorefrontCheckout } from '../hooks/useStorefrontCheckout'

interface Props {
  basePath: string
  storeName?: string
}

export default function StorefrontCheckoutPage({ basePath, storeName = 'Store' }: Props) {
  const [params] = useSearchParams()
  const layout = (params.get('layout') as CheckoutLayout) || undefined
  const paymentMode = (params.get('payment') as PaymentMode) || undefined

  return (
    <CheckoutConfigProvider
      config={{
        storeName,
        ...(layout && { layout }),
        ...(paymentMode && { paymentMode }),
      }}
    >
      <Inner basePath={basePath} />
    </CheckoutConfigProvider>
  )
}

function Inner({ basePath }: { basePath: string }) {
  const { layout } = useCheckoutConfig()
  const checkout = useStorefrontCheckout(`${basePath}/order`)

  return (
    <div className="checkout-root min-h-screen">
      <CheckoutHeader rightSlot={<LayoutSwitcher />} />
      {layout === 'wizard' && <WizardLayout {...checkout} />}
      {layout === 'accordion' && <AccordionLayout {...checkout} />}
      {(!layout || layout === 'two-column') && <TwoColumnLayout {...checkout} />}
      <CheckoutFooter />
    </div>
  )
}

function LayoutSwitcher() {
  const { layout } = useCheckoutConfig()
  const opts: { id: CheckoutLayout; label: string }[] = [
    { id: 'two-column', label: 'Two-column' },
    { id: 'wizard', label: 'Wizard' },
    { id: 'accordion', label: 'Accordion' },
  ]
  return (
    <div className="hidden gap-1 sm:flex" role="tablist" aria-label="Layout">
      {opts.map((o) => (
        <a
          key={o.id}
          href={`?layout=${o.id}`}
          className="ck-btn-ghost no-underline"
          style={{
            background: layout === o.id ? 'hsl(var(--surface-muted))' : 'transparent',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
          }}
        >
          {o.label}
        </a>
      ))}
    </div>
  )
}
