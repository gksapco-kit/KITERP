import { Award, Globe, Headphones, Star, TrendingUp, Users, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SectionHeading } from '../builder/SectionHeading'
import { STATS_COUNTER_DEFAULTS } from '../../lib/statsCounterDefaults'
import type { Block, StatCounterItem } from '../../types/builder'

const STAT_ICONS: Record<string, LucideIcon> = {
  users: Users,
  globe: Globe,
  star: Star,
  headphones: Headphones,
  trending: TrendingUp,
  award: Award,
  zap: Zap,
}

interface StatsCounterBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
}

function StatIcon({ icon }: { icon?: string }) {
  const Icon = STAT_ICONS[icon ?? ''] ?? null
  if (!Icon) return null
  return (
    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-900/50 dark:text-brand-400">
      <Icon className="h-5 w-5" aria-hidden />
    </div>
  )
}

function StatValue({ item, size = 'lg' }: { item: StatCounterItem; size?: 'lg' | 'xl' }) {
  const valueClass =
    size === 'xl'
      ? 'text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl'
      : 'text-3xl font-bold tracking-tight sm:text-4xl'

  return (
    <p className={`tabular-nums text-gray-900 dark:text-gray-100 ${valueClass}`}>
      {item.prefix}
      {item.value}
      {item.suffix}
    </p>
  )
}

function StatCard({ item, showDivider }: { item: StatCounterItem; showDivider?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center px-4 py-6 text-center ${
        showDivider ? 'border-gray-100 sm:border-l sm:first:border-l-0 dark:border-gray-700' : ''
      }`}
    >
      <StatIcon icon={item.icon} />
      <StatValue item={item} />
      <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-300">{item.label}</p>
      {item.description && (
        <p className="mt-1 max-w-[14rem] text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
      )}
    </div>
  )
}

function StatMinimal({ item }: { item: StatCounterItem }) {
  return (
    <div className="text-center">
      <StatValue item={item} size="lg" />
      <p className="mt-1 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {item.label}
      </p>
    </div>
  )
}

export function StatsCounterBlock({ block, layoutStyle }: StatsCounterBlockProps) {
  const { props, styles } = block
  const layout = props.statsCounterLayout ?? STATS_COUNTER_DEFAULTS.statsCounterLayout
  const showDivider = props.statsDivider !== false
  const items = (props.statItems ?? []).filter((s) => s.enabled !== false)

  const gridCols =
    items.length <= 2
      ? 'grid-cols-2'
      : items.length === 3
        ? 'grid-cols-1 sm:grid-cols-3'
        : 'grid-cols-2 lg:grid-cols-4'

  if (items.length === 0) {
    return (
      <section style={layoutStyle} className="w-full py-8 text-center text-sm text-gray-400">
        Add stats in the properties panel
      </section>
    )
  }

  if (layout === 'banner') {
    return (
      <section style={layoutStyle} className="w-full overflow-hidden rounded-2xl">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-brand-900 px-6 py-12 text-white sm:px-10 sm:py-14">
          {(props.text || props.subtitle) && (
            <SectionHeading
              title={props.text}
              subtitle={props.subtitle}
              styles={{ ...styles, titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.75)' }}
              className="mb-10"
              titleClassName="text-white"
            />
          )}
          <div className={`grid gap-8 ${gridCols}`}>
            {items.map((item) => (
              <div key={item.id ?? item.label} className="text-center">
                <StatIcon icon={item.icon} />
                <p className="text-3xl font-bold tabular-nums tracking-tight sm:text-4xl md:text-5xl">
                  {item.prefix}
                  {item.value}
                  {item.suffix}
                </p>
                <p className="mt-2 text-sm font-medium text-white/90">{item.label}</p>
                {item.description && <p className="mt-1 text-xs text-white/60">{item.description}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (layout === 'minimal') {
    return (
      <section style={layoutStyle} className="w-full">
        {(props.text || props.subtitle) && (
          <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-8" />
        )}
        <div className={`grid gap-8 ${gridCols}`}>
          {items.map((item) => (
            <StatMinimal key={item.id ?? item.label} item={item} />
          ))}
        </div>
      </section>
    )
  }

  if (layout === 'row') {
    return (
      <section style={layoutStyle} className="w-full">
        {(props.text || props.subtitle) && (
          <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-8" />
        )}
        <div className="rounded-2xl border border-gray-100 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-800/40">
          <div className={`grid ${gridCols}`}>
            {items.map((item, i) => (
              <StatCard
                key={item.id ?? item.label}
                item={item}
                showDivider={showDivider && i > 0}
              />
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section style={layoutStyle} className="w-full">
      {(props.text || props.subtitle) && (
        <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-8" />
      )}
      <div className={`grid gap-4 sm:gap-6 ${gridCols}`}>
        {items.map((item) => (
          <div
            key={item.id ?? item.label}
            className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900/50"
          >
            <StatIcon icon={item.icon} />
            <StatValue item={item} />
            <p className="mt-2 font-semibold text-gray-800 dark:text-gray-200">{item.label}</p>
            {item.description && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
