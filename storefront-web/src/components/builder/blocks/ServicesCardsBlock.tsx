import { Link } from 'react-router-dom'
import { Wrench, Clock, ArrowRight } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import {
  cardImageShapeClass,
  cardPaddingFromItemSize,
  columnsFromProps,
  iconBoxFromItemSize,
  iconBoxShapeClass,
  imageShapeFromProps,
  renderFeatureIcon,
  sectionGridColumnClass,
  sectionItemGap,
  sectionItemSize,
  thumbnailShapeClass,
} from '@/lib/sectionItemLayout'
import { imgUrl, cn } from '@/lib/utils'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
}

export default function ServicesCardsBlock({ site, style, props, liveItems }: Props) {
  const { storePath } = useVendor()
  const title = (props.title as string) || 'Our Services'
  const columns = columnsFromProps(props)
  const itemGap = sectionItemGap(props, 24)
  const itemSize = sectionItemSize(props, 160)
  const cardPad = cardPaddingFromItemSize(itemSize)
  const iconBox = iconBoxFromItemSize(itemSize)
  const imageShape = imageShapeFromProps(props)
  const layout = String(props.layout ?? 'grid')
  const isList = layout === 'list'

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

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {title && <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">{title}</h2>}
      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No services available yet</p>
        </div>
      ) : (
        <div className={cn(isList ? 'space-y-4 max-w-3xl mx-auto' : cn('grid', sectionGridColumnClass(columns)))} style={{ gap: itemGap }}>
          {items.map((item, i) => {
            const staticIcon = staticFeatures[i]?.icon || (item.meta as { icon?: string })?.icon
            const imageUrl = item.image_url || staticFeatures[i]?.image_url
            return (
              <div
                key={item.id}
                className={cn(
                  'builder-tile-card bg-white rounded-2xl border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col overflow-hidden',
                  isList && 'flex-row items-start gap-4',
                )}
                style={{ padding: cardPad }}
              >
                {imageUrl ? (
                  <img
                    src={imgUrl(imageUrl)}
                    alt=""
                    className={cn(
                      isList ? thumbnailShapeClass(imageShape) : cardImageShapeClass(imageShape),
                      isList ? 'mb-0' : 'mb-4',
                      !isList && imageShape === 'circle' && 'max-w-[180px]',
                    )}
                    style={isList ? { width: iconBox, height: iconBox } : { height: Math.round(itemSize * 0.5) }}
                    loading="lazy"
                  />
                ) : (
                  <div
                    className={cn(iconBoxShapeClass(imageShape), 'flex items-center justify-center', isList ? 'shrink-0 mb-0' : 'mb-4')}
                    style={{ width: iconBox, height: iconBox, backgroundColor: `${style.primary_color}15`, fontSize: Math.round(iconBox * 0.45) }}
                  >
                    {staticIcon ? renderFeatureIcon(staticIcon, '🛠️') : <Wrench className="w-6 h-6" style={{ color: style.primary_color }} />}
                  </div>
                )}
                <div className={cn(isList && 'flex-1 min-w-0 flex flex-col')}>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                {item.description && <p className="text-gray-500 text-sm flex-1 mb-4 line-clamp-3">{item.description}</p>}
                <div className="flex items-center justify-between mt-auto">
                  {item.price_formatted ? (
                    <span className="font-bold" style={{ color: style.primary_color }}>{item.price_formatted}</span>
                  ) : item.meta?.duration_minutes ? (
                    <span className="flex items-center gap-1 text-xs text-gray-400"><Clock className="w-3 h-3" />{Number(item.meta.duration_minutes)} min</span>
                  ) : <span />}
                  {item.url ? (
                    <Link to={storePath(item.url)} className="flex items-center gap-1 text-sm font-semibold hover:gap-2 transition-all" style={{ color: style.primary_color }}>
                      Book <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : (
                    <Link to={storePath('/services')} className="flex items-center gap-1 text-sm font-semibold hover:gap-2 transition-all" style={{ color: style.primary_color }}>
                      View <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
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
