/**
 * Fallback cookie banner when the site has tracking IDs configured but no
 * Cookie Consent block on the homepage. Without this, GA/Meta stay blocked
 * forever because consent defaults to opt-in-only.
 */
import { useEffect, useState } from 'react'
import type { PublicSite } from '@/blocks/registry'
import { getConsent, onConsentChange, setConsent } from '@/lib/consent'
import { siteCookieConsentShellBlock } from '@/lib/storefrontLayoutChrome'

function siteHasTracking(site: PublicSite): boolean {
  return Boolean(
    site.google_analytics_id?.trim()
    || site.meta_pixel_id?.trim()
    || site.custom_head_code?.trim()
    || site.custom_body_code?.trim(),
  )
}

export default function DefaultCookieConsentBanner({ site }: { site: PublicSite }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Prefer the homepage Cookie Consent block (that is what the live site renders).
    if (!siteHasTracking(site) || siteCookieConsentShellBlock(site)) {
      setVisible(false)
      return
    }
    setVisible(getConsent(site.id) === 'unknown')
    return onConsentChange(state => setVisible(state === 'unknown'), site.id)
  }, [site])

  if (!visible) return null

  const primary =
    (site.style_config as { primary_color?: string } | undefined)?.primary_color || '#2563eb'

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[60] border-t border-gray-200 bg-white shadow-xl p-4 sm:p-6"
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-4">
        <p className="text-sm text-gray-600 flex-1">
          We use cookies to improve your experience and measure site traffic.
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setConsent('denied', { siteId: site.id })}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 font-medium text-gray-600"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => setConsent('granted', { siteId: site.id })}
            className="px-4 py-2 text-sm rounded-xl text-white font-semibold hover:opacity-90"
            style={{ backgroundColor: primary }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
