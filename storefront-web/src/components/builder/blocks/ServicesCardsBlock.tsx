import { Link } from 'react-router-dom'
import { Wrench, Clock, ArrowRight } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import {
  iconBoxShapeClass,
  imageShapeFromProps,
  renderFeatureIcon,
  thumbnailShapeClass,
} from '@/lib/sectionItemLayout'
import {
  CATALOG_GRID_COL_CLASS,
  clampCatalogColumns,
  readCatalogCardLayout,
} from '@/lib/catalogCardLayout'
import { imgUrl, cn } from '@/lib/utils'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

export default function ServicesCardsBlock({ style, props, liveItems, blockId }: Props) {
  const { storePath } = useVendor()
  const title = (props.title as string) || 'Our Services'
  const layout = String(props.layout ?? 'grid')
  const isList = layout === 'list'
  const columns = isList ? 1 : clampCatalogColumns(props.columns, 3, 'services_cards')
  const cardLayout = readCatalogCardLayout(props, 'services_cards', { defaultColumns: 3 })
  const imageShape = imageShapeFromProps(props)

  const staticFeatures = (props.features as Array<{ title: string; desc: string; icon?: string; image_url?: string }> | undefined) || []

  const items = liveItems.length > 0
    ? liveItems
    : staticFeatures.map(f => ({
        id: f.title,
        title: f.title,
        description: f.desc,
        subtitle: null,
        image_url: f.image_url || null,
        price: null,
        price_formatted: null,
        rating: null,
        url: null,
        meta: { icon: f.icon },
      } as LiveItem))

  const iconBox = Math.max(40, Math.round(cardLayout.cardPadding * 2.5))

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {(title || blockId) && (
        <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title} as="h2" className="text-3xl font-bold text-gray-900 mb-10 text-center" />
      )}
      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No services available yet</p>
        </div>
      ) : (
        <div
          className={cn(
            isList ? 'space-y-4 max-w-3xl mx-auto' : cn('grid', CATALOG_GRID_COL_CLASS[columns] || CATALOG_GRID_COL_CLASS[3]),
          )}
          style={{ gap: cardLayout.itemGap }}
        >
          {items.map((item, i) => {
            const staticIcon = staticFeatures[i]?.icon || (item.meta as { icon?: string })?.icon
            const imageUrl = item.image_url || staticFeatures[i]?.image_url
            const titleClass = cardLayout.isMinimalCard
              ? 'text-sm font-medium text-gray-900 mb-1 line-clamp-1'
              : cardLayout.isCompactCard
                ? 'text-base font-semibold text-gray-900 mb-1 line-clamp-2'
                : 'text-lg font-semibold text-gray-900 mb-2'
            const descClass = cardLayout.isMinimalCard
              ? 'text-gray-500 text-xs flex-1 mb-2 line-clamp-2'
              : 'text-gray-500 text-sm flex-1 mb-4 line-clamp-3'

            const mediaNode = imageUrl ? (
              isList ? (
                <img
                  src={imgUrl(imageUrl)}
                  alt=""
                  className={thumbnailShapeClass(imageShape)}
                  style={{ width: iconBox, height: iconBox }}
                  loading="lazy"
                />
              ) : (
                <div
                  className="relative w-full overflow-hidden bg-gray-50 shrink-0"
                  style={{ paddingBottom: `${cardLayout.imageHeightPct}%` }}
                >
                  <img
                    src={imgUrl(imageUrl)}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )
            ) : isList ? (
              <div
                className={cn(iconBoxShapeClass(imageShape), 'flex items-center justify-center shrink-0')}
                style={{
                  width: iconBox,
                  height: iconBox,
                  backgroundColor: `${style.primary_color}15`,
                  fontSize: Math.round(iconBox * 0.45),
                }}
              >
                {staticIcon ? renderFeatureIcon(staticIcon, '🛠️') : <Wrench className="w-6 h-6" style={{ color: style.primary_color }} />}
              </div>
            ) : (
              <div
                className="relative w-full overflow-hidden shrink-0"
                style={{ paddingBottom: `${cardLayout.imageHeightPct}%`, backgroundColor: `${style.primary_color}12` }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  {staticIcon ? (
                    <span style={{ fontSize: Math.round(iconBox * 0.9) }}>{renderFeatureIcon(staticIcon, '🛠️')}</span>
                  ) : (
                    <Wrench className="w-10 h-10" style={{ color: style.primary_color }} />
                  )}
                </div>
              </div>
            )

            return (
              <div
                key={item.id}
                className={cn(
                  'builder-tile-card bg-white border border-gray-100 transition-all duration-200 flex flex-col overflow-hidden',
                  cardLayout.cardRadius,
                  cardLayout.isMinimalCard ? '' : 'hover:shadow-lg hover:-translate-y-1',
                  isList && 'flex-row items-start gap-4',
                  !isList && 'h-full',
                )}
                style={{ padding: isList ? cardLayout.cardPadding : undefined }}
              >
                {mediaNode}
                <div
                  className={cn(isList ? 'flex-1 min-w-0 flex flex-col' : 'flex flex-1 flex-col min-h-0')}
                  style={{ padding: isList ? 0 : cardLayout.cardPadding }}
                >
                  <h3 className={titleClass}>{item.title}</h3>
                  {item.description && !cardLayout.isMinimalCard && (
                    <p className={descClass}>{item.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-auto gap-2">
                    {item.price_formatted ? (
                      <span className={cn('font-bold', cardLayout.isMinimalCard ? 'text-sm' : 'text-base')} style={{ color: style.primary_color }}>
                        {item.price_formatted}
                      </span>
                    ) : item.meta?.duration_minutes && !cardLayout.isMinimalCard ? (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />{Number(item.meta.duration_minutes)} min
                      </span>
                    ) : <span />}
                    {cardLayout.showBookLink && (
                      item.url ? (
                        <Link to={storePath(item.url)} className="flex items-center gap-1 text-sm font-semibold hover:gap-2 transition-all shrink-0" style={{ color: style.primary_color }}>
                          {cardLayout.isMinimalCard ? 'Book' : 'Book'} <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      ) : (
                        <Link to={storePath('/services')} className="flex items-center gap-1 text-sm font-semibold hover:gap-2 transition-all shrink-0" style={{ color: style.primary_color }}>
                          View <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
