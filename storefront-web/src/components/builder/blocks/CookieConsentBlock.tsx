import { useEffect, useState } from 'react'
import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { cn } from '@/lib/utils'
import { getConsent, onConsentChange, setConsent } from '@/lib/consent'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

/**
 * Cookie / tracking consent banner. Visible until the visitor makes a
 * choice. Writes through the shared `lib/consent` module, which the
 * `AnalyticsInjector` listens to so analytics flip on the moment the user
 * accepts (no full reload required).
 */
export default function CookieConsentBlock({ style, props, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditor = builderCanvas?.isEditorCanvas && !!blockId
  const isDraftPreview = Boolean(builderCanvas?.isDraftPreview)
  const keepVisible = isEditor || isDraftPreview
  const [visible, setVisible] = useState(keepVisible || getConsent() === 'unknown')

  useEffect(() => {
    if (keepVisible) {
      setVisible(true)
      return
    }
    setVisible(getConsent() === 'unknown')
    return onConsentChange(state => {
      setVisible(state === 'unknown')
    })
  }, [keepVisible])

  const message =
    (props.message as string) ||
    'We use cookies to improve your experience and analyse traffic. You can accept all or decline non-essential cookies.'
  const acceptLabel = (props.accept_label as string) || 'Accept'
  const declineLabel = (props.decline_label as string) || 'Decline'
  const policyUrl = (props.policy_url as string) || ''

  const accept = () => {
    if (isEditor) return
    setConsent('granted')
    if (!isDraftPreview) setVisible(false)
  }
  const decline = () => {
    if (isEditor) return
    setConsent('denied')
    if (!isDraftPreview) setVisible(false)
  }

  if (!visible && !keepVisible) return null

  return (
    <div
      className={cn(
        'bg-white border border-gray-200 shadow-xl p-4 sm:p-6',
        isEditor ? 'relative w-full rounded-2xl' : 'fixed bottom-0 left-0 right-0 z-[60] border-t',
      )}
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-4">
        <p className="text-sm text-gray-600 flex-1">
          {(message || blockId) ? (
            <BuilderTextField
              fieldKey="message"
              blockId={blockId}
              blockProps={props}
              value={message}
              as="span"
              multiline
              placeholder="Cookie consent message…"
            />
          ) : null}
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
            type="button"
            onClick={decline}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 font-medium text-gray-600"
          >
            {(declineLabel || blockId) ? (
              <BuilderTextField
                fieldKey="decline_label"
                blockId={blockId}
                blockProps={props}
                value={declineLabel}
                as="span"
                embeddedInControl
                placeholder="Decline"
              />
            ) : null}
          </button>
          <button
            type="button"
            onClick={accept}
            className="px-4 py-2 text-sm rounded-xl text-white font-semibold hover:opacity-90"
            style={{ backgroundColor: style.primary_color }}
          >
            {(acceptLabel || blockId) ? (
              <BuilderTextField
                fieldKey="accept_label"
                blockId={blockId}
                blockProps={props}
                value={acceptLabel}
                as="span"
                embeddedInControl
                placeholder="Accept"
              />
            ) : null}
          </button>
        </div>
      </div>
    </div>
  )
}
