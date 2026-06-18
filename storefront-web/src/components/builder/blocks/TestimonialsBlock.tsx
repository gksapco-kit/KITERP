import { Quote, Star } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { useVendor } from '@/contexts/VendorContext'
import { cn } from '@/lib/utils'
import { isLiveTestimonialsBound, isTemplateTestimonial } from '@/lib/testimonialPlaceholders'
import { resolveSectionSurface } from '@/lib/navBlockLayout'
import { columnsFromProps, sectionGridColumnClass, sectionItemGap } from '@/lib/sectionItemLayout'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

function builderPreviewTestimonials(count: number): LiveItem[] {
  const names = ['Alex R.', 'Jamie L.', 'Taylor M.', 'Sam K.']
  return Array.from({ length: count }, (_, i) => ({
    id: `preview-${i}`,
    title: names[i] || `Customer ${i + 1}`,
    subtitle: 'Verified customer',
    description: 'Your customer quote will appear here.',
    image_url: null,
    price: null,
    price_formatted: null,
    rating: 5,
    url: null,
    meta: {},
  }))
}

function staticTestimonialToLiveItem(t: {
  name: string
  role?: string
  company?: string
  quote: string
  rating?: number
  image_url?: string
  avatar_url?: string
}, index: number): LiveItem {
  return {
    id: t.name || `t-${index}`,
    title: t.name,
    subtitle: [t.role, t.company].filter(Boolean).join(', ') || null,
    description: t.quote,
    image_url: t.image_url || t.avatar_url || null,
    price: null,
    price_formatted: null,
    rating: t.rating ?? 5,
    url: null,
    meta: {},
  }
}

