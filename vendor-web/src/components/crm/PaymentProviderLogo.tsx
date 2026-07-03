import { cn } from '@/lib/utils'
import {
  INTEGRATION_PROVIDER_BRAND_LOCKUP_AMAZON_CLASS,
  INTEGRATION_PROVIDER_BRAND_LOCKUP_CLASS,
  INTEGRATION_PROVIDER_ICON_INNER_CLASS,
  PAYMENT_PROVIDER_AMAZON_ICON_INNER_CLASS,
  PAYMENT_PROVIDER_AMAZON_IMG_CLASS,
  PAYMENT_PROVIDER_ICON_SLOT_AMAZON_CLASS,
  PAYMENT_PROVIDER_ICON_SLOT_CLASS,
} from './IntegrationCardShared'
import { IntegrationIconImage } from './integrationLogos'
import type { PaymentProviderId } from './paymentProvidersCatalog'
import { PAYMENT_PROVIDER_ACCENTS, PAYMENT_PROVIDER_BRAND_SVGS } from './paymentProviderBrandSvgs'

export type { PaymentProviderId }

/** Icon-only mark sized for inline payment provider rows. */
export function PaymentProviderIcon({
  providerId,
  className,
}: {
  providerId: PaymentProviderId
  className?: string
}) {
  const isAmazon = providerId === 'amazon_payment_services'

  return (
    <div className={cn(isAmazon ? PAYMENT_PROVIDER_ICON_SLOT_AMAZON_CLASS : PAYMENT_PROVIDER_ICON_SLOT_CLASS, className)} aria-hidden>
      <div className={isAmazon ? PAYMENT_PROVIDER_AMAZON_ICON_INNER_CLASS : INTEGRATION_PROVIDER_ICON_INNER_CLASS}>
        {isAmazon ? (
          <IntegrationIconImage
            providerId="amazon_payment_services"
            fallback={PAYMENT_PROVIDER_BRAND_SVGS[providerId]}
            className={PAYMENT_PROVIDER_AMAZON_IMG_CLASS}
          />
        ) : (
          PAYMENT_PROVIDER_BRAND_SVGS[providerId]
        )}
      </div>
    </div>
  )
}

/** Odoo-style inline lockup: icon + provider name. */
export function PaymentProviderBrandLockup({
  providerId,
  className,
  hideIcon = false,
}: {
  providerId: PaymentProviderId
  className?: string
  /** When true, only the label is shown (icon rendered elsewhere, e.g. card-centered). */
  hideIcon?: boolean
}) {
  const label = paymentProviderLabel(providerId)
  const isAmazon = providerId === 'amazon_payment_services'

  return (
    <div
      className={cn(
        isAmazon && hideIcon
          ? 'flex shrink-0 items-center pl-12'
          : isAmazon
            ? INTEGRATION_PROVIDER_BRAND_LOCKUP_AMAZON_CLASS
            : INTEGRATION_PROVIDER_BRAND_LOCKUP_CLASS,
        className,
      )}
    >
      {!hideIcon ? <PaymentProviderIcon providerId={providerId} /> : null}
      <span
        className={cn(
          'whitespace-nowrap text-sm text-foreground',
          isAmazon ? 'font-medium leading-none text-[#131921]' : 'font-semibold leading-none',
        )}
      >
        {label}
      </span>
    </div>
  )
}

/** @deprecated use PaymentProviderBrandLockup */
export function PaymentProviderLogoTile({
  providerId,
  className,
}: {
  providerId: PaymentProviderId
  className?: string
}) {
  return <PaymentProviderBrandLockup providerId={providerId} className={className} />
}

export function PaymentProviderBanner({
  provider,
  className,
  isLive,
}: {
  provider: string
  className?: string
  isLive?: boolean
}) {
  const id = provider as PaymentProviderId
  const accent = PAYMENT_PROVIDER_ACCENTS[id]
  if (!accent) {
    return (
      <div className={cn('relative flex h-8 items-center justify-center bg-muted px-2', className)}>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{provider}</span>
        {isLive && <PaymentLiveHeaderBadge />}
      </div>
    )
  }

  return (
    <div
      className={cn('relative flex h-8 w-full items-center justify-start gap-2 px-3', className)}
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <PaymentProviderIcon providerId={id} className="h-6 w-6" />
      <span className="text-sm font-semibold text-foreground">{paymentProviderLabel(id)}</span>
      {isLive ? <PaymentLiveHeaderBadge /> : null}
    </div>
  )
}

