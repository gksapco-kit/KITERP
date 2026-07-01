import { useEffect, useState } from 'react'
import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'
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
 * Cookie / tracking consent banner. Hidden after Accept (stores consent) or
 * Decline (stores denial). In the builder canvas the banner reappears on reload
 * so you can keep editing; live site + draft preview respect stored consent.
 */
export default function CookieConsentBlock({ style, props, site, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditor = builderCanvas?.isEditorCanvas && !!blockId
  /** Draft browser preview always shows the banner so authors can verify copy/actions. */
  const isDraftPreview = builderCanvas?.isDraftPreview === true
  const alwaysShowChrome = isEditor || isDraftPreview
  const [dismissed, setDismissed] = useState(false)

  const shouldShowInitially = alwaysShowChrome
    ? true
    : getConsent() === 'unknown'

  const [visible, setVisible] = useState(shouldShowInitially)

  useEffect(() => {
    if (dismissed) {
      setVisible(false)
      return
    }
    if (alwaysShowChrome) {
      setVisible(true)
      return
    }
    setVisible(getConsent() === 'unknown')
    return onConsentChange(state => {
      if (!dismissed) setVisible(state === 'unknown')
    })
  }, [dismissed, alwaysShowChrome])

  const message = resolveBlockTextField(props, 'message')
  const acceptLabel = resolveBlockTextField(props, 'accept_label')
  const declineLabel = resolveBlockTextField(props, 'decline_label')
  const showMessage = !isBlockFieldHidden(props, 'message') && (message || alwaysShowChrome)
  const showAccept = !isBlockFieldHidden(props, 'accept_label') && (acceptLabel || alwaysShowChrome)
  const showDecline = !isBlockFieldHidden(props, 'decline_label') && (declineLabel || alwaysShowChrome)
  const policyUrl = (props.policy_url as string) || ''

  const hideBanner = () => {
    setDismissed(true)
    setVisible(false)
  }

  const accept = () => {
    setConsent('granted', { siteId: site.id })
    hideBanner()
  }

  const decline = () => {
    setConsent('denied', { siteId: site.id })
    hideBanner()
  }

  if (!visible) return null
  if (!showMessage && !showAccept && !showDecline) return null

  return (
    <div
      className={cn(
        'bg-white border border-gray-200 shadow-xl p-4 sm:p-6',
        alwaysShowChrome && isEditor
          ? 'relative w-full rounded-2xl'
          : 'fixed bottom-0 left-0 right-0 z-[60] border-t',
      )}
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-4">
        <p className="text-sm text-gray-600 flex-1">
          {showMessage ? (
            <BuilderTextField
              fieldKey="message"
              blockId={blockId}
              blockProps={props}
              value={message ?? ''}
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
            {showDecline ? (
              <BuilderTextField
                fieldKey="decline_label"
                blockId={blockId}
                blockProps={props}
                value={declineLabel ?? ''}
                as="span"
                embeddedInControl
                placeholder="Decline"
              />
            ) : (
              'Decline'
            )}
          </button>
          <button
            type="button"
            onClick={accept}
            className="px-4 py-2 text-sm rounded-xl text-white font-semibold hover:opacity-90"
            style={{ backgroundColor: style.primary_color }}
          >
            {showAccept ? (
              <BuilderTextField
                fieldKey="accept_label"
                blockId={blockId}
                blockProps={props}
                value={acceptLabel ?? ''}
                as="span"
                embeddedInControl
                placeholder="Accept"
              />
            ) : (
              'Accept'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