function TestimonialCard({
  item,
  style,
  dark,
  compact,
  largePhoto,
  blockId,
  blockProps,
  testimonialIndex,
}: {
  item: LiveItem
  style: StyleConfig
  dark?: boolean
  compact?: boolean
  largePhoto?: boolean
  blockId?: string
  blockProps?: Record<string, unknown>
  testimonialIndex?: number
}) {
  const avatarClass = largePhoto ? 'w-14 h-14' : 'w-10 h-10'

  return (
    <div className={cn(
      'builder-tile-card rounded-2xl border p-6 relative',
      dark ? 'border-white/10 bg-white/5' : 'bg-white border-gray-100',
      compact && 'p-4',
    )}>
      <Quote className="w-8 h-8 opacity-10 absolute top-4 right-4" style={{ color: style.primary_color }} />
      {item.rating != null && (
        <div className="flex gap-0.5 mb-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`w-4 h-4 ${i < (item.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
          ))}
        </div>
      )}
      <p className={cn('leading-relaxed mb-4', compact ? 'text-xs' : 'text-sm', dark ? 'text-white/80' : 'text-gray-600')}>
        "{item.description}"
      </p>
      <div className="flex items-center gap-3">
        {item.image_url && blockId && blockProps != null && testimonialIndex != null ? (
          <BuilderSectionImage
            blockId={blockId}
            field="image_url"
            arrayKey="testimonials"
            index={testimonialIndex}
            itemField="image_url"
            blockProps={blockProps}
            src={item.image_url}
            alt={item.title}
            className={cn(avatarClass, 'rounded-full object-cover')}
          />
        ) : item.image_url ? (
          <img src={item.image_url} alt={item.title} className={cn(avatarClass, 'rounded-full object-cover')} loading="lazy" />
        ) : (
          <div
            className={cn(avatarClass, 'rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0')}
            style={{ backgroundColor: style.primary_color }}
          >
            {item.title.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className={cn('font-semibold text-sm', dark ? 'text-white' : 'text-gray-900')}>{item.title}</p>
          {item.subtitle && <p className={cn('text-xs', dark ? 'text-white/60' : 'text-gray-400')}>{item.subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

export default function TestimonialsBlock({ style, props, liveItems, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const { previewShell } = useVendor()
  const isEditor = builderCanvas?.isEditorCanvas && !!blockId
  const showDraftPreviewFallback = isEditor || previewShell === true
  const blockProps = props
  const title = (props.title as string) || 'What Our Customers Say'
  const layout = String(props.layout ?? 'grid')
  const columns = columnsFromProps(props, layout === 'grid' ? 'grid-3' : layout)
  const itemGap = sectionItemGap(props, 24)
  const surface = resolveSectionSurface(props, style)
  const cardStyle = String(props.card_style ?? '')
  const compactCards = cardStyle === 'compact' || layout === 'list'
  const largePhotos = props.show_photos === true
  const liveBound = isLiveTestimonialsBound(props)
  const staticTestis = (props.testimonials as Array<{
    name: string; role?: string; company?: string; quote: string; rating?: number
  }> | undefined) || []
  const manualTestis = staticTestis.filter(t => !isTemplateTestimonial(t))

  const publishedItems = liveItems.length > 0
    ? liveItems
    : liveBound || staticTestis.some(isTemplateTestimonial)
      ? []
      : manualTestis.map(staticTestimonialToLiveItem)

  const previewCount = layout === 'centered' ? 1 : Math.min(Math.max(columns, 2), 4)

  const layoutSampleItems =
    manualTestis.length > 0
      ? manualTestis.map(staticTestimonialToLiveItem)
      : builderPreviewTestimonials(previewCount)

  // Draft / editor preview always shows sample cards when there is no published content.
  const showLayoutSampleOnLive =
    liveBound && liveItems.length === 0
    || (staticTestis.some(isTemplateTestimonial) && manualTestis.length === 0)

  const draftPreviewItems = showDraftPreviewFallback || showLayoutSampleOnLive
    ? layoutSampleItems
    : []

  const displayItems = publishedItems.length > 0 ? publishedItems : draftPreviewItems
  const showingLayoutPreview = isEditor && previewShell !== true && publishedItems.length === 0 && displayItems.length > 0

  const sectionTitle = (className: string) => (
    (title || blockId) ? (
      <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title} as="h2" className={className} />
    ) : null
  )

  const previewHint = showingLayoutPreview ? (
    <p className={cn(
      'text-xs text-center mb-8 max-w-lg mx-auto leading-relaxed',
      surface.isDark ? 'text-white/55' : 'text-gray-400',
    )}>
      Layout preview — add reviews in Section Edit or connect live testimonials from your catalog.
    </p>
  ) : null

  if (displayItems.length === 0) {
    return (
      <section className="px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto text-center" style={{ background: surface.background, color: surface.color }}>
        <BlockEmptyPlaceholder
          style={style}
          title={title}
          message="Customer quotes will appear here. Edit the sample reviews in the builder or connect live testimonials from your catalog."
        />
      </section>
    )
  }

  const colClass = sectionGridColumnClass(columns)
  const dark = surface.isDark
  const masonryColumnClass = columns >= 3
    ? 'columns-1 sm:columns-2 lg:columns-3'
    : 'columns-1 sm:columns-2'

  if (layout === 'centered') {
    const item = displayItems[0]
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto text-center" style={{ background: surface.background, color: surface.color }}>
        {sectionTitle('text-3xl font-bold mb-4')}
        {previewHint}
        <TestimonialCard
          item={item}
          style={style}
          dark={dark}
          compact={compactCards}
          largePhoto={largePhotos}
          blockId={blockId}
          blockProps={blockProps}
          testimonialIndex={0}
        />
      </section>
    )
  }

  if (layout === 'list') {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto" style={{ background: surface.background, color: surface.color }}>
        {sectionTitle('text-3xl font-bold mb-4 text-center')}
        {previewHint}
        <div className="space-y-4" style={{ gap: itemGap }}>
          {displayItems.map((item, i) => (
            <TestimonialCard
              key={item.id}
              item={item}
              style={style}
              dark={dark}
              compact
              largePhoto={largePhotos}
              blockId={blockId}
              blockProps={blockProps}
              testimonialIndex={i}
            />
          ))}
        </div>
      </section>
    )
  }

  if (layout === 'carousel') {
    return (
      <section className="py-16 px-4" style={{ background: surface.background, color: surface.color }}>
        {sectionTitle('text-3xl font-bold mb-4 text-center px-4')}
        {previewHint}
        <div className="flex overflow-x-auto pb-4 px-4 snap-x snap-mandatory" style={{ gap: itemGap }}>
          {displayItems.map((item, i) => (
            <div key={item.id} className="snap-start shrink-0 w-80">
              <TestimonialCard
                item={item}
                style={style}
                dark={dark}
                compact={compactCards}
                largePhoto={largePhotos}
                blockId={blockId}
                blockProps={blockProps}
                testimonialIndex={i}
              />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (layout === 'masonry') {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" style={{ background: surface.background, color: surface.color }}>
        {sectionTitle('text-3xl font-bold mb-4 text-center')}
        {previewHint}
        <div className={cn(masonryColumnClass, 'gap-6 space-y-6')}>
          {displayItems.map((item, i) => (
            <div key={item.id} className="break-inside-avoid mb-6">
              <TestimonialCard
                item={item}
                style={style}
                dark={dark}
                compact={compactCards}
                largePhoto={largePhotos}
                blockId={blockId}
                blockProps={blockProps}
                testimonialIndex={i}
              />
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" style={{ background: surface.background, color: surface.color }}>
      {sectionTitle('text-3xl font-bold mb-4 text-center')}
      {previewHint}
      <div className={cn('grid grid-cols-1 sm:grid-cols-2', colClass)} style={{ gap: itemGap }}>
        {displayItems.map((item, i) => (
          <TestimonialCard
            key={item.id}
            item={item}
            style={style}
            dark={dark}
            compact={compactCards}
            largePhoto={largePhotos}
            blockId={blockId}
            blockProps={blockProps}
            testimonialIndex={i}
          />
        ))}
      </div>
    </section>
  )
}