function PaymentLiveHeaderBadge() {
  return (
    <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5 rounded-full border border-border/60 bg-muted/80 px-2 py-0.5">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
      <span className="text-[10px] font-semibold tracking-wide text-foreground">Live</span>
    </div>
  )
}

const PAYMENT_PROVIDER_LABELS: Record<PaymentProviderId, string> = {
  razorpay: 'Razorpay',
  stripe: 'Stripe',
  square: 'Square',
  paypal: 'PayPal',
  payu: 'PayU',
  sepa_direct_debit: 'SEPA Direct Debit',
  wire_transfer: 'Wire Transfer',
  demo: 'Demo',
  adyen: 'Adyen',
  amazon_payment_services: 'Amazon Payment Services',
  asiapay: 'Asiapay',
  authorize_net: 'Authorize.net',
  buckaroo: 'Buckaroo',
  flutterwave: 'Flutterwave',
  mercado_pago: 'Mercado Pago',
  mollie: 'Mollie',
  sips: 'Sips',
}

export function paymentProviderLabel(provider: string): string {
  return PAYMENT_PROVIDER_LABELS[provider as PaymentProviderId] ?? provider
}

export function paymentProviderMeta(provider: string): {
  label: string
  regionTags: string[]
  summary: string
} {
  const meta: Partial<Record<PaymentProviderId, { regionTags: string[]; summary: string }>> = {
    razorpay: { regionTags: ['India'], summary: 'UPI, cards, netbanking and wallets' },
    stripe: { regionTags: ['US', 'UK', 'EU', 'AU', 'SG', 'IN'], summary: 'Cards, wallets and global payment methods' },
    square: { regionTags: ['US', 'CA', 'UK', 'AU', 'JP', 'FR', 'ES'], summary: 'Online checkout and in-person payments' },
    paypal: { regionTags: ['US', 'UK', 'EU', 'AU', 'IN'], summary: 'PayPal balance, cards and buyer protection' },
    payu: { regionTags: ['India', 'LATAM', 'CEEMEA'], summary: 'Cards, UPI and netbanking' },
    sepa_direct_debit: { regionTags: ['EU'], summary: 'SEPA direct debit bank payments' },
    wire_transfer: { regionTags: ['Global'], summary: 'Manual bank transfer instructions at checkout' },
    demo: { regionTags: ['Global'], summary: 'Sandbox demo gateway for testing checkout' },
    adyen: { regionTags: ['Global', 'EU', 'US'], summary: 'Unified commerce payments platform' },
    amazon_payment_services: { regionTags: ['MENA'], summary: 'Cards and local methods in the Middle East' },
    asiapay: { regionTags: ['APAC'], summary: 'Regional cards and wallets across Asia' },
    authorize_net: { regionTags: ['US', 'CA'], summary: 'Card payments for North America' },
    buckaroo: { regionTags: ['EU', 'NL'], summary: 'Dutch and European payment methods' },
    flutterwave: { regionTags: ['Africa'], summary: 'Cards, mobile money and local rails' },
    mercado_pago: { regionTags: ['LATAM'], summary: 'Latin America wallets and installments' },
    mollie: { regionTags: ['EU', 'NL'], summary: 'European cards, iDEAL and wallets' },
    sips: { regionTags: ['EU', 'FR'], summary: 'Worldline Sips card acquiring' },
  }
  const id = provider as PaymentProviderId
  const entry = meta[id]
  return {
    label: paymentProviderLabel(provider),
    regionTags: entry?.regionTags ?? ['Global'],
    summary: entry?.summary ?? 'Online payments',
  }
}

export function paymentProviderBrandColor(provider: string): string {
  return PAYMENT_PROVIDER_ACCENTS[provider as PaymentProviderId] ?? '#64748b'
}
