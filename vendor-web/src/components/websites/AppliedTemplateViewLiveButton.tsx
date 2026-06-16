import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, Store, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { AppliedTemplateViewLiveLink } from '@/lib/liveStorefrontUrl'
import { openAllViewLiveLinks } from '@/lib/liveStorefrontUrl'

export const templateCardIconActionClass =
  'inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-gray-200 text-gray-600 transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary'

type PickerProps = {
  open: boolean
  templateName: string
  links: AppliedTemplateViewLiveLink[]
  /** Coverage target BU — highlighted in the list, not auto-opened. */
  highlightStoreId?: string | null
  onClose: () => void
}

/** Modal to pick which BU / store storefront opens when a template is live on multiple units. */
export function ViewLiveLinksPickerModal({
  open,
  templateName,
  links,
  highlightStoreId,
  onClose,
}: PickerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || links.length === 0) return null

  const modal = (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[min(80vh,640px)] w-full min-w-[min(100%,20rem)] max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="view-live-picker-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="view-live-picker-title" className="text-base font-semibold leading-snug text-foreground">
              View live site — {templateName}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              This template is live on {links.length} business units. Choose which storefront to open.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {links.map(link => {
            const isTarget = Boolean(highlightStoreId && link.storeId === highlightStoreId)
            return (
              <a
                key={`${link.href}-${link.label}`}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className={cn(
                  'mb-2 flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors last:mb-0',
                  isTarget
                    ? 'border-emerald-400 bg-emerald-50/80 ring-1 ring-emerald-200 hover:border-emerald-500'
                    : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/60',
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Store className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-semibold text-gray-900 break-words" title={link.label}>
                      {link.label}
                    </span>
                    {isTarget ? (
                      <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                        Target
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block break-all text-xs text-gray-500">{link.href}</span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-emerald-600" />
              </a>
            )
          })}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-border px-5 py-4">
          {links.length > 1 ? (
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                openAllViewLiveLinks(links)
                onClose()
              }}
            >
              Open all ({links.length} tabs)
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="w-full" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

type Props = {
  links: AppliedTemplateViewLiveLink[]
  templateName?: string
  className?: string
  /** Coverage target BU — highlighted in picker when template is on multiple units. */
  highlightStoreId?: string | null
}

export function AppliedTemplateViewLiveButton({
  links,
  templateName = 'Template',
  className,
  highlightStoreId,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)

  if (!links.length) return null

  if (links.length === 1) {
    return (
      <a
        href={links[0].href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(templateCardIconActionClass, className)}
        title="View live site"
        aria-label="View live site"
        data-template-card-action
        onClick={e => e.stopPropagation()}
      >
        <ExternalLink className="h-4 w-4 shrink-0" />
      </a>
    )
  }

  return (
    <>
      <button
        type="button"
        data-template-card-action
        onClick={e => {
          e.stopPropagation()
          setPickerOpen(true)
        }}
        className={cn(templateCardIconActionClass, className)}
        title={`View live site — choose from ${links.length} business units`}
        aria-label={`View live site — choose from ${links.length} business units`}
      >
        <ExternalLink className="h-4 w-4 shrink-0" />
      </button>
      <ViewLiveLinksPickerModal
        open={pickerOpen}
        templateName={templateName}
        links={links}
        highlightStoreId={highlightStoreId}
        onClose={() => setPickerOpen(false)}
      />
    </>
  )
}
