import { useState } from 'react'
import { ExternalLink, Copy, Check, Store, UserCircle } from 'lucide-react'
import { getCustomerStorefrontBaseUrl, getStorefrontAppOrigin } from '@/lib/storefrontPreviewUrl'
import { cn } from '@/lib/utils'

type Props = {
  vendorSlug: string
  /** Optional outlet / company code (store code) — appended as `?branch=` on links when set */
  outletCode?: string | null
  /** When true, do not render the outlet row (e.g. company code is shown above this card on Store detail). */
  hideOutletRow?: boolean
  /** Flat layout without outer card chrome (use inside Company Codes / store detail). */
  embedded?: boolean
}

/**
 * Sidebar card: storefront customer URL, employee HR / ESS login, and copyable slug / outlet code.
 */
export default function VendorStorefrontLinksCard({
  vendorSlug,
  outletCode,
  hideOutletRow,
  embedded,
}: Props) {
  const slug = vendorSlug.trim()
  const [copied, setCopied] = useState<'slug' | 'outlet' | null>(null)

  const storeBase = getCustomerStorefrontBaseUrl(slug)
  const origin = getStorefrontAppOrigin()
  const branchQ = outletCode ? `?branch=${encodeURIComponent(outletCode)}` : ''
  const storeUrl = `${storeBase}${branchQ}`
  const hrUrl = `${origin}/store/${encodeURIComponent(slug)}/hr/login${branchQ}`

  async function copyText(label: 'slug' | 'outlet', text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      /* ignore */
    }
  }

  const outlet = (outletCode ?? '').trim()

  return (
    <div
      className={cn(
        embedded
          ? 'space-y-2'
          : 'mx-3 mb-2 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm',
      )}
    >
      <p
        className={cn(
          'text-[10px] font-bold uppercase tracking-wide text-muted-foreground',
          embedded ? 'mb-1.5' : 'mb-2',
        )}
      >
        {'Storefront & HR access'}
      </p>

      <div className="space-y-2">
        <div className="flex items-start gap-2 rounded-md bg-muted/50 px-2 py-1.5 border border-border/60">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium text-muted-foreground">Store URL slug</p>
            <p className="text-xs font-mono font-semibold text-foreground truncate" title={slug}>
              {slug}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void copyText('slug', slug)}
            className={cn(
              'shrink-0 p-1.5 rounded-md border border-border bg-background hover:bg-muted transition-colors',
              copied === 'slug' && 'text-emerald-600 border-emerald-200',
            )}
            title="Copy slug"
            aria-label="Copy store slug"
          >
            {copied === 'slug' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {outlet && !hideOutletRow ? (
          <div className="flex items-start gap-2 rounded-md bg-muted/50 px-2 py-1.5 border border-border/60">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-muted-foreground">Outlet / company code</p>
              <p className="text-xs font-mono font-semibold text-foreground truncate" title={outlet}>
                {outlet}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copyText('outlet', outlet)}
              className={cn(
                'shrink-0 p-1.5 rounded-md border border-border bg-background hover:bg-muted transition-colors',
                copied === 'outlet' && 'text-emerald-600 border-emerald-200',
              )}
              title="Copy outlet code"
              aria-label="Copy outlet code"
            >
              {copied === 'outlet' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        ) : null}

        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-foreground border border-border bg-background hover:bg-muted/80 transition-colors"
        >
          <Store className="w-3.5 h-3.5 text-violet-600 shrink-0" />
          <span className="flex-1 min-w-0 truncate">Customer store</span>
          <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
        </a>

        <a
          href={hrUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-foreground border border-border bg-background hover:bg-muted/80 transition-colors"
        >
          <UserCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="flex-1 min-w-0 truncate">HR / ESS portal</span>
          <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
        </a>
      </div>

      <p className="mt-2 text-[10px] text-muted-foreground leading-snug">
        Use the slug for vendor login when your email exists on more than one business. Links open in a new tab.
      </p>
    </div>
  )
}
