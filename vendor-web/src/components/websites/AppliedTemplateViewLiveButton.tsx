import { useEffect, useState } from 'react'
import { ExternalLink, Store, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { AppliedTemplateViewLiveLink } from '@/lib/liveStorefrontUrl'

export const templateCardIconActionClass =
  'inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-gray-200 text-gray-600 transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary'

type PickerProps = {
  open: boolean
  templateName: string
  links: AppliedTemplateViewLiveLink[]
  onClose: () => void
}

/** Modal to pick which BU / store storefront opens when a template is live on multiple units. */
export function ViewLiveLinksPickerModal({ open, templateName, links, onClose }: PickerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || links.length === 0) return null

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="view-live-picker-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="view-live-picker-title" className="text-base font-semibold text-foreground">
              View live site — {templateName}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              This template is live on {links.length} business units. Pick which live site to open.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {links.map(link => (
            <a
              key={`${link.href}-${link.label}`}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="mb-1.5 flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 text-left transition-colors last:mb-0 hover:border-emerald-300 hover:bg-emerald-50/60"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Store className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-gray-900" title={link.label}>
                  {link.label}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-gray-500">{link.href}</span>
              </span>
              <ExternalLink className="h-4 w-4 shrink-0 text-emerald-600" />
            </a>
          ))}
        </div>

        <div className="border-t border-border px-5 py-3">
          <Button type="button" variant="outline" className="w-full" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

type Props = {
  links: AppliedTemplateViewLiveLink[]
  templateName?: string
  className?: string
}

export function AppliedTemplateViewLiveButton({ links, templateName = 'Template', className }: Props) {
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
      >
        <ExternalLink className="h-4 w-4 shrink-0" />
      </a>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className={cn(templateCardIconActionClass, className)}
        title={`View live site (${links.length} business units)`}
        aria-label={`View live site (${links.length} business units)`}
      >
        <ExternalLink className="h-4 w-4 shrink-0" />
      </button>
      <ViewLiveLinksPickerModal
        open={pickerOpen}
        templateName={templateName}
        links={links}
        onClose={() => setPickerOpen(false)}
      />
    </>
  )
}
