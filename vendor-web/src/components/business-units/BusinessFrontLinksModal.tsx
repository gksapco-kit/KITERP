import { useMemo, useState } from 'react'
import { X, Copy, Check, ExternalLink, Store, UserCircle, Link2 } from 'lucide-react'
import type { StoreRecord } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  buildBusinessFrontLinkRows,
  formatAllBusinessFrontLinksForClipboard,
} from '@/lib/hrStorefrontLinks'

type Props = {
  open: boolean
  onClose: () => void
  vendorSlug: string
  stores: StoreRecord[]
  vendorSettings?: Record<string, unknown> | null
}

const iconBtnClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function LinkRow({
  label,
  sublabel,
  url,
  rowKey,
  copiedKey,
  onCopy,
}: {
  label: string
  sublabel: string
  url: string
  rowKey: string
  copiedKey: string | null
  onCopy: (key: string, url: string) => void
}) {
  const isCopied = copiedKey === rowKey
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{sublabel}</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block truncate font-mono text-xs text-primary underline-offset-2 hover:underline"
          title={url}
        >
          {url}
        </a>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onCopy(rowKey, url)}
          className={cn(iconBtnClass, isCopied && 'border-emerald-200 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300')}
          title="Copy link"
          aria-label={`Copy ${label}`}
        >
          {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={iconBtnClass}
          title="Open in new tab"
          aria-label={`Open ${label}`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  )
}

export function BusinessFrontLinksModal({ open, onClose, vendorSlug, stores, vendorSettings }: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const { storeRows, hrRows } = useMemo(
    () => buildBusinessFrontLinkRows(vendorSlug, stores, vendorSettings ?? undefined),
    [vendorSlug, stores, vendorSettings],
  )

  if (!open) return null

  async function copyOne(key: string, url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      toast.error('Could not copy — please copy manually')
    }
  }

  async function copyAll() {
    const { text, storeCount, hrCount } = formatAllBusinessFrontLinksForClipboard(
      vendorSlug,
      stores,
      vendorSettings ?? undefined,
    )
    try {
      await navigator.clipboard.writeText(text)
      if (hrCount > 0) {
        toast.success(`Copied ${storeCount} store link${storeCount === 1 ? '' : 's'} and ${hrCount} HR link${hrCount === 1 ? '' : 's'}`)
      } else {
        toast.success(`Copied ${storeCount} store link${storeCount === 1 ? '' : 's'}`)
      }
    } catch {
      toast.error('Could not copy — please copy manually')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[min(85vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        role="dialog"
        aria-labelledby="business-front-links-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="business-front-links-title" className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Link2 className="h-4 w-4 shrink-0 text-primary" />
              Business front links
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Customer store and employee login URLs for your business units.
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {storeRows.length > 0 && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Store className="h-3.5 w-3.5" />
                Customer store
              </h3>
              <div className="space-y-2">
                {storeRows.map((row) => (
                  <LinkRow
                    key={row.id}
                    rowKey={row.id}
                    label={row.label}
                    sublabel={row.sublabel}
                    url={row.url}
                    copiedKey={copiedKey}
                    onCopy={copyOne}
                  />
                ))}
              </div>
            </section>
          )}

          {hrRows.length > 0 && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <UserCircle className="h-3.5 w-3.5" />
                HR & employee login
              </h3>
              <div className="space-y-2">
                {hrRows.map((row) => (
                  <LinkRow
                    key={row.id}
                    rowKey={row.id}
                    label={row.label}
                    sublabel={row.sublabel}
                    url={row.url}
                    copiedKey={copiedKey}
                    onCopy={copyOne}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button type="button" size="sm" onClick={() => void copyAll()}>
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Copy all
          </Button>
        </div>
      </div>
    </div>
  )
}
