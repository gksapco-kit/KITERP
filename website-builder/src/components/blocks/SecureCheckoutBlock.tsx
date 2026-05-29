import {
  Award,
  CheckCircle2,
  CreditCard,
  Headphones,
  Lock,
  RefreshCw,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SectionHeading } from '../builder/SectionHeading'
import { SECURE_CHECKOUT_DEFAULTS } from '../../lib/secureCheckoutDefaults'
import type { Block, TrustBadgeItem } from '../../types/builder'

const BADGE_ICONS: Record<string, LucideIcon> = {
  lock: Lock,
  shield: ShieldCheck,
  truck: Truck,
  refresh: RefreshCw,
  award: Award,
  check: CheckCircle2,
  'credit-card': CreditCard,
  headphones: Headphones,
}

type BadgeTheme = { wrap: string; icon: string; ring: string }

const BADGE_THEMES: Record<string, BadgeTheme> = {
  lock: {
    wrap: 'bg-emerald-500 shadow-lg shadow-emerald-500/20',
    icon: 'text-white',
    ring: 'ring-emerald-100 dark:ring-emerald-900/40',
  },
  shield: {
    wrap: 'bg-sky-500 shadow-lg shadow-sky-500/20',
    icon: 'text-white',
    ring: 'ring-sky-100 dark:ring-sky-900/40',
  },
  truck: {
    wrap: 'bg-indigo-500 shadow-lg shadow-indigo-500/20',
    icon: 'text-white',
    ring: 'ring-indigo-100 dark:ring-indigo-900/40',
  },
  refresh: {
    wrap: 'bg-amber-500 shadow-lg shadow-amber-500/20',
    icon: 'text-white',
    ring: 'ring-amber-100 dark:ring-amber-900/40',
  },
  award: {
    wrap: 'bg-violet-500 shadow-lg shadow-violet-500/20',
    icon: 'text-white',
    ring: 'ring-violet-100 dark:ring-violet-900/40',
  },
  check: {
    wrap: 'bg-teal-500 shadow-lg shadow-teal-500/20',
    icon: 'text-white',
    ring: 'ring-teal-100 dark:ring-teal-900/40',
  },
  'credit-card': {
    wrap: 'bg-slate-700 shadow-lg shadow-slate-500/20',
    icon: 'text-white',
    ring: 'ring-slate-200 dark:ring-slate-700',
  },
  headphones: {
    wrap: 'bg-rose-500 shadow-lg shadow-rose-500/20',
    icon: 'text-white',
    ring: 'ring-rose-100 dark:ring-rose-900/40',
  },
}

const DEFAULT_THEME = BADGE_THEMES.shield

function getIcon(icon?: string): LucideIcon {
  return BADGE_ICONS[icon ?? 'shield'] ?? ShieldCheck
}

function getTheme(icon?: string): BadgeTheme {
  return BADGE_THEMES[icon ?? 'shield'] ?? DEFAULT_THEME
}

interface SecureCheckoutBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
}

function BadgeIcon({ item, size = 'md' }: { item: TrustBadgeItem; size?: 'sm' | 'md' }) {
  const Icon = getIcon(item.icon)
  const theme = getTheme(item.icon)
  const dim = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11'
  const iconDim = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <div className={`flex shrink-0 ${dim} items-center justify-center rounded-xl ring-4 ${theme.wrap} ${theme.icon} ${theme.ring}`}>
      <Icon className={iconDim} aria-hidden />
    </div>
  )
}

function HighlightBanner({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <div className="mb-8 flex flex-col items-center gap-4 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-sky-50/80 p-6 text-center dark:border-emerald-900/50 dark:from-emerald-950/30 dark:via-gray-900 dark:to-sky-950/20 sm:flex-row sm:text-left sm:p-8">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 shadow-xl shadow-emerald-500/25">
        <Lock className="h-8 w-8 text-white" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">{title}</p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-emerald-800 shadow-sm dark:bg-gray-800 dark:text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            PCI DSS
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm dark:bg-gray-800 dark:text-gray-300">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
            Verified secure
          </span>
        </div>
      </div>
    </div>
  )
}

function BadgeCard({ item }: { item: TrustBadgeItem }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700/80 dark:bg-gray-900/50">
      <BadgeIcon item={item} />
      <h3 className="mt-4 font-semibold text-gray-900 dark:text-gray-100">{item.title}</h3>
      {item.description && (
        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{item.description}</p>
      )}
    </div>
  )
}

function BadgeRow({ item }: { item: TrustBadgeItem }) {
  return (
    <div className="flex min-w-[200px] flex-1 items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/40">
      <BadgeIcon item={item} size="sm" />
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
        {item.description && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{item.description}</p>}
      </div>
    </div>
  )
}

function BadgeCompact({ item }: { item: TrustBadgeItem }) {
  const Icon = getIcon(item.icon)
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
      <Icon className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
      {item.title}
    </span>
  )
}

export function SecureCheckoutBlock({ block, layoutStyle }: SecureCheckoutBlockProps) {
  const { props, styles } = block
  const layout = props.secureCheckoutLayout ?? SECURE_CHECKOUT_DEFAULTS.secureCheckoutLayout
  const badges = (props.trustBadges ?? []).filter((b) => b.enabled !== false)
  const showHighlight = props.showSecureHighlight !== false
  const highlightTitle = props.highlightTitle ?? SECURE_CHECKOUT_DEFAULTS.highlightTitle
  const highlightSubtitle = props.highlightSubtitle ?? SECURE_CHECKOUT_DEFAULTS.highlightSubtitle

  const gridCols =
    badges.length <= 2
      ? 'sm:grid-cols-2'
      : badges.length === 3
        ? 'sm:grid-cols-3'
        : 'sm:grid-cols-2 lg:grid-cols-4'

  return (
    <section style={layoutStyle} className="w-full">
      {(props.text || props.subtitle) && (
        <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-8" />
      )}

      {showHighlight && layout !== 'compact' && (
        <HighlightBanner title={highlightTitle} subtitle={highlightSubtitle} />
      )}

      {badges.length === 0 ? (
        <p className="text-center text-sm text-gray-400">Add trust badges in the properties panel</p>
      ) : layout === 'compact' ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {showHighlight && (
            <span className="mb-1 w-full text-center text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              {highlightTitle}
            </span>
          )}
          {badges.map((b) => (
            <BadgeCompact key={b.id ?? b.title} item={b} />
          ))}
        </div>
      ) : layout === 'row' ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {badges.map((b) => (
            <BadgeRow key={b.id ?? b.title} item={b} />
          ))}
        </div>
      ) : layout === 'banner' ? (
        <div className="rounded-2xl border border-gray-200 bg-gradient-to-r from-gray-50 to-white px-4 py-6 dark:border-gray-700 dark:from-gray-900 dark:to-gray-900/80 sm:px-8">
          <div className={`grid gap-6 ${gridCols}`}>
            {badges.map((b) => (
              <div key={b.id ?? b.title} className="flex flex-col items-center text-center">
                <BadgeIcon item={b} />
                <p className="mt-3 font-semibold text-gray-900 dark:text-gray-100">{b.title}</p>
                {b.description && <p className="mt-1 text-sm text-gray-500">{b.description}</p>}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={`grid gap-4 ${gridCols}`}>
          {badges.map((b) => (
            <BadgeCard key={b.id ?? b.title} item={b} />
          ))}
        </div>
      )}
    </section>
  )
}
