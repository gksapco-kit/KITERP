import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { cn, imgUrl } from '@/lib/utils'
import { builderSectionContainerWithMax } from '@/lib/builderSectionLayout'
import { MediaClipFrame } from '@/components/builder/MediaClipFrame'
import { hasMediaClip } from '@/lib/mediaClip'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { BuilderSectionSurface } from '@/components/builder/BuilderSectionSurface'
import { BuilderContentGroup } from '@/components/builder/BuilderContentGroup'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'
import { resolveSectionSurface } from '@/lib/navBlockLayout'
import { getVideoEmbedUrl, isDirectVideoFile } from '@/lib/videoEmbed'
import { sectionImageBackgroundLayers } from '@/lib/sectionImageStyle'
import { resolveAboutShapedImageLayout } from '@/lib/aboutShapedImageLayout'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

const DEFAULT_ABOUT_STATS = [
  { value: '10+', label: 'Years' },
  { value: '5k', label: 'Customers' },
  { value: '98%', label: 'Satisfaction' },
]

export default function AboutSplitBlock({ site, style, props, liveItems, blockId }: Props) {
  const canvas = useBuilderCanvas()
  const isEditorCanvas = canvas?.isEditorCanvas && !!blockId
  const profile = liveItems[0]

  const title = resolveBlockTextField(props, 'title', {
    fallback: () => (isEditorCanvas ? null : (profile?.title || 'About Us')),
  })
  const subtitle = resolveBlockTextField(props, 'subtitle', {
    fallback: () => (isEditorCanvas ? null : 'Our Story'),
  })
  const description = resolveBlockTextField(props, 'description', {
    fallback: () => (isEditorCanvas ? null : (profile?.description || site.description || '')),
  })

  const layout = String(props.layout ?? 'split')
  const imagePosition = String(props.image_position ?? 'right')
  const variant = String(props.variant ?? '')
  const isDark = props.bg_style === 'dark'
  const isCard = props.card_style === 'card'
  const showStats = props.show_stats === true
  const isVideo = props.media_type === 'video'
  const surface = resolveSectionSurface(props, style)

  const isStatement = layout === 'statement' || (variant === 'centered' && layout !== 'overlay' && layout !== 'shaped')
  const isOverlay = layout === 'overlay'
  const isStacked = layout === 'stacked'
  const isShaped = layout === 'shaped'
  const isInlineSplit = layout === 'inline_split'
  const isFullBleed = layout === 'full' || (imagePosition === 'background' && !isInlineSplit && !isOverlay)
  const isColumns = layout === 'columns' || (layout === 'split' && imagePosition === 'none')
  const contentAlign = String(props.align ?? (variant === 'centered' && isOverlay ? 'center' : 'left'))
  const contentVertical = String(props.content_vertical ?? 'center')
  const hideMedia = isStatement || isColumns || imagePosition === 'none'
  const imageOnRight = imagePosition === 'right'
  const useBackgroundMedia = isOverlay || isFullBleed

  const imageHidden = isBlockFieldHidden(props, 'image_url')
  const imageRaw = imageHidden
    ? null
    : ((props.image_url as string | null) || profile?.image_url || null)
  const imageUrl = imageRaw ? imgUrl(imageRaw) : null
  const mediaClip = props.media_clip
  const clipped = hasMediaClip(mediaClip)
  const videoUrl = String(props.video_url ?? '').trim()
  const isDirectVideo = videoUrl ? isDirectVideoFile(videoUrl) : false
  const embedUrl = videoUrl && !isDirectVideo ? getVideoEmbedUrl(videoUrl) : null

  const showSubtitle = !isBlockFieldHidden(props, 'subtitle') && (subtitle || isEditorCanvas)
  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)
  const showDescription = !isBlockFieldHidden(props, 'description') && (description || isEditorCanvas)
  const showMedia = !hideMedia && !imageHidden && (isVideo || imageUrl || isEditorCanvas)

  const stats = ((props.stats as Array<{ value?: string; label?: string }> | undefined) || DEFAULT_ABOUT_STATS)
    .slice(0, 4)

  const titleColor = isDark || useBackgroundMedia ? '#f8fafc' : undefined
  const bodyColor = isDark || useBackgroundMedia
    ? 'rgba(248,250,252,0.78)'
    : undefined

  const statsBlock = showStats ? (
    <div className={cn(
      'mt-8 grid gap-4',
      stats.length >= 4 ? 'grid-cols-2 sm:grid-cols-4'
        : stats.length === 1 ? 'grid-cols-1'
          : stats.length === 2 ? 'grid-cols-2'
            : 'grid-cols-3',
      isStatement && 'justify-items-center',
    )}>
      {stats.map((stat, i) => (
        <div key={i} className={cn(isStatement && 'text-center')}>
          <div
            className="text-2xl font-bold"
            style={{ color: isDark || useBackgroundMedia ? '#fff' : style.primary_color }}
          >
            {stat.value || '—'}
          </div>
          <div className={cn('text-xs mt-0.5', isDark || useBackgroundMedia ? 'text-white/60' : 'text-gray-500')}>
            {stat.label || ''}
          </div>
        </div>
      ))}
    </div>
  ) : null

  const shapedLayout = resolveAboutShapedImageLayout(mediaClip)
  // shaped_width: 30–100 % of the max container width, default 70
  const shapedWidthPct = (() => {
    const raw = Number(props.shaped_width)
    return Number.isFinite(raw) && raw >= 30 && raw <= 100 ? raw : 70
  })()
  // shaped_height: explicit pixel height — overrides the default aspect ratio
  const shapedHeightPx = (() => {
    const raw = Number(props.shaped_height)
    return Number.isFinite(raw) && raw >= 100 && raw <= 800 ? raw : null
  })()

  const renderMediaBlock = (variant: 'default' | 'inline' | 'shaped' = 'default') => {
    if (!showMedia) return null
    const inline = variant === 'inline'
    const shaped = variant === 'shaped'
    const frameClass = inline
      ? 'about-split-image-frame about-split-image-frame--inline rounded-2xl shadow-lg overflow-hidden'
      : shaped
        ? 'about-split-image-frame about-split-image-frame--shaped w-full h-full'
        : cn('about-split-image-frame', !clipped && 'rounded-2xl')
    const mediaAspectClass = inline
      ? 'aspect-[4/5] max-h-[420px] w-full'
      : shaped
        ? 'w-full h-full'  // outer wrapper owns dimensions; frame just fills it
        : 'w-full aspect-video'

    if (isVideo) {
      if (isDirectVideo && videoUrl) {
        return (
          <video
            src={videoUrl}
            controls
            className={cn(mediaAspectClass, 'rounded-2xl object-cover shadow-lg bg-black')}
          />
        )
      }
      if (embedUrl) {
        return (
          <div className={cn(mediaAspectClass, 'rounded-2xl overflow-hidden shadow-lg bg-black')}>
            <iframe
              src={embedUrl}
              title={title ?? 'About video'}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )
      }
      return (
        <div
          className={cn(mediaAspectClass, 'rounded-2xl flex items-center justify-center')}
          style={{ backgroundColor: `${style.primary_color}15` }}
        >
          <span className={cn('text-sm', isDark ? 'text-white/50' : 'text-gray-400')}>
            Add a video URL
          </span>
        </div>
      )
    }

    if (imageUrl) {
      return (
        <MediaClipFrame clip={mediaClip} className={cn(mediaAspectClass, 'overflow-hidden', shaped || inline ? 'shadow-lg' : 'shadow-lg')}>
          <div className={frameClass}>
            <BuilderSectionImage
              blockId={blockId}
              field="image_url"
              blockProps={props}
              src={imageUrl}
              alt={title ?? 'About'}
              className={`w-full h-full object-cover ${!clipped && !inline && !shaped ? 'rounded-2xl' : ''}`}
            />
          </div>
        </MediaClipFrame>
      )
    }

    return (
      <div
        className={cn(mediaAspectClass, 'rounded-2xl flex items-center justify-center')}
        style={{ backgroundColor: `${style.primary_color}10` }}
      >
        <span className={cn(isDark ? 'text-white/40' : 'text-gray-400')}>About Image</span>
      </div>
    )
  }

  const textBlock = (
    <div className={cn(isStatement && 'text-center mx-auto max-w-2xl')}>
      {showSubtitle && (
        <BuilderTextField
          fieldKey="subtitle"
          blockId={blockId}
          blockProps={props}
          value={subtitle ?? ''}
          as="p"
          className="text-sm font-semibold uppercase tracking-widest mb-2"
          style={{ color: style.primary_color }}
        />
      )}
      {showTitle && (
        <BuilderTextField
          fieldKey="title"
          blockId={blockId}
          blockProps={props}
          value={title ?? ''}
          as="h2"
          className={cn(
            'font-bold mb-4',
            isStatement ? 'text-4xl sm:text-5xl' : 'text-3xl',
            !titleColor && 'text-gray-900',
          )}
          style={titleColor ? { color: titleColor } : undefined}
        />
      )}
      {showDescription && (
        <BuilderTextField
          fieldKey="description"
          blockId={blockId}
          blockProps={props}
          value={description ?? ''}
          as="p"
          multiline
          className={cn('leading-relaxed', !bodyColor && 'text-gray-600')}
          style={bodyColor ? { color: bodyColor } : undefined}
          placeholder="Tell your story"
        />
      )}
      {statsBlock}
    </div>
  )

  if (useBackgroundMedia) {
    const bg = imageUrl
      ? sectionImageBackgroundLayers('image_url', props, imageUrl, style.primary_color, 'dark-full')
      : { backgroundImage: undefined, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' as const }

    const overlayJustify = contentVertical === 'top'
      ? 'justify-start'
      : contentVertical === 'bottom'
        ? 'justify-end'
        : 'justify-center'
    const overlayItems = contentAlign === 'center'
      ? 'items-center'
      : contentAlign === 'right'
        ? 'items-end'
        : 'items-start'
    const overlayTextWrap = cn(
      contentAlign === 'center' ? 'max-w-2xl mx-auto text-center'
        : contentAlign === 'right' ? 'max-w-xl ml-auto text-right'
          : 'max-w-xl',
    )
    const overlayContent = isCard ? (
      <div className={cn(
        'rounded-2xl border p-6 sm:p-8 backdrop-blur-sm shadow-xl',
        'border-white/20 bg-black/45',
        overlayTextWrap,
      )}>
        {textBlock}
      </div>
    ) : (
      <div className={overlayTextWrap}>{textBlock}</div>
    )

    return (
      <div
        className="about-split-block about-split-overlay w-full min-h-[320px]"
        style={{
          ...bg,
          ...(imageUrl ? {} : { backgroundColor: '#0f172a' }),
        }}
      >
        <section
          className={cn(
            builderSectionContainerWithMax(isFullBleed ? 'max-w-5xl' : 'max-w-6xl'),
            'py-20 sm:py-28 flex flex-col min-h-[inherit]',
            overlayJustify,
            overlayItems,
          )}
        >
          {overlayContent}
        </section>
      </div>
    )
  }

  if (isStacked) {
    const imageOnTop = imagePosition !== 'bottom'
    const stackedInner = (
      <div className="about-split-block py-8 sm:py-12 space-y-8">
        {imageOnTop && showMedia && (
          <div className="about-split-image-col min-w-0 max-w-4xl mx-auto w-full">
            {renderMediaBlock('default')}
          </div>
        )}
        {isCard ? (
          <div className={cn(
            'rounded-2xl border p-6 sm:p-8',
            isDark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-white shadow-sm',
          )}>
            {textBlock}
          </div>
        ) : (
          textBlock
        )}
        {!imageOnTop && showMedia && (
          <div className="about-split-image-col min-w-0 max-w-4xl mx-auto w-full">
            {renderMediaBlock('default')}
          </div>
        )}
      </div>
    )

    return (
      <BuilderSectionSurface surface={surface} maxWidth="max-w-6xl">
        {stackedInner}
      </BuilderSectionSurface>
    )
  }

  if (isShaped) {
    return (
      <BuilderSectionSurface surface={surface} maxWidth="max-w-4xl">
        <div className="about-split-block about-split-shaped py-8 sm:py-12 text-center">
          <BuilderContentGroup
            blockId={blockId}
            blockProps={props}
            className="about-split-shaped-inner max-w-3xl mx-auto"
          >
            {showSubtitle && (
              <BuilderTextField
                fieldKey="subtitle"
                blockId={blockId}
                blockProps={props}
                value={subtitle ?? ''}
                as="p"
                className="text-sm font-semibold uppercase tracking-widest mb-2"
                style={{ color: style.primary_color }}
              />
            )}
            {showTitle && (
              <BuilderTextField
                fieldKey="title"
                blockId={blockId}
                blockProps={props}
                value={title ?? ''}
                as="h2"
                className={cn('text-3xl sm:text-4xl font-bold mb-6', isDark ? 'text-white' : 'text-gray-900')}
              />
            )}
            {showMedia && (
              <div
                className="about-split-shaped-media my-6 sm:my-8 mx-auto"
                style={{
                  width: `${shapedWidthPct}%`,
                  aspectRatio: shapedHeightPx ? undefined : shapedLayout.aspectRatio,
                  height: shapedHeightPx ? `${shapedHeightPx}px` : undefined,
                }}
              >
                {renderMediaBlock('shaped')}
              </div>
            )}
            {showDescription && (
              <BuilderTextField
                fieldKey="description"
                blockId={blockId}
                blockProps={props}
                value={description ?? ''}
                as="p"
                multiline
                className={cn('leading-relaxed max-w-2xl mx-auto', isDark ? 'text-white/75' : 'text-gray-600')}
                placeholder="Tell your story"
              />
            )}
            {statsBlock}
          </BuilderContentGroup>
        </div>
      </BuilderSectionSurface>
    )
  }

  if (isStatement) {
    return (
      <BuilderSectionSurface surface={surface} maxWidth="max-w-4xl">
        <div className="about-split-block py-8 sm:py-12">{textBlock}</div>
      </BuilderSectionSurface>
    )
  }

  if (isColumns) {
    return (
      <BuilderSectionSurface surface={surface} maxWidth="max-w-6xl">
        <div className="about-split-block py-8 sm:py-12">
          <div className="about-split-grid grid gap-8 lg:grid-cols-2 lg:gap-12 items-start">
            <div className="about-split-text-col min-w-0">
              {showSubtitle && (
                <BuilderTextField
                  fieldKey="subtitle"
                  blockId={blockId}
                  blockProps={props}
                  value={subtitle ?? ''}
                  as="p"
                  className="text-sm font-semibold uppercase tracking-widest mb-2"
                  style={{ color: style.primary_color }}
                />
              )}
              {showTitle && (
                <BuilderTextField
                  fieldKey="title"
                  blockId={blockId}
                  blockProps={props}
                  value={title ?? ''}
                  as="h2"
                  className={cn('text-3xl font-bold mb-4', isDark ? 'text-white' : 'text-gray-900')}
                />
              )}
            </div>
            {showDescription && (
              <BuilderTextField
                fieldKey="description"
                blockId={blockId}
                blockProps={props}
                value={description ?? ''}
                as="p"
                multiline
                className={cn('leading-relaxed', isDark ? 'text-white/75' : 'text-gray-600')}
                placeholder="Tell your story"
              />
            )}
          </div>
        </div>
      </BuilderSectionSurface>
    )
  }

  if (isInlineSplit) {
    const inlineBody = (
      <div
        className={cn(
          'about-split-inline-body flex flex-col gap-6 min-w-0',
          showMedia && (imageOnRight ? 'lg:flex-row lg:items-start' : 'lg:flex-row-reverse lg:items-start'),
        )}
      >
        <div className="about-split-inline-copy min-w-0 flex-1">
          {showDescription && (
            <BuilderTextField
              fieldKey="description"
              blockId={blockId}
              blockProps={props}
              value={description ?? ''}
              as="p"
              multiline
              className={cn('leading-relaxed', !bodyColor && 'text-gray-600')}
              style={bodyColor ? { color: bodyColor } : undefined}
              placeholder="Tell your story"
            />
          )}
        </div>
        {showMedia && (
          <div className="about-split-inline-media w-full shrink-0 lg:w-[min(42%,280px)]">
            <div className="about-split-image-stack">
              {renderMediaBlock('inline')}
            </div>
          </div>
        )}
      </div>
    )

    const inlineContent = (
      <div className="about-split-block py-8 sm:py-12">
        <div className="about-split-grid grid gap-8">
          <BuilderContentGroup
            blockId={blockId}
            blockProps={props}
            className="about-split-text-wrap min-w-0"
          >
            <div className="about-split-text-col min-w-0">
              {showSubtitle && (
                <BuilderTextField
                  fieldKey="subtitle"
                  blockId={blockId}
                  blockProps={props}
                  value={subtitle ?? ''}
                  as="p"
                  className="text-sm font-semibold uppercase tracking-widest mb-2"
                  style={{ color: style.primary_color }}
                />
              )}
              {showTitle && (
                <BuilderTextField
                  fieldKey="title"
                  blockId={blockId}
                  blockProps={props}
                  value={title ?? ''}
                  as="h2"
                  className={cn('text-3xl font-bold mb-4', !titleColor && 'text-gray-900')}
                  style={titleColor ? { color: titleColor } : undefined}
                />
              )}
              {inlineBody}
              {statsBlock}
            </div>
          </BuilderContentGroup>
        </div>
      </div>
    )

    return (
      <BuilderSectionSurface surface={surface} maxWidth="max-w-6xl">
        {isCard ? (
          <div
            className={cn(
              'rounded-2xl border p-6 sm:p-8',
              isDark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-white shadow-sm',
            )}
          >
            {inlineContent}
          </div>
        ) : (
          inlineContent
        )}
      </BuilderSectionSurface>
    )
  }

  const splitInner = (
    <div className="about-split-block py-8 sm:py-12">
      <div
        className={cn(
          'about-split-grid grid gap-8 lg:gap-12 items-start',
          showMedia && 'lg:grid-cols-2',
        )}
      >
        {showMedia && !imageOnRight && (
          <div className="about-split-image-col min-w-0">
            <div className="about-split-image-stack">
              {renderMediaBlock('default')}
            </div>
          </div>
        )}
        {(showSubtitle || showTitle || showDescription || showStats) && (
          <BuilderContentGroup
            blockId={blockId}
            blockProps={props}
            className="about-split-text-wrap about-split-text-col min-w-0"
          >
            {textBlock}
          </BuilderContentGroup>
        )}
        {showMedia && imageOnRight && (
          <div className="about-split-image-col min-w-0">
            <div className="about-split-image-stack">
              {renderMediaBlock('default')}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <BuilderSectionSurface surface={surface} maxWidth="max-w-6xl">
      {isCard ? (
        <div
          className={cn(
            'rounded-2xl border p-6 sm:p-8',
            isDark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-white shadow-sm',
          )}
        >
          {splitInner}
        </div>
      ) : (
        splitInner
      )}
    </BuilderSectionSurface>
  )
}
