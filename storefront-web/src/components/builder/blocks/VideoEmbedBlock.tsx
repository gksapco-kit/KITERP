import { Video } from 'lucide-react'
import type { ReactNode } from 'react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { MediaClipFrame } from '@/components/builder/MediaClipFrame'
import { hasMediaClip } from '@/lib/mediaClip'
import { resolveSectionSurface } from '@/lib/navBlockLayout'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'
import { cn, imgUrl } from '@/lib/utils'
import { getVideoEmbedUrl, isDirectVideoFile } from '@/lib/videoEmbed'

function aspectRatioCss(value: string): string {
  switch (value) {
    case '21:9':
      return '21 / 9'
    case '4:3':
      return '4 / 3'
    case '1:1':
      return '1 / 1'
    case '9:16':
      return '9 / 16'
    case '16:9':
    default:
      return '16 / 9'
  }
}

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

function VideoTitle({
  title,
  showTitle,
  blockId,
  props,
  textColor,
  fontHeading,
  className = 'text-2xl font-bold mb-6 text-center',
}: {
  title: string | null | undefined
  showTitle: boolean
  blockId?: string
  props: Record<string, unknown>
  textColor: string
  fontHeading: string
  className?: string
}) {
  if (!showTitle) return null
  return (
    <BuilderTextField
      fieldKey="title"
      blockId={blockId}
      blockProps={props}
      value={title ?? ''}
      as="h2"
      className={className}
      style={{ fontFamily: fontHeading, color: textColor }}
      placeholder="Section title"
    />
  )
}

function VideoPlayer({
  embedUrl,
  directSrc,
  title,
  aspectRatio,
  mediaClip,
  clipped,
  frameClassName,
  verticalReel,
}: {
  embedUrl: string
  /** Set for uploaded / direct video files — rendered with a native <video> player. */
  directSrc?: string
  title: string | null | undefined
  aspectRatio: string
  mediaClip: unknown
  clipped: boolean
  frameClassName?: string
  verticalReel?: boolean
}) {
  return (
    <MediaClipFrame
      clip={mediaClip}
      className={cn(
        'relative w-full',
        verticalReel && 'max-w-sm mx-auto',
        !clipped && frameClassName,
      )}
    >
      <div className="relative w-full" style={{ aspectRatio }}>
        {directSrc ? (
          <video
            src={directSrc}
            className="absolute inset-0 h-full w-full bg-black object-contain"
            controls
            playsInline
            preload="metadata"
          />
        ) : (
          <iframe
            src={embedUrl}
            className="absolute inset-0 h-full w-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title={title ?? 'Video'}
          />
        )}
      </div>
    </MediaClipFrame>
  )
}

export default function VideoEmbedBlock({ style, props, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId

  const title = resolveBlockTextField(props, 'title', {
    fallback: () => (isEditorCanvas ? null : 'Video'),
  })
  const videoUrl = (props.video_url as string) || ''
  const mediaClip = props.media_clip
  const clipped = hasMediaClip(mediaClip)
  const isDirect = videoUrl ? isDirectVideoFile(videoUrl) : false
  const directSrc = isDirect ? imgUrl(videoUrl) : undefined
  const embedUrl = videoUrl ? (isDirect ? videoUrl : getVideoEmbedUrl(videoUrl)) : null
  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)

  const layout = String(props.layout ?? 'standard')
  const aspectRatio = aspectRatioCss(String(props.aspect_ratio ?? '16:9'))
  const isVerticalReel = String(props.aspect_ratio ?? '16:9') === '9:16'
  const surface = resolveSectionSurface(props, style)
  const textColor = surface.color
  const fontHeading = style.font_heading || 'inherit'

  if (!embedUrl) {
    return (
      <BlockEmptyPlaceholder
        style={style}
        title={title ?? 'Video'}
        message="Upload a video from your device or paste a YouTube / Vimeo link in the section settings."
        icon={<Video className="w-10 h-10" style={{ color: style.primary_color }} />}
      />
    )
  }

  const player = (
    <VideoPlayer
      embedUrl={embedUrl}
      directSrc={directSrc}
      title={title}
      aspectRatio={aspectRatio}
      mediaClip={mediaClip}
      clipped={clipped}
      verticalReel={isVerticalReel}
      frameClassName={
        layout === 'full'
          ? 'shadow-none'
          : layout === 'minimal'
            ? 'rounded-xl overflow-hidden shadow-md'
            : layout === 'card'
              ? 'rounded-xl overflow-hidden'
              : `shadow-lg ${!clipped ? 'rounded-2xl overflow-hidden' : ''}`
      }
    />
  )

  let content: ReactNode

  switch (layout) {
    case 'full':
      content = (
        <section className="py-0 px-0 w-full">
          {showTitle && (
            <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto">
              <VideoTitle
                title={title}
                showTitle={showTitle}
                blockId={blockId}
                props={props}
                textColor={textColor}
                fontHeading={fontHeading}
              />
            </div>
          )}
          {player}
        </section>
      )
      break

    case 'split':
      content = (
        <section
          className="py-10 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto"
          style={{ background: surface.background, color: textColor }}
        >
          <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-center">
            <div className="w-full md:flex-1 min-w-0">{player}</div>
            {showTitle && (
              <div className="w-full md:flex-1 space-y-3">
                <VideoTitle
                  title={title}
                  showTitle={showTitle}
                  blockId={blockId}
                  props={props}
                  textColor={textColor}
                  fontHeading={fontHeading}
                  className="text-2xl sm:text-3xl font-bold mb-0 text-left"
                />
              </div>
            )}
          </div>
        </section>
      )
      break

    case 'card':
      content = (
        <section
          className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto"
          style={{ background: surface.background, color: textColor }}
        >
          <div
            className={cn(
              'rounded-2xl border p-4 sm:p-6',
              surface.isDark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-white shadow-lg',
            )}
          >
            <VideoTitle
              title={title}
              showTitle={showTitle}
              blockId={blockId}
              props={props}
              textColor={textColor}
              fontHeading={fontHeading}
              className="text-xl sm:text-2xl font-bold mb-4 text-left"
            />
            {player}
          </div>
        </section>
      )
      break

    case 'minimal':
      content = (
        <section
          className="py-8 px-4 sm:px-6 max-w-xl mx-auto"
          style={{ background: surface.background, color: textColor }}
        >
          <VideoTitle
            title={title}
            showTitle={showTitle}
            blockId={blockId}
            props={props}
            textColor={textColor}
            fontHeading={fontHeading}
            className="text-lg font-semibold mb-4 text-center"
          />
          {player}
        </section>
      )
      break

    default:
      content = (
        <section
          className={cn(
            'py-12 px-4 sm:px-6 lg:px-8 mx-auto',
            isVerticalReel ? 'max-w-md' : 'max-w-5xl',
          )}
          style={{ background: surface.background, color: textColor }}
        >
          <VideoTitle
            title={title}
            showTitle={showTitle}
            blockId={blockId}
            props={props}
            textColor={textColor}
            fontHeading={fontHeading}
          />
          {player}
        </section>
      )
      break
  }

  return content
}
