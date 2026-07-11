import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { cn, imgUrl } from '@/lib/utils'
import { builderSectionContainerWithMax } from '@/lib/builderSectionLayout'
import { MediaClipFrame } from '@/components/builder/MediaClipFrame'
import { hasMediaClip } from '@/lib/mediaClip'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { BuilderSectionSurface } from '@/components/builder/BuilderSectionSurface'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'
import { resolveSectionSurface } from '@/lib/navBlockLayout'
import { getVideoEmbedUrl, isDirectVideoFile } from '@/lib/videoEmbed'

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

  const isStatement = layout === 'statement' || variant === 'centered'
  const isOverlay = layout === 'overlay'
  const isFullBleed = layout === 'full' || imagePosition === 'background'
  const isColumns = layout === 'columns' || (layout === 'split' && imagePosition === 'none')
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
      {showStats && (
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
      )}
    </div>
  )

  const mediaBlock = (() => {
    if (!showMedia) return null

    if (isVideo) {
      if (isDirectVideo && videoUrl) {
        return (
          <video
            src={videoUrl}
            controls
            className="w-full aspect-video rounded-2xl object-cover shadow-lg bg-black"
          />
        )
      }
      if (embedUrl) {
        return (
          <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-lg bg-black">
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
          className="w-full aspect-video rounded-2xl flex items-center justify-center"
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
        <MediaClipFrame clip={mediaClip} className="w-full aspect-video shadow-lg">
          <BuilderSectionImage
            blockId={blockId}
            field="image_url"
            blockProps={props}
            src={imageUrl}
            alt={title ?? 'About'}
            className={`w-full h-full object-cover ${!clipped ? 'rounded-2xl' : ''}`}
          />
        </MediaClipFrame>
      )
    }

    return (
      <div
        className="w-full aspect-video rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: `${style.primary_color}10` }}
      >
        <span className={cn(isDark ? 'text-white/40' : 'text-gray-400')}>About Image</span>
      </div>
    )
  })()

  if (useBackgroundMedia) {
    const bg = imageUrl
      ? {
          backgroundImage: `linear-gradient(rgba(15,23,42,0.55), rgba(15,23,42,0.7)), url(${imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : { backgroundColor: '#0f172a' }

    return (
      <div className="w-full" style={bg}>
        <section
          className={cn(
            builderSectionContainerWithMax(isFullBleed ? 'max-w-5xl' : 'max-w-6xl'),
            'py-20 sm:py-28',
          )}
        >
          {textBlock}
        </section>
      </div>
    )
  }

  if (isStatement) {
    return (
      <BuilderSectionSurface surface={surface} maxWidth="max-w-4xl">
        <div className="py-8 sm:py-12">{textBlock}</div>
      </BuilderSectionSurface>
    )
  }

  if (isColumns) {
    return (
      <BuilderSectionSurface surface={surface} maxWidth="max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-start">
          <div>
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
      </BuilderSectionSurface>
    )
  }

  const splitInner = (
    <div
      className={cn(
        'flex flex-col gap-12 items-center',
        showMedia && (imageOnRight ? 'lg:flex-row' : 'lg:flex-row-reverse'),
      )}
    >
      {(showSubtitle || showTitle || showDescription || showStats) && (
        <div className={cn(showMedia && 'w-full lg:w-1/2')}>{textBlock}</div>
      )}
      {showMedia && <div className="w-full lg:w-1/2">{mediaBlock}</div>}
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
