import type { CSSProperties } from 'react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { cn } from '@/lib/utils'
import { imgUrl } from '@/lib/utils'
import { resolveSectionSurface } from '@/lib/navBlockLayout'
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
import {
  alternatingImageClassNames,
  alternatingRowFlip,
} from '@/lib/alternatingFeatureLayout'
import {
  isTemplateMealFeaturesBlock,
  productFocusedFeatureContent,
  resolveWellnessFeatureImage,
  sanitizeWellnessBodyCopy,
} from '@/lib/wellnessTemplateCopy'

interface FeatureItem { icon?: string; title: string; desc?: string; description?: string; image_url?: string }

function FeatureItemImage({
  feature,
  index,
  blockId,
  blockProps,
  className,
  style,
}: {
  feature: FeatureItem
  index: number
  blockId?: string
  blockProps: Record<string, unknown>
  className?: string
  style?: CSSProperties
}) {
  if (!feature.image_url) return null
  const src = imgUrl(feature.image_url)
  if (blockId) {
    return (
      <BuilderSectionImage
        blockId={blockId}
        field="image_url"
        arrayKey="features"
        index={index}
        itemField="image_url"
        blockProps={blockProps}
        src={src}
        alt=""
        className={className}
        style={style}
      />
    )
  }
  return <img src={src} alt="" className={className} style={style} loading="lazy" />
}

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockType: string
  blockId?: string
}

