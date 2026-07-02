import { publicAsset } from '@/lib/publicAsset'
import { cn } from '@/lib/utils'

/** PNG wordmark paths for integration card headers */
export const INTEGRATION_LOGO_PNG: Record<string, string> = {
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
