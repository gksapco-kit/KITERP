import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { getRecent, catalogPathFromStoredUrl } from '@/lib/recentlyViewed'
import { builderSectionContainerClass, builderSectionContainerWithMax } from '@/lib/builderSectionLayout'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'
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
  blockId?: string
}

/**
 * Renders the most recent products the visitor has opened on this device.
 * Backed entirely by localStorage; renders nothing on a fresh visit so we
 * don't ship an empty section.
 */
export default function RecentlyViewedBlock({ style, props, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const { storePath, vendorSlug } = useVendor()
  const max = Math.min(200, Math.max(1, Number(props.max ?? props.show_count ?? 6) || 6))
  const columns = clampCatalogColumns(props.columns, 6, 'recently_viewed')
  const cardLayout = readCatalogCardLayout(props, 'recently_viewed', { defaultColumns: 6 })
  const [items, setItems] = useState<LiveItem[]>([])

  useEffect(() => {
    setItems(getRecent(max, vendorSlug))
  }, [max, vendorSlug])

  const title = resolveBlockTextField(props, 'title')
  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)

  if (!items.length && !isEditorCanvas) return null

  return (
    <section className={builderSectionContainerWithMax('max-w-6xl')} aria-label={title ?? undefined}>
      {showTitle && (
        <BuilderTextField
          fieldKey="title"
          blockId={blockId}
          blockProps={props}
          value={title ?? ''}
          as="h2"
          className="text-2xl sm:text-3xl font-bold mb-6"
          style={{ fontFamily: style.font_heading, color: style.text_color }}
          placeholder="Section title"
        />
      )}
      <ul
        className={`grid list-none p-0 ${CATALOG_GRID_COL_CLASS[columns] || CATALOG_GRID_COL_CLASS[6]}`}
        style={{ gap: cardLayout.itemGap }}
      >
        {items.map(item => {
          const catalogPath = catalogPathFromStoredUrl(item.url)
          const href = catalogPath ? storePath(catalogPath) : storePath('/products')
          return (
          <li key={item.id || item.title} className="group">
            <Link to={href} className="block">
              <div
                className={`relative w-full overflow-hidden bg-gray-50 mb-2 border border-gray-200/60 group-hover:border-gray-300 transition-colors ${cardLayout.cardRadius}`}
                style={{ paddingBottom: `${cardLayout.imageHeightPct}%` }}
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-contain object-center p-2"
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
          )
        })}
      </ul>
    </section>
  )
}
