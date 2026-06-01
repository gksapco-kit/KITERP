import { useState } from 'react'
import { UserCircle, Copy, ExternalLink, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HrEssLinkRow } from '@/lib/hrStorefrontLinks'
import { readHrModuleSettings } from '@/lib/hrModuleSettings'

const iconBtnClass =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

type CopyKey = string

type Props = {
  links: HrEssLinkRow[]
  settings?: Record<string, unknown> | undefined | null
  embedded?: boolean
  className?: string
}

/**
 * ESS login URL(s) for settings / stores list.
 * Central HR → one shared link; per-BU HR → one link per enabled unit.
 */
export default function HrEssLinksPanel({ links, settings, embedded, className }: Props) {
  const [copied, setCopied] = useState<CopyKey | null>(null)
  const hr = readHrModuleSettings(settings)

  if (!hr.hr_enabled || links.length === 0) return null

  const scopeHint =
    hr.hr_scope === 'central'
      ? 'Central HR — one shared employee login link for all business units.'
      : 'HR enabled on selected business units only — one login link per unit.'

  async function copyText(key: CopyKey, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      /* ignore */
    }
  }

  const body = (
    <div className="divide-y divide-border">
      {links.map((row) => {
        const key = row.storeId
        const isCopied = copied === key
        return (
          <div key={key} className="flex items-start gap-2 px-2.5 py-2">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10">
              <UserCircle className="h-3.5 w-3.5 text-emerald-600" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">
                {row.code ? `${row.code} — ${row.name}` : row.name}
              </span>
              <span className="block text-xs text-muted-foreground">HR & employee login</span>
              <a
                href={row.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 block truncate font-mono text-xs text-primary/90 underline-offset-2 hover:text-primary hover:underline"
                title={row.url}
              >
                {row.url}
              </a>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => void copyText(key, row.url)}
                className={cn(iconBtnClass, isCopied && 'border-emerald-200 text-emerald-700')}
                title="Copy link"
                aria-label={`Copy ESS link for ${row.name}`}
              >
                {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <a
                href={row.url}
                target="_blank"
                rel="noopener noreferrer"
                className={iconBtnClass}
                title="Open"
                aria-label={`Open ESS login for ${row.name}`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )
      })}
    </div>
  )

  if (embedded) {
    return (
      <div className={cn('space-y-1.5', className)}>
        <p className="text-xs font-medium text-foreground">Employee login (ESS)</p>
        <p className="text-xs text-muted-foreground">{scopeHint}</p>
        <div className="overflow-hidden rounded-lg border border-border bg-background">{body}</div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm', className)}>
      <p className="text-xs font-medium text-foreground">Employee login (ESS)</p>
      <p className="text-xs text-muted-foreground">{scopeHint}</p>
      <div className="overflow-hidden rounded-md border border-border">{body}</div>
    </div>
  )
}
