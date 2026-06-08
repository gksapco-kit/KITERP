import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { cn } from '@/lib/utils'
import { resolveSectionSurface } from '@/lib/navBlockLayout'
import { columnsFromProps, sectionGridColumnClass, sectionItemGap } from '@/lib/sectionItemLayout'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
}

export default function StatsBlock({ style, props, liveItems }: Props) {
  const title = (props.title as string) || ''
  const surface = resolveSectionSurface(props, style)
  const columns = columnsFromProps(props)
  const itemGap = sectionItemGap(props, 32)
  const cardStyle = String(props.card_style ?? '')
  const showDividers = props.show_dividers === true

  const items = liveItems.length > 0
    ? liveItems.map(item => ({ value: item.title, label: item.subtitle || '' }))
    : ((props.stats as Array<{ value: string; label: string }> | undefined) || [])

  if (items.length === 0) {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto" style={{ background: surface.background, color: surface.color }}>
        <BlockEmptyPlaceholder
          style={style}
          title={title || 'Your highlights'}
          message="Add stats like happy customers, products sold, or years in business — or connect live store data."
        />
      </section>
    )
  }

  const colClass = sectionGridColumnClass(columns)

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" style={{ background: surface.background, color: surface.color }}>
      {title && <h2 className="text-3xl font-bold mb-10 text-center">{title}</h2>}
      <div className={cn('grid grid-cols-2 text-center', colClass, showDividers && 'divide-x divide-white/10')} style={{ gap: itemGap }}>
        {items.map((stat, i) => (
          <div
            key={i}
            className={cn(
              cardStyle === 'card' && 'builder-tile-card p-6 rounded-2xl border',
              surface.isDark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-white/80',
            )}
          >
            <div className="text-4xl font-bold mb-2" style={{ color: surface.isDark ? '#fff' : style.primary_color }}>{stat.value}</div>
            <div className={cn('text-sm font-medium', surface.isDark ? 'text-white/70' : 'text-gray-500')}>{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
