import { cn } from '@/lib/utils'
import { IntegrationLogoImage } from './integrationLogos'

export type PaymentProviderId = 'razorpay' | 'stripe' | 'square' | 'paypal' | 'payu'

type ProviderBanner = {
  className: string
  label: string
}

const BANNERS: Record<PaymentProviderId, ProviderBanner> = {
  razorpay: { className: 'bg-[#072654]', label: 'Razorpay' },
  stripe: { className: 'bg-[#635BFF]', label: 'Stripe' },
  square: { className: 'bg-[#000000]', label: 'Square' },
  paypal: { className: 'bg-[#003087]', label: 'PayPal' },
  payu: { className: 'bg-[#00843D]', label: 'PayU' },
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
  const brand = BANNERS[provider as PaymentProviderId]
  if (!brand) {
    return (
      <div className={cn('relative flex h-8 items-center justify-center bg-muted px-2', className)}>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{provider}</span>
        {isLive && <PaymentLiveHeaderBadge />}
      </div>
    )
  }

  return (
    <div className={cn('relative flex h-8 w-full items-center justify-start px-3', brand.className, className)}>
      <IntegrationLogoImage providerId={provider} alt={brand.label} />
      {isLive ? <PaymentLiveHeaderBadge /> : null}
    </div>
  )
}

function PaymentLiveHeaderBadge() {
  return (
    <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2 py-0.5 backdrop-blur-sm">
      <span
        className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.85)]"
        aria-hidden
      />
      <span className="text-[10px] font-semibold tracking-wide text-white">Live</span>
    </div>
  )
}

export function paymentProviderLabel(provider: string): string {
  const labels: Record<PaymentProviderId, string> = {
    razorpay: 'Razorpay',
    stripe: 'Stripe',
    square: 'Square',
    paypal: 'PayPal',
    payu: 'PayU',
  }
  return labels[provider as PaymentProviderId] ?? provider
}

export function paymentProviderMeta(provider: string): {
  label: string
  regionTags: string[]
  summary: string
} {
  const meta: Record<PaymentProviderId, { regionTags: string[]; summary: string }> = {
    razorpay: {
      regionTags: ['India'],
      summary: 'UPI, cards, netbanking and wallets',
    },
    stripe: {
      regionTags: ['US', 'UK', 'EU', 'AU', 'SG', 'IN'],
      summary: 'Cards, wallets and global payment methods',
    },
    square: {
      regionTags: ['US', 'CA', 'UK', 'AU', 'JP', 'FR', 'ES'],
      summary: 'Online checkout and in-person payments',
    },
    paypal: {
      regionTags: ['US', 'UK', 'EU', 'AU', 'IN'],
      summary: 'PayPal balance, cards and buyer protection',
    },
    payu: {
      regionTags: ['India', 'LATAM', 'CEEMEA'],
      summary: 'Cards, UPI and netbanking',
    },
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
  const colors: Record<PaymentProviderId, string> = {
    razorpay: '#072654',
    stripe: '#635BFF',
    square: '#000000',
    paypal: '#003087',
    payu: '#00843D',
  }
  return colors[provider as PaymentProviderId] ?? '#64748b'
}
