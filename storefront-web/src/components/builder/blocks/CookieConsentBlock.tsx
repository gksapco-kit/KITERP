import { useEffect, useState } from 'react'
import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import { getConsent, onConsentChange, setConsent } from '@/lib/consent'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
}

/**
 * Cookie / tracking consent banner. Visible until the visitor makes a
 * choice. Writes through the shared `lib/consent` module, which the
 * `AnalyticsInjector` listens to so analytics flip on the moment the user
 * accepts (no full reload required).
 */
export default function CookieConsentBlock({ style, props }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(getConsent() === 'unknown')
    return onConsentChange(state => {
      // If another tab makes a choice, hide the banner here too.
      setVisible(state === 'unknown')
    })
  }, [])

  const message =
    (props.message as string) ||
    'We use cookies to improve your experience and analyse traffic. You can accept all or decline non-essential cookies.'
  const acceptLabel = (props.accept_label as string) || 'Accept'
  const declineLabel = (props.decline_label as string) || 'Decline'
  const policyUrl = (props.policy_url as string) || ''

  const accept = () => {
    setConsent('granted')
    setVisible(false)
  }
  const decline = () => {
    setConsent('denied')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-xl p-4 sm:p-6"
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-4">
        <p className="text-sm text-gray-600 flex-1">
          {message}
          {policyUrl ? (
            <>
              {' '}
              <a href={policyUrl} className="underline text-gray-700 hover:opacity-80">
                Read our policy
              </a>
              .
            </>
          ) : null}
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 font-medium text-gray-600"
          >
            {declineLabel}
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 text-sm rounded-xl text-white font-semibold hover:opacity-90"
            style={{ backgroundColor: style.primary_color }}
          >
            {acceptLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
