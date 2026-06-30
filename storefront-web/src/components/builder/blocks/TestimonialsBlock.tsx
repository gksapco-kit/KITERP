import { Quote, Star } from 'lucide-react'
import { useState } from 'react'
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

function TestimonialAvatar({
  src,
  title,
  style,
  className,
}: {
  src: string
  title: string
  style: StyleConfig
  className: string
}) {
  const [failed, setFailed] = useState(false)
  if (!src.trim() || failed) {
    return (
      <div
        className={cn(className, 'rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0')}
        style={{ backgroundColor: style.primary_color }}
      >
        {(title || '?').charAt(0).toUpperCase()}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={title}
      className={cn(className, 'rounded-full object-cover shrink-0')}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
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
  isEditableStatic,
}: {
  item: LiveItem
  style: StyleConfig
  dark?: boolean
  compact?: boolean
  largePhoto?: boolean
  blockId?: string
  blockProps?: Record<string, unknown>
  testimonialIndex?: number
  isEditableStatic?: boolean
}) {
  const avatarClass = largePhoto ? 'w-14 h-14' : 'w-10 h-10'
  const i = testimonialIndex
  const showQuote = i == null || !blockProps || !isNestedBlockFieldHidden(blockProps, `testimonials.${i}.quote`)
  const showName = i == null || !blockProps || !isNestedBlockFieldHidden(blockProps, `testimonials.${i}.name`)
  const showRole = i == null || !blockProps || !isNestedBlockFieldHidden(blockProps, `testimonials.${i}.role`)
  const showAvatar = i == null || !blockProps || (
    !isNestedBlockFieldHidden(blockProps, arrayImageDeleteFieldKey('testimonials', i, 'image_url'))
    && !isNestedBlockFieldHidden(blockProps, arrayImageDeleteFieldKey('testimonials', i, 'avatar_url'))
  )

  return (
    <div className={cn(
      'builder-tile-card rounded-2xl border p-6 relative h-full w-full min-w-0 flex flex-col overflow-hidden',
      dark ? 'border-white/10 bg-white/5' : 'bg-white border-gray-100',
      compact && 'p-4',
    )}>
      <Quote className="w-8 h-8 opacity-10 absolute top-4 right-4 pointer-events-none" style={{ color: style.primary_color }} />
      {item.rating != null && (
        <div className="flex gap-0.5 mb-3 shrink-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`w-4 h-4 ${i < (item.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
          ))}
        </div>
      )}
      {showQuote && (
        <p className={cn('leading-relaxed mb-4 flex-1 min-h-[3rem] w-full break-words', compact ? 'text-xs' : 'text-sm', dark ? 'text-white/80' : 'text-gray-600')}>
          {isEditableStatic && blockId && blockProps != null && i != null ? (
            <>
              &ldquo;
              <BuilderTextField
                fieldKey={`testimonials.${i}.quote`}
                blockId={blockId}
                blockProps={blockProps}
                value={item.description ?? ''}
                as="span"
                multiline
                skipPositionWrapper
                className="inline break-words"
                placeholder="Customer quote"
              />
              &rdquo;
            </>
          ) : (
            `"${item.description}"`
          )}
        </p>
      )}
      <div className="flex items-center gap-3 mt-auto shrink-0 pt-1">
        {showAvatar && item.image_url && blockId && blockProps != null && i != null ? (
          <BuilderSectionImage
            blockId={blockId}
            field="image_url"
            arrayKey="testimonials"
            index={i}
            itemField="image_url"
            blockProps={blockProps}
            src={item.image_url}
            alt={item.title}
            className={cn(avatarClass, 'rounded-full object-cover shrink-0')}
          />
        ) : showAvatar && item.image_url ? (
          <TestimonialAvatar
            src={item.image_url}
            title={item.title}
            style={style}
            className={avatarClass}
          />
        ) : showAvatar && (showName || item.title) ? (
          <div
            className={cn(avatarClass, 'rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0')}
            style={{ backgroundColor: style.primary_color }}
          >
            {item.title.charAt(0).toUpperCase()}
          </div>
        ) : null}
        {(showName || showRole) && (
        <div className="min-w-0">
          {showName && (
            isEditableStatic && blockId && blockProps != null && i != null ? (
              <BuilderTextField
                fieldKey={`testimonials.${i}.name`}
                blockId={blockId}
                blockProps={blockProps}
                value={item.title}
                as="p"
                skipPositionWrapper
                className={cn('font-semibold text-sm w-full break-words', dark ? 'text-white' : 'text-gray-900')}
                placeholder="Name"
              />
            ) : (
              <p className={cn('font-semibold text-sm', dark ? 'text-white' : 'text-gray-900')}>{item.title}</p>
            )
          )}
          {showRole && item.subtitle && (
            isEditableStatic && blockId && blockProps != null && i != null ? (
              <BuilderTextField
                fieldKey={`testimonials.${i}.role`}
                blockId={blockId}
                blockProps={blockProps}
                value={item.subtitle}
                as="p"
                skipPositionWrapper
                className={cn('text-xs w-full break-words', dark ? 'text-white/60' : 'text-gray-400')}
                placeholder="Role"
              />
            ) : (
              <p className={cn('text-xs', dark ? 'text-white/60' : 'text-gray-400')}>{item.subtitle}</p>
            )
          )}
        </div>
        )}
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
  const title = resolveBlockTextField(props, 'title', {
    fallback: () => (isEditor ? null : 'What Our Customers Say'),
  })
  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditor)
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
  const manualVisible = visibleArrayEntries(staticTestis, props, 'testimonials')
    .filter(({ item }) => !isTemplateTestimonial(item))

  const publishedItems = liveItems.length > 0
    ? liveItems.map((item, index) => ({ item, index: index, isEditableStatic: false }))
    : liveBound || staticTestis.some(isTemplateTestimonial)
      ? []
      : manualVisible.map(({ item, index }) => ({
          item: staticTestimonialToLiveItem(item, index),
          index,
          isEditableStatic: true,
        }))

  const previewCount = layout === 'centered' ? 1 : Math.min(Math.max(columns, 2), 4)

  const layoutSampleItems =
    manualVisible.length > 0
      ? manualVisible.map(({ item, index }) => ({
          item: staticTestimonialToLiveItem(item, index),
          index,
          isEditableStatic: true,
        }))
      : builderPreviewTestimonials(previewCount).map((item, index) => ({
          item,
          index,
          isEditableStatic: false,
        }))

  // Draft / editor preview always shows sample cards when there is no published content.
  const showLayoutSampleOnLive =
    liveBound && liveItems.length === 0
    || (staticTestis.some(isTemplateTestimonial) && manualVisible.length === 0)

  const draftPreviewItems = showDraftPreviewFallback || showLayoutSampleOnLive
    ? layoutSampleItems
    : []

  const displayEntries = publishedItems.length > 0 ? publishedItems : draftPreviewItems
  const showingLayoutPreview = isEditor && previewShell !== true && publishedItems.length === 0 && displayEntries.length > 0

  const sectionTitle = (className: string) => (
    showTitle ? (
      <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title ?? ''} as="h2" className={className} placeholder="Section title" />
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

  if (displayEntries.length === 0) {
    return (
      <section className="px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto text-center" style={{ background: surface.background, color: surface.color }}>
        <BlockEmptyPlaceholder
          style={style}
          title={title ?? 'Testimonials'}
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
    const { item, index, isEditableStatic } = displayEntries[0]
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
          testimonialIndex={isEditableStatic ? index : undefined}
          isEditableStatic={isEditableStatic}
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
          {displayEntries.map(({ item, index, isEditableStatic }) => (
            <TestimonialCard
              key={item.id}
              item={item}
              style={style}
              dark={dark}
              compact
              largePhoto={largePhotos}
              blockId={blockId}
              blockProps={blockProps}
              testimonialIndex={isEditableStatic ? index : undefined}
              isEditableStatic={isEditableStatic}
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
        <div className="flex overflow-x-auto pb-4 px-4 snap-x snap-mandatory items-stretch" style={{ gap: itemGap }}>
          {displayEntries.map(({ item, index, isEditableStatic }) => (
            <div key={item.id} className="snap-start shrink-0 w-80 min-w-[20rem] max-w-[20rem] flex">
              <TestimonialCard
                item={item}
                style={style}
                dark={dark}
                compact={compactCards}
                largePhoto={largePhotos}
                blockId={blockId}
                blockProps={blockProps}
                testimonialIndex={isEditableStatic ? index : undefined}
                isEditableStatic={isEditableStatic}
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
          {displayEntries.map(({ item, index, isEditableStatic }) => (
            <div key={item.id} className="break-inside-avoid mb-6">
              <TestimonialCard
                item={item}
                style={style}
                dark={dark}
                compact={compactCards}
                largePhoto={largePhotos}
                blockId={blockId}
                blockProps={blockProps}
                testimonialIndex={isEditableStatic ? index : undefined}
                isEditableStatic={isEditableStatic}
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
      <div className={cn('grid w-full items-stretch', colClass)} style={{ gap: itemGap }}>
        {displayEntries.map(({ item, index, isEditableStatic }) => (
          <div key={item.id} className="flex min-w-0 w-full">
            <TestimonialCard
              item={item}
              style={style}
              dark={dark}
              compact={compactCards}
              largePhoto={largePhotos}
              blockId={blockId}
              blockProps={blockProps}
              testimonialIndex={isEditableStatic ? index : undefined}
              isEditableStatic={isEditableStatic}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
