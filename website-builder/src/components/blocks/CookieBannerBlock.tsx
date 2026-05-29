import { useState } from 'react'
import { Cookie, X } from 'lucide-react'
import { createLinkClickHandler } from '../../lib/buttonNavigation'
import {
  COOKIE_BANNER_FLOAT_POSITION,
  cookieBannerAcceptStyle,
  cookieBannerPanelStyle,
  type CookieBannerLayout,
  type CookieBannerPosition,
} from '../../lib/cookieBannerStyles'
import { useBuilderStore } from '../../store/useBuilderStore'
import type { Block } from '../../types/builder'

interface CookieBannerBlockProps {
  block: Block
  interactive?: boolean
  onNavigate?: (slug: string) => void
}

export function CookieBannerBlock({ block, interactive, onNavigate }: CookieBannerBlockProps) {
  const pages = useBuilderStore((s) => s.pages)
  const { props, styles } = block
  const layout = (props.cookieBannerLayout ?? 'bar') as CookieBannerLayout
  const position = (props.cookieBannerPosition ?? 'bottom-center') as CookieBannerPosition
  const showReject = props.showCookieReject !== false
  const showPolicyLink = props.showCookiePolicyLink !== false
  const [dismissed, setDismissed] = useState(false)

  const panelStyle = cookieBannerPanelStyle(styles)
  const acceptStyle = cookieBannerAcceptStyle(styles)
  const message = props.text ?? 'We use cookies to improve your experience and analyze site traffic.'
  const detail = props.subtitle ?? 'By clicking Accept, you agree to our use of cookies.'
  const acceptLabel = props.buttonText ?? 'Accept all'
  const rejectLabel = props.buttonText2 ?? 'Reject'
  const policyLabel = props.cookiePolicyLinkText ?? 'Privacy policy'
  const policyLink = props.buttonLink ?? '#'

  const policyClick = createLinkClickHandler({
    interactive: !!interactive,
    link: policyLink,
    pages,
    onNavigate,
  })

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (interactive) setDismissed(true)
  }

  const accept = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (interactive) setDismissed(true)
  }

  const banner = (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={panelStyle}
      className={`pointer-events-auto ${layout === 'bar' ? 'w-full border-t border-gray-200/80' : 'w-full'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={
          layout === 'bar'
            ? 'mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 lg:px-8'
            : 'flex flex-col gap-4'
        }
      >
        <div className="flex min-w-0 flex-1 gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            aria-hidden
          >
            <Cookie className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug">{message}</p>
            {detail && <p className="mt-1 text-xs leading-relaxed opacity-80">{detail}</p>}
            {showPolicyLink && (
              <a
                href={policyLink}
                onClick={policyClick}
                className="mt-2 inline-block text-xs font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
              >
                {policyLabel}
              </a>
            )}
          </div>
        </div>

        <div className={`flex shrink-0 flex-wrap items-center gap-2 ${layout === 'bar' ? 'sm:justify-end' : ''}`}>
          {showReject && (
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg border border-gray-300 bg-transparent px-4 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              {rejectLabel}
            </button>
          )}
          <button
            type="button"
            onClick={accept}
            style={acceptStyle}
            className="rounded-lg px-5 py-2 text-sm font-semibold shadow-sm transition hover:opacity-90"
          >
            {acceptLabel}
          </button>
          {layout === 'floating' && (
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )

  if (interactive) {
    if (dismissed) {
      return (
        <div className="pointer-events-none h-0 overflow-visible" aria-hidden>
          <div className="pointer-events-auto fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setDismissed(false)
              }}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 shadow-md hover:border-brand-300 hover:text-brand-600"
            >
              Show cookie banner preview
            </button>
          </div>
        </div>
      )
    }

    const fixedClass =
      layout === 'bar'
        ? 'fixed bottom-0 left-0 right-0 z-50'
        : `fixed z-50 ${COOKIE_BANNER_FLOAT_POSITION[position]}`

    return (
      <div className="pointer-events-none h-0 overflow-visible" aria-hidden>
        <div className={fixedClass}>{banner}</div>
      </div>
    )
  }

  const layoutHint = layout === 'bar' ? 'full-width bar at bottom' : `floating card at bottom ${position.replace('bottom-', '')}`

  return (
    <div className="w-full" style={{ margin: styles.margin }}>
      <div className="overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50/80 dark:border-gray-600 dark:bg-gray-900/40">
        {layout === 'bar' ? banner : <div className="p-4">{banner}</div>}
      </div>
      <p className="mt-2 text-xs text-gray-400">Pins as a {layoutHint} in preview and live site</p>
    </div>
  )
}
