import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { publicAsset } from '@/lib/publicAsset'
import { cn } from '@/lib/utils'

import amazonPaymentServices from '../../assets/integration-logos/amazon_payment_services.png?url'
import googleCalendar from '../../assets/integration-logos/google_calendar.png?url'
import metaWhatsapp from '../../assets/integration-logos/meta_whatsapp.png?url'
import openai from '../../assets/integration-logos/openai.png?url'
import outlookCalendar from '../../assets/integration-logos/outlook_calendar.png?url'
import paypal from '../../assets/integration-logos/paypal.png?url'
import payu from '../../assets/integration-logos/payu.png?url'
import razorpay from '../../assets/integration-logos/razorpay.png?url'
import sendgrid from '../../assets/integration-logos/sendgrid.png?url'
import smtp from '../../assets/integration-logos/smtp.png?url'
import square from '../../assets/integration-logos/square.png?url'
import stripe from '../../assets/integration-logos/stripe.png?url'
import twilio from '../../assets/integration-logos/twilio.png?url'

/** Bundled at build time — hashed URLs in dist/assets, reliable in production. */
const INTEGRATION_LOGO_BUNDLED: Record<string, string> = {
  sendgrid,
  smtp,
  twilio,
  meta_whatsapp: metaWhatsapp,
  openai,
  google_calendar: googleCalendar,
  outlook_calendar: outlookCalendar,
  razorpay,
  stripe,
  square,
  paypal,
  payu,
  amazon_payment_services: amazonPaymentServices,
}

/** public/ fallback when CDN or base-path serving differs from the bundle. */
const INTEGRATION_LOGO_PUBLIC: Record<string, string> = {
  sendgrid: publicAsset('integration-logos/sendgrid.png'),
  smtp: publicAsset('integration-logos/smtp.png'),
  twilio: publicAsset('integration-logos/twilio.png'),
  meta_whatsapp: publicAsset('integration-logos/meta_whatsapp.png'),
  openai: publicAsset('integration-logos/openai.png'),
  google_calendar: publicAsset('integration-logos/google_calendar.png'),
  outlook_calendar: publicAsset('integration-logos/outlook_calendar.png'),
  razorpay: publicAsset('integration-logos/razorpay.png'),
  stripe: publicAsset('integration-logos/stripe.png'),
  square: publicAsset('integration-logos/square.png'),
  paypal: publicAsset('integration-logos/paypal.png'),
  payu: publicAsset('integration-logos/payu.png'),
  amazon_payment_services: publicAsset('integration-logos/amazon_payment_services.png'),
}

/** @deprecated use integrationLogoSources */
export const INTEGRATION_LOGO_PNG = INTEGRATION_LOGO_PUBLIC

export function integrationLogoPath(providerId: string): string | null {
  return INTEGRATION_LOGO_BUNDLED[providerId] ?? INTEGRATION_LOGO_PUBLIC[providerId] ?? null
}

/** Primary (bundled) + optional public/ URL for production resilience. */
export function integrationLogoSources(providerId: string): string[] {
  const bundled = INTEGRATION_LOGO_BUNDLED[providerId]
  const pub = INTEGRATION_LOGO_PUBLIC[providerId]
  const sources: string[] = []
  if (bundled) sources.push(bundled)
  if (pub && pub !== bundled) sources.push(pub)
  return sources
}

/**
 * Integration icon/wordmark with automatic URL fallback and optional SVG/node fallback.
 * Tries bundled asset first, then public/ path, then renders `fallback`.
 */
export function IntegrationIconImage({
  providerId,
  src,
  fallback,
  className,
  alt = '',
}: {
  providerId?: string
  src?: string | null
  fallback?: ReactNode
  className?: string
  alt?: string
}) {
  const candidates = useMemo(() => {
    if (providerId) return integrationLogoSources(providerId)
    if (src) return [src]
    return []
  }, [providerId, src])

  const [index, setIndex] = useState(0)

  if (index >= candidates.length) {
    return fallback ? <>{fallback}</> : null
  }

  return (
    <img
      src={candidates[index]}
      alt={alt}
      className={className}
      draggable={false}
      onError={() => setIndex(i => i + 1)}
    />
  )
}

export function IntegrationLogoImage({
  providerId,
  alt,
  className,
  fallback,
}: {
  providerId: string
  alt: string
  className?: string
  fallback?: ReactNode
}) {
  return (
    <IntegrationIconImage
      providerId={providerId}
      alt={alt}
      fallback={fallback}
      className={cn('h-4 w-auto max-w-[130px] object-contain object-left', className)}
    />
  )
}
