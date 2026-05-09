import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

export default function TimelineBlock({ style, props }: Props) {
  const title = (props.title as string) || 'Our Journey'
  const items = (props.items as Array<{ year: string; title: string; desc: string }> | undefined) || []
  if (items.length === 0) return null
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {title && <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">{title}</h2>}
      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-100" />
        <div className="space-y-8">
          {items.map((item, i) => (
            <div key={i} className="flex gap-6 items-start relative">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xs shrink-0 z-10" style={{ backgroundColor: style.primary_color }}>{item.year}</div>
              <div className="pt-3">
                <h3 className="font-semibold text-gray-900">{item.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