export default function FeaturesBlock({ site, style, props, blockType, blockId }: Props) {
  const isAlternating = blockType === 'features_alternating'
  const useTemplateReplacement = isAlternating && isTemplateMealFeaturesBlock(props)
  const replacement = useTemplateReplacement ? productFocusedFeatureContent(site.name) : null

  const title = sanitizeWellnessBodyCopy(
    (useTemplateReplacement ? replacement?.title : (props.title as string)) || '',
  )
  const sectionTitle = (className: string, extraStyle?: CSSProperties) => (
    (title || blockId) ? (
      <BuilderTextField
        fieldKey="title"
        blockId={blockId}
        blockProps={props}
        value={title}
        as="h2"
        className={className}
        style={extraStyle}
        placeholder="Section title"
      />
    ) : null
  )
  const rawFeatures = (props.features as FeatureItem[] | undefined) || []
  const features = useTemplateReplacement && replacement
    ? replacement.features
    : rawFeatures

  const textColor = style.text_color || '#182E20'
  const bg = style.bg_color || '#F9F9F5'
  const altIcons = ['🥗', '🌿', '✨', '🍃', '🛡️', '🌟']

  if (isAlternating) {
    const imageShape = String(props.image_shape ?? 'rounded')
    const useIcons = props.use_icons === true
    const showNumbers = props.show_numbers === true
    const isCard = props.card_style === 'card'
    const isDark = props.bg_style === 'dark'
    const isFull = String(props.layout ?? '') === 'full'
    const isCompact = props.compact === true
    const imagePos = props.image_position === 'right' ? 'right' : 'left'
    const sectionBg = isDark ? '#0f172a' : bg
    const sectionText = isDark ? '#f8fafc' : textColor
    const rowGap = isCompact ? 'space-y-10 sm:space-y-12' : 'space-y-16 sm:space-y-24'
    const imgClass = alternatingImageClassNames({
      imageShape,
      useIcons,
      compact: isCompact,
      fullBleed: isFull,
    })

    return (
      <section
        className={`py-16 sm:py-24 px-6 sm:px-12 mx-auto ${isFull ? 'max-w-none px-0 sm:px-0' : 'max-w-6xl'}`}
        style={{ backgroundColor: sectionBg }}
      >
        {sectionTitle(
          'text-3xl sm:text-4xl font-semibold text-center mb-12 sm:mb-16 text-balance px-6',
          { fontFamily: style.font_heading, color: sectionText },
        )}
        <div className={rowGap}>
          {features.map((feature, i) => {
            const featTitle = sanitizeWellnessBodyCopy(feature.title)
            const featDesc = sanitizeWellnessBodyCopy(feature.desc || feature.description || '')
            const imageSrc = resolveWellnessFeatureImage(feature, i)
            const flip = alternatingRowFlip(i, imagePos, useIcons)
            const row = (
              <div
                className={`flex flex-col gap-8 lg:gap-12 items-center ${flip ? 'lg:flex-row-reverse' : 'lg:flex-row'} ${isFull ? 'px-0' : ''}`}
              >
                <div className={`w-full lg:w-1/2 ${imageShape === 'circle' ? 'flex justify-center lg:justify-start' : ''}`}>
                  {useIcons ? (
                    <div className={`rounded-full flex items-center justify-center text-3xl sm:text-4xl bg-primary/10 animate-pulse mx-auto lg:mx-0 ${isCompact ? 'w-20 h-20' : 'w-24 h-24 sm:w-28 sm:h-28'}`}>
                      {feature.icon || altIcons[i % altIcons.length]}
                    </div>
                  ) : (
                    <div className="relative mx-auto max-w-md lg:max-w-none">
                      {imageShape === 'circle' && (
                        <div className="absolute inset-4 rounded-full bg-primary/20 blur-2xl animate-pulse pointer-events-none" />
                      )}
                      {imageShape !== 'circle' && imageShape !== 'square' && !isFull && (
                        <div
                          className="absolute -inset-3 rounded-[2rem] opacity-50 -z-0"
                          style={{ backgroundColor: `${style.accent_color || '#E07A5F'}25` }}
                        />
                      )}
                      <FeatureItemImage
                        feature={{ ...feature, image_url: imageSrc }}
                        index={i}
                        blockId={blockId}
                        blockProps={props}
                        className={`relative z-10 ${imgClass}`}
                      />
                    </div>
                  )}
                </div>
                <div className="w-full lg:w-1/2 space-y-4 text-center lg:text-left px-6 lg:px-0">
                  {showNumbers && (
                    <span className={`inline-flex w-8 h-8 rounded-full items-center justify-center text-xs font-bold ${isDark ? 'bg-white/15 text-white' : 'bg-primary/15'}`} style={{ color: isDark ? '#fff' : style.primary_color }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  )}
                  <h3
                    className="text-2xl sm:text-3xl font-semibold"
                    style={{ fontFamily: style.font_heading, color: sectionText }}
                  >
                    {featTitle}
                  </h3>
                  <p className="text-base sm:text-lg leading-relaxed opacity-80" style={{ color: sectionText }}>
                    {featDesc}
                  </p>
                </div>
              </div>
            )
            if (isCard) {
              return (
                <div key={i} className={`builder-tile-card rounded-2xl border p-5 sm:p-6 mx-6 lg:mx-0 ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-white shadow-sm'}`}>
                  {row}
                </div>
              )
            }
            return <div key={i}>{row}</div>
          })}
        </div>
      </section>
    )
  }

  const layout = (props.layout as string) || 'grid-3'
  const surface = resolveSectionSurface(props, style)
  const showImages = props.show_images === true || features.some(f => !!f.image_url)
  const cardStyle = String(props.card_style ?? '')
  const iconTop = props.icon_position === 'top'
  const columns = columnsFromProps(props, layout)
  const itemGap = sectionItemGap(props, 24)
  const itemSize = sectionItemSize(props, 160)
  const cardPad = cardPaddingFromItemSize(itemSize)
  const iconBox = iconBoxFromItemSize(itemSize)
  const imageShape = imageShapeFromProps(props)

  if (layout === 'list') {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto" style={{ background: surface.background, color: surface.color }}>
        {sectionTitle('text-3xl font-bold mb-10 text-center')}
        <div className="space-y-6" style={{ gap: itemGap }}>
          {features.map((feature, i) => (
            <div
              key={i}
              className={cn('flex gap-4 items-start rounded-2xl border', surface.isDark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-white')}
              style={{ padding: cardPad }}
            >
              {feature.image_url ? (
                <FeatureItemImage
                  feature={feature}
                  index={i}
                  blockId={blockId}
                  blockProps={props}
                  className={thumbnailShapeClass(imageShape)}
                  style={{ width: iconBox, height: iconBox }}
                />
              ) : (
                <div className={cn(iconBoxShapeClass(imageShape), 'flex items-center justify-center shrink-0 text-2xl')} style={{ width: iconBox, height: iconBox, backgroundColor: `${style.primary_color}15` }}>
                  {renderFeatureIcon(feature.icon, altIcons[i % altIcons.length])}
                </div>
              )}
              <div>
                <h3 className="font-semibold mb-1">{sanitizeWellnessBodyCopy(feature.title)}</h3>
                <p className={cn('text-sm leading-relaxed', surface.isDark ? 'text-white/70' : 'text-gray-500')}>{sanitizeWellnessBodyCopy(feature.desc || feature.description)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (layout === 'strip') {
    return (
      <section className="py-12 px-4 overflow-x-auto" style={{ background: surface.background, color: surface.color }}>
        {sectionTitle('text-2xl font-bold mb-8 text-center px-4')}
        <div className="flex min-w-max px-4 mx-auto justify-center" style={{ gap: itemGap }}>
          {features.map((feature, i) => (
            <div
              key={i}
              className={cn('builder-tile-card shrink-0 w-56 rounded-2xl border', surface.isDark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-white')}
              style={{ padding: cardPad }}
            >
              <div className="text-2xl mb-2">{renderFeatureIcon(feature.icon, '✨')}</div>
              <h3 className="font-semibold text-sm mb-1">{sanitizeWellnessBodyCopy(feature.title)}</h3>
              <p className={cn('text-xs leading-relaxed', surface.isDark ? 'text-white/70' : 'text-gray-500')}>{sanitizeWellnessBodyCopy(feature.desc || feature.description)}</p>
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (layout === 'masonry') {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" style={{ background: surface.background, color: surface.color }}>
        {sectionTitle('text-3xl font-bold mb-10 text-center')}
        <div className={cn('columns-1 sm:columns-2 gap-6 space-y-6', columns >= 3 && 'lg:columns-3', columns >= 4 && 'lg:columns-4')} style={{ columnGap: itemGap }}>
          {features.map((feature, i) => (
            <div key={i} className={cn('builder-tile-card break-inside-avoid rounded-2xl border mb-6', surface.isDark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-white')} style={{ padding: cardPad }}>
              {showImages && feature.image_url && (
                <FeatureItemImage
                  feature={feature}
                  index={i}
                  blockId={blockId}
                  blockProps={props}
                  className={cn(cardImageShapeClass(imageShape), 'h-32 mb-3', imageShape === 'circle' && 'max-w-[140px]')}
                />
              )}
              <h3 className="font-semibold mb-2">{sanitizeWellnessBodyCopy(feature.title)}</h3>
              <p className={cn('text-sm leading-relaxed', surface.isDark ? 'text-white/70' : 'text-gray-500')}>{sanitizeWellnessBodyCopy(feature.desc || feature.description)}</p>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" style={{ background: surface.background, color: surface.color }}>
      {sectionTitle('text-3xl font-bold mb-10 text-center')}
      <div className={cn('grid', sectionGridColumnClass(columns))} style={{ gap: itemGap }}>
        {features.map((feature, i) => (
          <div
            key={i}
            className={cn(
              'builder-tile-card rounded-2xl hover:shadow-md transition-shadow',
              cardStyle === 'bordered' ? 'border-2' : 'border',
              surface.isDark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-white',
              iconTop ? 'text-center' : '',
            )}
            style={{ padding: cardPad }}
          >
            {showImages && feature.image_url && (
              <FeatureItemImage
                feature={feature}
                index={i}
                blockId={blockId}
                blockProps={props}
                className={cn(cardImageShapeClass(imageShape), 'mb-4', imageShape === 'circle' && 'max-w-[180px]')}
                style={{ height: imageShape === 'circle' ? iconBox : Math.round(itemSize * 0.55) }}
              />
            )}
            {!feature.image_url && (
              <div
                className={cn(iconBoxShapeClass(imageShape), 'flex items-center justify-center mb-4', iconTop && 'mx-auto')}
                style={{ width: iconBox, height: iconBox, backgroundColor: `${style.primary_color}15`, fontSize: Math.round(iconBox * 0.45) }}
              >
                {renderFeatureIcon(feature.icon, altIcons[i % altIcons.length])}
              </div>
            )}
            <h3 className="font-semibold mb-2">{sanitizeWellnessBodyCopy(feature.title)}</h3>
            <p className={cn('text-sm leading-relaxed', surface.isDark ? 'text-white/70' : 'text-gray-500')}>{sanitizeWellnessBodyCopy(feature.desc || feature.description)}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
