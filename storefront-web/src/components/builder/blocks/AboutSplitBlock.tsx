import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { cn, imgUrl } from '@/lib/utils'
import { builderSectionContainerWithMax } from '@/lib/builderSectionLayout'
import { MediaClipFrame } from '@/components/builder/MediaClipFrame'
import { hasMediaClip, mediaClipNeedsSquareBox } from '@/lib/mediaClip'
import { BuilderPositionableField } from '@/components/builder/BuilderPositionableField'
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
  const quote = resolveBlockTextField(props, 'quote', { fallback: () => null })
  const signature = resolveBlockTextField(props, 'signature', { fallback: () => null })

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
  const showQuote = !isBlockFieldHidden(props, 'quote') && (quote || isEditorCanvas)
  const showSignature = !isBlockFieldHidden(props, 'signature') && (signature || isEditorCanvas)
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
  // shaped_height: explicit pixel height — used when clip is None, or to override shaped aspect
  const shapedHeightPx = (() => {
    const raw = Number(props.shaped_height)
    return Number.isFinite(raw) && raw >= 80 && raw <= 800 ? raw : null
  })()
  const clipNone = !clipped
  const explicitHeightPx = (clipNone || isShaped) ? shapedHeightPx : null

  const renderMediaBlock = (variant: 'default' | 'inline' | 'shaped' = 'default') => {
    if (!showMedia) return null
    const inline = variant === 'inline'
    const shaped = variant === 'shaped'
    const circleClip = mediaClipNeedsSquareBox(mediaClip)
    const natural = clipNone && !explicitHeightPx && !circleClip
    const fixedH = Boolean(explicitHeightPx) && !circleClip
    const frameClass = inline
      ? cn(
          'about-split-image-frame about-split-image-frame--inline shadow-lg overflow-hidden',
          circleClip ? 'rounded-full absolute inset-0 h-full w-full' : 'rounded-2xl',
          natural && 'about-split-image-frame--natural',
          fixedH && 'about-split-image-frame--fixed-h h-full',
        )
      : shaped
        ? 'about-split-image-frame about-split-image-frame--shaped w-full h-full'
        : cn(
            'about-split-image-frame',
            !clipped && 'rounded-2xl',
            circleClip && 'rounded-full absolute inset-0 h-full w-full',
            natural && 'about-split-image-frame--natural',
            fixedH && 'about-split-image-frame--fixed-h h-full',
          )
    const mediaAspectClass = circleClip
      ? 'w-full max-w-[min(100%,420px)] aspect-square mx-auto'
      : inline
        ? cn('w-full', !natural && !fixedH && 'aspect-[4/5] max-h-[420px]')
        : shaped
          ? 'w-full h-full'
          : cn(
              'w-full',
              natural && 'about-split-image-media--natural',
              !natural && !fixedH && 'aspect-[4/5] max-h-[min(72vh,560px)]',
            )
    const mediaSizeStyle = fixedH && !shaped
      ? { height: `${explicitHeightPx}px` }
      : undefined

    if (isVideo) {
      if (isDirectVideo && videoUrl) {
        return (
          <video
            src={videoUrl}
            controls
            className={cn(mediaAspectClass, 'rounded-2xl object-cover shadow-lg bg-black')}
            style={mediaSizeStyle}
          />
        )
      }
      if (embedUrl) {
        return (
          <div className={cn(mediaAspectClass, 'rounded-2xl overflow-hidden shadow-lg bg-black')} style={mediaSizeStyle}>
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
          style={{ backgroundColor: `${style.primary_color}15`, ...mediaSizeStyle }}
        >
          <span className={cn('text-sm', isDark ? 'text-white/50' : 'text-gray-400')}>
            Add a video URL
          </span>
        </div>
      )
    }

    if (imageUrl) {
      return (
        <MediaClipFrame
          clip={mediaClip}
          className={cn(mediaAspectClass, 'overflow-hidden', 'shadow-lg')}
          style={mediaSizeStyle}
        >
          <div className={frameClass}>
            <BuilderSectionImage
              blockId={blockId}
              field="image_url"
              blockProps={props}
              src={imageUrl}
              alt={title ?? 'About'}
              frameClassName={natural ? 'w-full h-auto' : undefined}
              className={cn(
                'w-full object-cover',
                natural ? 'h-auto' : 'h-full',
                !clipped && !inline && !shaped && 'rounded-2xl',
              )}
            />
          </div>
        </MediaClipFrame>
      )
    }

    return (
      <div
        className={cn(mediaAspectClass, 'rounded-2xl flex items-center justify-center')}
        style={{ backgroundColor: `${style.primary_color}10`, ...mediaSizeStyle }}
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

  const imageCaption = (showQuote || showSignature) ? (
    <div className={cn('about-split-image-caption', clipNone && 'about-split-image-caption--tight')}>
      {showQuote && (
        <BuilderTextField
          fieldKey="quote"
          blockId={blockId}
          blockProps={props}
          value={quote ?? ''}
          as="blockquote"
          multiline
          className={cn(
            'italic leading-relaxed',
            isDark || useBackgroundMedia ? 'text-white/90' : 'text-gray-700',
          )}
          placeholder="Add a short quote"
        />
      )}
      {showSignature && (
        <BuilderTextField
          fieldKey="signature"
          blockId={blockId}
          blockProps={props}
          value={signature ?? ''}
          as="p"
          className={cn(
            'mt-1 text-sm font-medium',
            isDark || useBackgroundMedia ? 'text-white/80' : 'text-gray-800',
          )}
          placeholder="— Signature"
        />
      )}
    </div>
  ) : null

  const positionedImageStack = (mediaVariant: 'default' | 'inline' = 'default') => (
    <BuilderPositionableField
      fieldKey="image_url"
      blockId={blockId}
      blockProps={props}
      dragFromBody
      lockAspect
      className="about-split-image-pos w-full max-w-full"
    >
      <div className="about-split-image-stack">
        <div className={cn('about-split-image-media', mediaClipNeedsSquareBox(mediaClip) && 'about-split-image-media--circle')}>
          {renderMediaBlock(mediaVariant)}
        </div>
        {imageCaption}
      </div>
    </BuilderPositionableField>
  )

  const imageColumn = (mediaVariant: 'default' | 'inline' = 'default') => (
    <div className="about-split-image-col min-w-0">
      {positionedImageStack(mediaVariant)}
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
          {imageCaption}
        </section>
      </div>
    )
  }

  if (isStacked) {
    const imageOnTop = imagePosition !== 'bottom'
    const stackedInner = (
      <div className="about-split-block space-y-6">
        {imageOnTop && showMedia && (
          <div className="about-split-image-col min-w-0 max-w-4xl mx-auto w-full">
            {positionedImageStack('default')}
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
            {positionedImageStack('default')}
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
        <div className="about-split-block about-split-shaped text-center">
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
                className={cn(
                  'about-split-shaped-media mx-auto',
                  clipNone ? 'my-3' : 'my-6 sm:my-8',
                )}
                style={{
                  width: `${shapedWidthPct}%`,
                  aspectRatio: (!clipNone && !shapedHeightPx) ? shapedLayout.aspectRatio : undefined,
                  height: shapedHeightPx ? `${shapedHeightPx}px` : undefined,
                }}
              >
                {renderMediaBlock('shaped')}
              </div>
            )}
            {imageCaption}
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
        <div className="about-split-block">
          {textBlock}
          {imageCaption}
        </div>
      </BuilderSectionSurface>
    )
  }

  if (isColumns) {
    return (
      <BuilderSectionSurface surface={surface} maxWidth="max-w-6xl">
        <div className="about-split-block">
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
          <div className="about-split-inline-media about-split-image-col w-full shrink-0 lg:w-[min(42%,280px)]">
            {positionedImageStack('inline')}
          </div>
        )}
      </div>
    )

    const inlineContent = (
      <div className="about-split-block">
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
    <div className="about-split-block">
      <div
        className={cn(
          'about-split-grid about-split-grid--pinned grid gap-8 lg:gap-12 items-start',
          showMedia && 'lg:grid-cols-2',
        )}
      >
        {showMedia && !imageOnRight && imageColumn()}
        {(showSubtitle || showTitle || showDescription || showStats) && (
          <BuilderContentGroup
            blockId={blockId}
            blockProps={props}
            className="about-split-text-wrap about-split-text-col min-w-0"
          >
            {textBlock}
          </BuilderContentGroup>
        )}
        {showMedia && imageOnRight && imageColumn()}
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
