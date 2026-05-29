import { Check, Clock, Package, RefreshCw, Shield, Truck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SectionHeading } from '../builder/SectionHeading'
import type { Block, PolicyInfoSection } from '../../types/builder'

const SECTION_ICONS: Record<string, LucideIcon> = {
  truck: Truck,
  package: Package,
  refresh: RefreshCw,
  shield: Shield,
  clock: Clock,
}

type SectionTheme = {
  panel: string
  iconWrap: string
  icon: string
  badge: string
  check: string
  divider: string
}

const SECTION_THEMES: Record<string, SectionTheme> = {
  truck: {
    panel: 'bg-gradient-to-br from-sky-50/90 via-white to-white dark:from-sky-950/30 dark:via-gray-900 dark:to-gray-900',
    iconWrap: 'bg-sky-500 shadow-lg shadow-sky-500/25',
    icon: 'text-white',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200',
    check: 'text-sky-600 dark:text-sky-400',
    divider: 'border-sky-100/80 dark:border-sky-900/50',
  },
  package: {
    panel: 'bg-gradient-to-br from-indigo-50/90 via-white to-white dark:from-indigo-950/30 dark:via-gray-900 dark:to-gray-900',
    iconWrap: 'bg-indigo-500 shadow-lg shadow-indigo-500/25',
    icon: 'text-white',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200',
    check: 'text-indigo-600 dark:text-indigo-400',
    divider: 'border-indigo-100/80 dark:border-indigo-900/50',
  },
  refresh: {
    panel: 'bg-gradient-to-br from-amber-50/90 via-white to-white dark:from-amber-950/20 dark:via-gray-900 dark:to-gray-900',
    iconWrap: 'bg-amber-500 shadow-lg shadow-amber-500/25',
    icon: 'text-white',
    badge: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200',
    check: 'text-amber-700 dark:text-amber-400',
    divider: 'border-amber-100/80 dark:border-amber-900/40',
  },
  shield: {
    panel: 'bg-gradient-to-br from-emerald-50/90 via-white to-white dark:from-emerald-950/20 dark:via-gray-900 dark:to-gray-900',
    iconWrap: 'bg-emerald-500 shadow-lg shadow-emerald-500/25',
    icon: 'text-white',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
    check: 'text-emerald-600 dark:text-emerald-400',
    divider: 'border-emerald-100/80 dark:border-emerald-900/40',
  },
  clock: {
    panel: 'bg-gradient-to-br from-violet-50/90 via-white to-white dark:from-violet-950/20 dark:via-gray-900 dark:to-gray-900',
    iconWrap: 'bg-violet-500 shadow-lg shadow-violet-500/25',
    icon: 'text-white',
    badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200',
    check: 'text-violet-600 dark:text-violet-400',
    divider: 'border-violet-100/80 dark:border-violet-900/40',
  },
}

const DEFAULT_THEME = SECTION_THEMES.truck

const BADGE_LABELS: Record<string, string> = {
  truck: 'Delivery',
  package: 'Packaging',
  refresh: 'Returns',
  shield: 'Guarantee',
  clock: 'Timing',
}

function getTheme(icon?: string): SectionTheme {
  return SECTION_THEMES[icon ?? 'truck'] ?? DEFAULT_THEME
}

interface ShippingReturnsInfoBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
}

function PolicyPanel({
  section,
  showDivider,
}: {
  section: PolicyInfoSection
  showDivider?: boolean
}) {
  const Icon = SECTION_ICONS[section.icon ?? 'truck'] ?? Truck
  const theme = getTheme(section.icon)
  const items = section.items?.filter((line) => line.trim()) ?? []
  const [highlight, ...rest] = items

  return (
    <article
      className={`relative flex h-full flex-col p-6 sm:p-8 lg:p-9 ${theme.panel} ${
        showDivider ? 'lg:border-l lg:border-gray-200/80 dark:lg:border-gray-700/80' : ''
      }`}
    >
      <div className="mb-6 flex items-start gap-4">
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${theme.iconWrap}`}
        >
          <Icon className={`h-7 w-7 ${theme.icon}`} aria-hidden />
        </span>
        <div className="min-w-0 pt-0.5">
          <span
            className={`mb-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${theme.badge}`}
          >
            {BADGE_LABELS[section.icon ?? 'truck'] ?? 'Policy'}
          </span>
          <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">{section.title}</h3>
          {section.description && (
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{section.description}</p>
          )}
        </div>
      </div>

      <div className={`mb-5 border-t ${theme.divider}`} />

      {highlight && (
        <div className="mb-5 rounded-xl border border-gray-100/80 bg-white/70 px-4 py-3.5 shadow-sm dark:border-gray-700/60 dark:bg-gray-800/40">
          <p className="text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">{highlight}</p>
        </div>
      )}

      {rest.length > 0 ? (
        <ul className="mt-auto space-y-3.5">
          {rest.map((line, i) => (
            <li key={i} className="flex gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-100 dark:bg-gray-800 dark:ring-gray-700 ${theme.check}`}
              >
                <Check className="h-3 w-3 stroke-[3]" aria-hidden />
              </span>
              <span className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{line}</span>
            </li>
          ))}
        </ul>
      ) : !highlight ? (
        <p className="text-sm text-gray-400">Add policy details in the properties panel.</p>
      ) : null}
    </article>
  )
}

export function ShippingReturnsInfoBlock({ block, layoutStyle }: ShippingReturnsInfoBlockProps) {
  const { props, styles } = block
  const sections = Array.isArray(props.policySections) ? props.policySections : []
  const multi = sections.length >= 2

  return (
    <section style={layoutStyle} className="w-full min-w-0">
      {(props.text || props.subtitle) && (
        <SectionHeading
          title={props.text}
          subtitle={props.subtitle}
          styles={block.styles}
          className="mb-8 md:mb-10"
          titleClassName="text-2xl font-bold tracking-tight md:text-3xl"
          subtitleClassName="mx-auto mt-3 max-w-2xl text-base text-gray-600"
        />
      )}

      {sections.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-16 text-center dark:border-gray-700 dark:bg-gray-900/30">
          <Package className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-500">Add shipping or returns sections in the properties panel.</p>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_8px_40px_rgba(15,23,42,0.06)] dark:border-gray-700/90 dark:bg-gray-900 dark:shadow-none"
          style={{
            backgroundColor: styles.backgroundColor,
            borderRadius: styles.borderRadius,
          }}
        >
          <div
            className={`grid ${multi ? 'lg:grid-cols-2' : 'max-w-2xl mx-auto'}`}
          >
            {sections.map((section, index) => (
              <PolicyPanel
                key={section.id ?? section.title}
                section={section}
                showDivider={multi && index > 0}
              />
            ))}
          </div>

          {multi && (
            <div className="flex flex-wrap items-center justify-center gap-6 border-t border-gray-100 bg-gray-50/80 px-6 py-4 text-center text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-950/50 dark:text-gray-400 sm:gap-10">
              <span className="inline-flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-sky-500" aria-hidden />
                Fast delivery
              </span>
              <span className="hidden h-3 w-px bg-gray-300 sm:block" aria-hidden />
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                Easy returns
              </span>
              <span className="hidden h-3 w-px bg-gray-300 sm:block" aria-hidden />
              <span className="inline-flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                Secure checkout
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
