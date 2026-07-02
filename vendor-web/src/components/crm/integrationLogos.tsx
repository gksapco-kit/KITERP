import { cn } from '@/lib/utils'

const LOGO_BASE = '/integration-logos'

/** PNG wordmark paths for integration card headers */
export const INTEGRATION_LOGO_PNG: Record<string, string> = {
  sendgrid: `${LOGO_BASE}/sendgrid.png`,
  smtp: `${LOGO_BASE}/smtp.png`,
  twilio: `${LOGO_BASE}/twilio.png`,
  meta_whatsapp: `${LOGO_BASE}/meta_whatsapp.png`,
  openai: `${LOGO_BASE}/openai.png`,
  google_calendar: `${LOGO_BASE}/google_calendar.png`,
  outlook_calendar: `${LOGO_BASE}/outlook_calendar.png`,
  razorpay: `${LOGO_BASE}/razorpay.png`,
  stripe: `${LOGO_BASE}/stripe.png`,
  square: `${LOGO_BASE}/square.png`,
  paypal: `${LOGO_BASE}/paypal.png`,
  payu: `${LOGO_BASE}/payu.png`,
}

export function integrationLogoPath(providerId: string): string | null {
  return INTEGRATION_LOGO_PNG[providerId] ?? null
}

export function IntegrationLogoImage({
  providerId,
  alt,
  className,
}: {
  providerId: string
  alt: string
  className?: string
}) {
  const src = integrationLogoPath(providerId)
  if (!src) return null

  return (
    <img
      src={src}
      alt={alt}
      className={cn('h-4 w-auto max-w-[130px] object-contain object-left', className)}
      draggable={false}
    />
  )
}
