/**
 * Previously showed a fallback Accept/Decline banner whenever GA/Pixel was
 * configured without a Cookie Consent block. That confused visitors, so the
 * fallback is disabled — tracking loads by default unless a vendor adds an
 * explicit Cookie Consent block.
 */
import type { PublicSite } from '@/blocks/registry'

export default function DefaultCookieConsentBanner(_props: { site: PublicSite }) {
  return null
}
