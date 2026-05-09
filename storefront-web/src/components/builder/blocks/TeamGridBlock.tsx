import { Users } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

export default function TeamGridBlock({ style, props, liveItems }: Props) {
  const title = (props.title as string) || 'Our Team'
  const columns = Math.min(Math.max(Number(props.columns ?? 4), 2), 4)
  const colClass: Record<number, string> = { 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' }
  const items = liveItems.length > 0 ? liveItems : []
  if (items.length === 0) return null
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {title && <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">{title}</h2>}
      <div className={`grid ${colClass[columns] || colClass[4]} gap-6`}>
        {items.map(member => (
          <div key={member.id} className="text-center">
            {member.image_url ? (
              <img src={member.image_url} alt={member.title} className="w-24 h-24 rounded-full mx-auto mb-3 object-cover" loading="lazy" />
            ) : (
              <div className="w-24 h-24 rounded-full mx-auto mb-3 flex items-center justify-center text-white text-2xl font-bold" style={{ backgroundColor: style.primary_color }}>
                {member.title.charAt(0)}
              </div>
            )}
            <h3 className="font-semibold text-gray-900">{member.title}</h3>
            {member.subtitle && <p className="text-sm text-gray-400">{member.subtitle}</p>}
            {member.description && <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">{member.description}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}
