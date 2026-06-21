import { Globe, Globe2, Store, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type WebsiteScope = 'all' | 'store' | 'external'

/** Normalize the raw style_config scope into one of the three known scopes. */
export function resolveWebsiteScope(scope?: string | null): WebsiteScope {
  if (scope === 'store' || scope === 'external') return scope
  return 'all'
}

type ScopeMeta = {
  label: string
  shortLabel: string
  icon: LucideIcon
  className: string
}

const SCOPE_META: Record<WebsiteScope, ScopeMeta> = {
  all: {
    label: 'Website build scope — shared design for all business units (not the same as “applied” template)',
    shortLabel: 'Built for all units',
    icon: Globe,
    className: 'border-slate-200 bg-slate-50 text-slate-600',
  },
  store: {
    label: 'Built for a specific business unit',
    shortLabel: 'Business unit',
    icon: Store,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  external: {
    label: 'External / marketing site — not tied to a store',
    shortLabel: 'External',
    icon: Globe2,
    className: 'border-violet-200 bg-violet-50 text-violet-700',
  },
}

/**
 * Small pill showing what a website was built for: a specific business unit,
 * an external marketing site, or shared across all business units.
 * For store-scoped sites it shows the business unit name when available.
 */
export function WebsiteScopeBadge({
  scope,
  storeName,
  className,
}: {
  scope?: string | null
  storeName?: string | null
  className?: string
}) {
  const resolved = resolveWebsiteScope(scope)
  const meta = SCOPE_META[resolved]
  const Icon = meta.icon
  const text =
    resolved === 'store' && storeName?.trim() ? storeName.trim() : meta.shortLabel
  const title =
    resolved === 'store' && storeName?.trim()
      ? `${meta.label}: ${storeName.trim()}`
      : meta.label

  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
        meta.className,
        className,
      )}
    >
      <Icon className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{text}</span>
    </span>
  )
}
