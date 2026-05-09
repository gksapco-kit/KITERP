import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
}

export default function StatsBlock({ style, props, liveItems }: Props) {
  const title = (props.title as string) || ''

  const items = liveItems.length > 0
    ? liveItems.map(item => ({ value: item.title, label: item.subtitle || '' }))
    : ((props.stats as Array<{ value: string; label: string }> | undefined) || [])

  if (items.length === 0) return null

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {title && <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">{title}</h2>}
      <div className={`grid grid-cols-2 ${items.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-8 text-center`}>
        {items.map((stat, i) => (
          <div key={i} className="p-6 bg-white rounded-2xl border border-gray-100">
            <div className="text-4xl font-bold mb-2" style={{ color: style.primary_color }}>{stat.value}</div>
            <div className="text-gray-500 text-sm font-medium">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
