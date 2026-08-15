import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { ProductThumb } from '@/components/products/ProductThumb'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { getRecent, catalogPathFromStoredUrl } from '@/lib/recentlyViewed'
import { builderSectionContainerWithMax } from '@/lib/builderSectionLayout'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'
import { useVendor } from '@/contexts/VendorContext'
import { cn } from '@/lib/utils'
import {
  CATALOG_GRID_COL_CLASS,
  catalogGridColClassForBreakpoint,
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
  const previewBp = isEditorCanvas ? (builderCanvas?.previewBreakpoint ?? 'desktop') : 'desktop'
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
        className={`grid list-none p-0 ${
          isEditorCanvas
            ? catalogGridColClassForBreakpoint(columns, previewBp)
            : (CATALOG_GRID_COL_CLASS[columns] || CATALOG_GRID_COL_CLASS[6])
        }`}
        style={{ gap: cardLayout.itemGap }}
      >
        {items.map(item => {
          const catalogPath = catalogPathFromStoredUrl(item.url)
          const href = catalogPath ? storePath(catalogPath) : storePath('/products')
          return (
            <li key={item.id || item.title} className="group">
              <Link
                to={href}
                className="block overflow-hidden rounded-lg border border-border bg-card text-card-foreground transition-shadow hover:shadow-md"
              >
                <div
                  className={cn(
                    'relative w-full overflow-hidden bg-muted aspect-square',
                    cardLayout.cardRadius,
                  )}
                >
                  <ProductThumb
                    src={item.image_url}
                    alt={item.title}
                    className="absolute inset-0"
                    imgClassName="object-cover object-center p-0 transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div style={{ padding: Math.max(8, cardLayout.cardPadding - 2) }}>
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
