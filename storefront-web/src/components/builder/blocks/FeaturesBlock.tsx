import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { imgUrl } from '@/lib/utils'
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

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockType: string
}

export default function FeaturesBlock({ site, style, props, blockType }: Props) {
  const isAlternating = blockType === 'features_alternating'
  const useTemplateReplacement = isAlternating && isTemplateMealFeaturesBlock(props)
  const replacement = useTemplateReplacement ? productFocusedFeatureContent(site.name) : null

  const title = sanitizeWellnessBodyCopy(
    (useTemplateReplacement ? replacement?.title : (props.title as string)) || '',
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
        {title && (
          <h2
            className="text-3xl sm:text-4xl font-semibold text-center mb-12 sm:mb-16 text-balance px-6"
            style={{ fontFamily: style.font_heading, color: sectionText }}
          >
            {title}
          </h2>
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
                      <img
                        src={imgUrl(imageSrc)}
                        alt={featTitle}
                        className={`relative z-10 ${imgClass}`}
                        loading="lazy"
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
  const colClass = layout === 'grid-2' ? 'grid-cols-1 sm:grid-cols-2' :
    layout === 'grid-4' ? 'grid-cols-2 sm:grid-cols-4' :
    'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {title && <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">{title}</h2>}
      <div className={`grid ${colClass} gap-6`}>
        {features.map((feature, i) => (
          <div key={i} className="builder-tile-card bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-md transition-shadow max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-2xl" style={{ backgroundColor: `${style.primary_color}15` }}>
              {feature.icon === 'Zap' ? '⚡' : feature.icon === 'Shield' ? '🛡️' : feature.icon === 'Star' ? '⭐' : feature.icon === 'Clock' ? '⏱️' : '✨'}
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">{sanitizeWellnessBodyCopy(feature.title)}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{sanitizeWellnessBodyCopy(feature.desc || feature.description)}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
