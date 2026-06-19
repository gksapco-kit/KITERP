import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import { getRecent } from '@/lib/recentlyViewed'
import { useVendor } from '@/contexts/VendorContext'
import {
  CATALOG_GRID_COL_CLASS,
  clampCatalogColumns,
  readCatalogCardLayout,
} from '@/lib/catalogCardLayout'

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
  const { storePath } = useVendor()
  const max = Math.min(200, Math.max(1, Number(props.max ?? props.show_count ?? 6) || 6))
  const columns = clampCatalogColumns(props.columns, 6, 'recently_viewed')
  const cardLayout = readCatalogCardLayout(props, 'recently_viewed', { defaultColumns: 6 })
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
      <ul
        className={`grid list-none p-0 ${CATALOG_GRID_COL_CLASS[columns] || CATALOG_GRID_COL_CLASS[6]}`}
        style={{ gap: cardLayout.itemGap }}
      >
        {items.map(item => (
          <li key={item.id || item.title} className="group">
            <Link to={item.url ? storePath(item.url) : storePath('/products')} className="block">
              <div
                className={`relative w-full overflow-hidden bg-gray-100 mb-2 border border-gray-200/60 group-hover:border-gray-300 transition-colors ${cardLayout.cardRadius}`}
                style={{ paddingBottom: `${cardLayout.imageHeightPct}%` }}
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">No image</div>
                )}
              </div>
              <div style={{ padding: Math.max(0, cardLayout.cardPadding - 8) }}>
                <p
                  className={`font-medium line-clamp-2 mb-1 ${cardLayout.isMinimalCard ? 'text-xs' : 'text-sm'}`}
                  style={{ color: style.text_color }}
                >
                  {item.title}
                </p>
                {item.price_formatted && (
                  <p className={`text-gray-500 ${cardLayout.isMinimalCard ? 'text-[10px]' : 'text-xs'}`}>
                    {item.price_formatted}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
