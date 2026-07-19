import { Link } from 'react-router-dom'
import { Wrench, Clock, ArrowRight } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { shouldShowServiceBookCta } from '@/lib/serviceStorefrontCta'
import {
  iconBoxShapeClass,
  imageShapeFromProps,
  renderFeatureIcon,
  thumbnailShapeClass,
} from '@/lib/sectionItemLayout'
import { builderSectionContainerClass, builderSectionContainerWithMax } from '@/lib/builderSectionLayout'
import {
  catalogGridColClassForBreakpoint,
  clampCatalogColumns,
  readCatalogCardLayout,
} from '@/lib/catalogCardLayout'
import { imgUrl, cn } from '@/lib/utils'
import { resolveServiceThumbnailUrl } from '@/lib/productImageUtils'
import {
  arrayImageDeleteFieldKey,
  isBlockFieldHidden,
  isNestedBlockFieldHidden,
  resolveBlockTextField,
  visibleArrayEntries,
} from '@/lib/blockHiddenFields'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

type FeatureItem = { title: string; desc: string; icon?: string; image_url?: string }

export default function ServicesCardsBlock({ style, props, liveItems, blockId }: Props) {
  const { storePath, displayFields } = useVendor()
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const previewBp = isEditorCanvas ? (builderCanvas?.previewBreakpoint ?? 'desktop') : 'desktop'

  const title = resolveBlockTextField(props, 'title')
  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)

  const layout = String(props.layout ?? 'grid')
  const isList = layout === 'list'
  const columns = isList ? 1 : clampCatalogColumns(props.columns, 3, 'services_cards')
  const gridColClass = catalogGridColClassForBreakpoint(columns, previewBp)
  const cardLayout = readCatalogCardLayout(props, 'services_cards', { defaultColumns: 3 })
  const imageShape = imageShapeFromProps(props)

  const staticFeaturesRaw = (props.features as FeatureItem[] | undefined) || []
  const visibleStatic = visibleArrayEntries(staticFeaturesRaw, props, 'features')
  const useLive = liveItems.length > 0

  const items = useLive
    ? liveItems
    : visibleStatic.map(({ item: f, index }) => ({
        id: String(index),
        title: f.title,
        description: f.desc,
        subtitle: null,
        image_url: f.image_url || null,
        price: null,
        price_formatted: null,
        rating: null,
        url: null,
        meta: { icon: f.icon },
        _staticIndex: index,
      } as LiveItem & { _staticIndex: number }))

  const iconBox = Math.max(40, Math.round(cardLayout.cardPadding * 2.5))

  const renderStaticImage = (feature: FeatureItem, index: number, listMode: boolean) => {
    const imageHidden = isBlockFieldHidden(props, arrayImageDeleteFieldKey('features', index, 'image_url'))
    if (imageHidden && !isEditorCanvas) return null

    const imageUrl = feature.image_url
    if (imageUrl || (isEditorCanvas && !imageHidden)) {
      const src = imageUrl ? imgUrl(imageUrl) : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
      if (blockId && !imageHidden) {
        const imgNode = (
          <BuilderSectionImage
            blockId={blockId}
            field="image_url"
            arrayKey="features"
            index={index}
            itemField="image_url"
            blockProps={props}
            src={src}
            alt=""
            empty={!imageUrl}
            className={listMode ? 'absolute inset-0 w-full h-full object-cover' : 'absolute inset-0 w-full h-full object-cover'}
          />
        )
        if (listMode) {
          return (
            <div className={cn('relative overflow-hidden shrink-0', thumbnailShapeClass(imageShape))} style={{ width: iconBox, height: iconBox }}>
              {imgNode}
            </div>
          )
        }
        return (
          <div className="relative w-full overflow-hidden bg-gray-50 shrink-0" style={{ paddingBottom: `${cardLayout.imageHeightPct}%` }}>
            {imgNode}
          </div>
        )
      }
      if (!imageUrl) return null
      if (listMode) {
        return (
          <img
            src={imgUrl(imageUrl)}
            alt=""
            className={thumbnailShapeClass(imageShape)}
            style={{ width: iconBox, height: iconBox }}
            loading="lazy"
          />
        )
      }
      return (
        <div className="relative w-full overflow-hidden bg-gray-50 shrink-0" style={{ paddingBottom: `${cardLayout.imageHeightPct}%` }}>
          <img src={imgUrl(imageUrl)} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        </div>
      )
    }

    if (listMode) {
      return (
        <div
          className={cn(iconBoxShapeClass(imageShape), 'flex items-center justify-center shrink-0')}
          style={{
            width: iconBox,
            height: iconBox,
            backgroundColor: `${style.primary_color}15`,
            fontSize: Math.round(iconBox * 0.45),
          }}
        >
          {feature.icon ? renderFeatureIcon(feature.icon, '🛠️') : <Wrench className="w-6 h-6" style={{ color: style.primary_color }} />}
        </div>
      )
    }
    return (
      <div
        className="relative w-full overflow-hidden shrink-0"
        style={{ paddingBottom: `${cardLayout.imageHeightPct}%`, backgroundColor: `${style.primary_color}12` }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {feature.icon ? (
            <span style={{ fontSize: Math.round(iconBox * 0.9) }}>{renderFeatureIcon(feature.icon, '🛠️')}</span>
          ) : (
            <Wrench className="w-10 h-10" style={{ color: style.primary_color }} />
          )}
        </div>
      </div>
    )
  }

  return (
    <section className={builderSectionContainerClass()}>
      {showTitle && (
        <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title ?? ''} as="h2" className="text-3xl font-bold text-gray-900 mb-10 text-center" placeholder="Section title" />
      )}
      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No services available yet</p>
        </div>
      ) : (
        <div
          className={cn(
            isList ? 'space-y-4 max-w-3xl mx-auto' : cn('grid', gridColClass),
          )}
          style={{ gap: cardLayout.itemGap }}
        >
          {items.map((item, i) => {
            const staticIndex = !useLive ? (item as LiveItem & { _staticIndex?: number })._staticIndex ?? i : null
            const staticFeature = staticIndex != null ? staticFeaturesRaw[staticIndex] : undefined
            const staticIcon = staticFeature?.icon || (item.meta as { icon?: string })?.icon
            const titleClass = cardLayout.isMinimalCard
              ? 'text-sm font-medium text-gray-900 mb-1 line-clamp-1'
              : cardLayout.isCompactCard
                ? 'text-base font-semibold text-gray-900 mb-1 line-clamp-2'
                : 'text-lg font-semibold text-gray-900 mb-2'
            const descClass = cardLayout.isMinimalCard
              ? 'text-gray-500 text-xs flex-1 mb-2 line-clamp-2'
              : 'text-gray-500 text-sm flex-1 mb-4 line-clamp-3'

            const showItemTitle = useLive || staticIndex == null || !isNestedBlockFieldHidden(props, `features.${staticIndex}.title`)
            const showItemDesc = useLive || staticIndex == null || !isNestedBlockFieldHidden(props, `features.${staticIndex}.desc`)
            const itemMeta = (item.meta || {}) as Record<string, unknown>
            const showBookCta = cardLayout.showBookLink && (
              !useLive || shouldShowServiceBookCta(
                {
                  allow_quote_request: itemMeta.allow_quote_request as boolean | undefined,
                  requires_booking: itemMeta.requires_booking as boolean | undefined,
                },
                displayFields.service,
              )
            )

            const mediaNode = !useLive && staticFeature && staticIndex != null
              ? renderStaticImage(staticFeature, staticIndex, isList)
              : (() => {
                  const meta = (item.meta || {}) as {
                    icon?: string
                    media?: { url: string; is_primary?: boolean; media_type?: string }[]
                    gallery?: string[]
                  }
                  const imageUrl = resolveServiceThumbnailUrl({
                    image_url: item.image_url || staticFeature?.image_url,
                    media: meta.media,
                    gallery: meta.gallery,
                  })
                  if (imageUrl) {
                    if (isList) {
                      return (
                        <img
                          src={imgUrl(imageUrl)}
                          alt=""
                          className={thumbnailShapeClass(imageShape)}
                          style={{ width: iconBox, height: iconBox }}
                          loading="lazy"
                        />
                      )
                    }
                    return (
                      <div className="relative w-full overflow-hidden bg-gray-50 shrink-0" style={{ paddingBottom: `${cardLayout.imageHeightPct}%` }}>
                        <img src={imgUrl(imageUrl)} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                      </div>
                    )
                  }
                  if (isList) {
                    return (
                      <div
                        className={cn(iconBoxShapeClass(imageShape), 'flex items-center justify-center shrink-0')}
                        style={{ width: iconBox, height: iconBox, backgroundColor: `${style.primary_color}15`, fontSize: Math.round(iconBox * 0.45) }}
                      >
                        {staticIcon ? renderFeatureIcon(staticIcon, '🛠️') : <Wrench className="w-6 h-6" style={{ color: style.primary_color }} />}
                      </div>
                    )
                  }
                  return (
                    <div className="relative w-full overflow-hidden shrink-0" style={{ paddingBottom: `${cardLayout.imageHeightPct}%`, backgroundColor: `${style.primary_color}12` }}>
                      <div className="absolute inset-0 flex items-center justify-center">
                        {staticIcon ? (
                          <span style={{ fontSize: Math.round(iconBox * 0.9) }}>{renderFeatureIcon(staticIcon, '🛠️')}</span>
                        ) : (
                          <Wrench className="w-10 h-10" style={{ color: style.primary_color }} />
                        )}
                      </div>
                    </div>
                  )
                })()

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
                  {showItemTitle && (
                    !useLive && staticIndex != null && blockId ? (
                      <BuilderTextField
                        fieldKey={`features.${staticIndex}.title`}
                        blockId={blockId}
                        blockProps={props}
                        value={staticFeature?.title ?? ''}
                        as="h3"
                        className={titleClass}
                        placeholder="Service title"
                        skipPositionWrapper
                      />
                    ) : (
                      <h3 className={titleClass}>{item.title}</h3>
                    )
                  )}
                  {showItemDesc && item.description && !cardLayout.isMinimalCard && (
                    !useLive && staticIndex != null && blockId ? (
                      <BuilderTextField
                        fieldKey={`features.${staticIndex}.desc`}
                        blockId={blockId}
                        blockProps={props}
                        value={staticFeature?.desc ?? ''}
                        as="p"
                        multiline
                        className={descClass}
                        placeholder="Description"
                        skipPositionWrapper
                      />
                    ) : (
                      <p className={descClass}>{item.description}</p>
                    )
                  )}
                  {showItemDesc && !item.description && !useLive && staticIndex != null && blockId && !cardLayout.isMinimalCard && (
                    <BuilderTextField
                      fieldKey={`features.${staticIndex}.desc`}
                      blockId={blockId}
                      blockProps={props}
                      value={staticFeature?.desc ?? ''}
                      as="p"
                      multiline
                      className={descClass}
                      placeholder="Description"
                      skipPositionWrapper
                    />
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
                    {showBookCta && (
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
