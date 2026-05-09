import { useEffect, useState } from 'react'
import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import { getRecent } from '@/lib/recentlyViewed'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
}

/**
 * Renders the most recent products the visitor has opened on this device.
 * Backed entirely by localStorage; renders nothing on a fresh visit so we
 * don't ship an empty section.
 */
export default function RecentlyViewedBlock({ style, props }: Props) {
  const max = Number(props.max ?? 6) || 6
  const [items, setItems] = useState<LiveItem[]>([])

  useEffect(() => {
    setItems(getRecent(max))
  }, [max])

  if (!items.length) return null

  const title = (props.title as string) || 'Recently Viewed'

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto" aria-label={title}>
      <h2
        className="text-2xl sm:text-3xl font-bold mb-6"
        style={{ fontFamily: style.font_heading, color: style.text_color }}
      >
        {title}
      </h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 list-none p-0">
        {items.map(item => (
          <li key={item.id || item.title} className="group">
            <a href={item.url || '#'} className="block">
              <div
                className="aspect-square overflow-hidden rounded-xl bg-gray-100 mb-2 border border-gray-200/60 group-hover:border-gray-300 transition-colors"
                style={{ borderRadius: style.border_radius === 'rounded-full' ? '9999px' : undefined }}
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No image</div>
                )}
              </div>
              <p className="text-sm font-medium line-clamp-2 mb-1" style={{ color: style.text_color }}>
                {item.title}
              </p>
              {item.price_formatted && (
                <p className="text-xs text-gray-500">{item.price_formatted}</p>
              )}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
