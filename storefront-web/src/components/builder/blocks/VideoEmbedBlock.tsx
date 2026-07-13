import { useEffect, useState, type ReactNode } from 'react'
import { Play, Video, X } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { MediaClipFrame } from '@/components/builder/MediaClipFrame'
import { hasMediaClip } from '@/lib/mediaClip'
import { resolveSectionSurface } from '@/lib/navBlockLayout'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'
import { cn, imgUrl } from '@/lib/utils'
import { builderSectionContainerWithMax } from '@/lib/builderSectionLayout'
import { BuilderSectionSurface } from '@/components/builder/BuilderSectionSurface'
import {
  getVideoEmbedUrl,
  getVideoThumbnailUrl,
  isDirectVideoFile,
  isInstagramEmbedUrl,
} from '@/lib/videoEmbed'

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

function ClickToPlayPoster({
  thumbUrl,
  isInstagram,
  alt,
  interactive,
  onPlay,
}: {
  thumbUrl: string | null
  isInstagram: boolean
  alt: string
  interactive: boolean
  onPlay?: () => void
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImg = Boolean(thumbUrl) && !imgFailed

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={cn(
        'absolute inset-0 bg-neutral-900',
        interactive && 'cursor-pointer group',
      )}
      onClick={interactive ? onPlay : undefined}
      onKeyDown={interactive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPlay?.()
        }
      } : undefined}
    >
      {showImg ? (
        <img
          src={thumbUrl!}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      ) : isInstagram ? (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white"
          style={{
            background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
          }}
        >
          <span className="text-xs font-semibold tracking-wide uppercase opacity-90">Instagram</span>
        </div>
      ) : (
        <div className="absolute inset-0 bg-neutral-800" />
      )}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white opacity-90 shadow-lg transition group-hover:scale-105">
          <Play className="ml-0.5 h-7 w-7 fill-current" />
        </span>
      </div>
    </div>
  )
}

function VideoPlayer({
  embedUrl,
  directSrc,
  sourceUrl,
  title,
  aspectRatio,
  mediaClip,
  clipped,
  frameClassName,
  verticalReel,
  interactive,
}: {
  embedUrl: string
  /** Set for uploaded / direct video files — rendered with a native <video> player. */
  directSrc?: string
  /** Original watch URL (used for Instagram/YouTube click-to-play posters). */
  sourceUrl: string
  title: string | null | undefined
  aspectRatio: string
  mediaClip: unknown
  clipped: boolean
  frameClassName?: string
  verticalReel?: boolean
  interactive: boolean
}) {
  const [playing, setPlaying] = useState(false)
  // Instagram: poster → lightbox (same as Video Multiple). YouTube/Vimeo stay inline embeds.
  const isInstagram = isInstagramEmbedUrl(embedUrl)
  const clickToPlay = !directSrc && isInstagram
  const thumbUrl = clickToPlay ? getVideoThumbnailUrl(sourceUrl) : null

  useEffect(() => {
    if (!playing || !isInstagram) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPlaying(false)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [playing, isInstagram])

  const showPoster = clickToPlay

  return (
    <>
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
          ) : showPoster ? (
            <ClickToPlayPoster
              thumbUrl={thumbUrl}
              isInstagram={isInstagram}
              alt={title ?? 'Video'}
              interactive={interactive && !playing}
              onPlay={interactive && !playing ? () => setPlaying(true) : undefined}
            />
          ) : (
            <iframe
              src={embedUrl}
              className="absolute inset-0 h-full w-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              title={title ?? 'Video'}
            />
          )}
        </div>
      </MediaClipFrame>

      {playing && isInstagram && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/85 backdrop-blur-sm p-3 sm:p-6"
          onClick={() => setPlaying(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Instagram video"
        >
          <button
            type="button"
            className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 sm:right-5 sm:top-5"
            onClick={() => setPlaying(false)}
            aria-label="Close video"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="relative flex max-h-[min(92vh,760px)] w-[min(100%,380px)] flex-col overflow-hidden rounded-[1.75rem] bg-black shadow-[0_25px_80px_rgba(0,0,0,0.65)] ring-1 ring-white/15"
            style={{ aspectRatio: '9 / 16' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center pt-2.5">
              <span className="h-1 w-20 rounded-full bg-white/25" aria-hidden />
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
              <iframe
                src={`${embedUrl}${embedUrl.includes('?') ? '&' : '?'}utm_source=ig_embed`}
                className="absolute inset-x-0 top-0 w-full border-0"
                style={{
                  height: '128%',
                  maxWidth: '100%',
                }}
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                title={title ?? 'Instagram video'}
              />
            </div>
          </div>
        </div>
      )}
    </>
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
  const resolvedAspect = String(props.aspect_ratio ?? '').trim()
  const aspectRatio = aspectRatioCss(
    resolvedAspect || (embedUrl && isInstagramEmbedUrl(embedUrl) ? '9:16' : '16:9'),
  )
  const isVerticalReel =
    (resolvedAspect || (embedUrl && isInstagramEmbedUrl(embedUrl) ? '9:16' : '16:9')) === '9:16'
  const surface = resolveSectionSurface(props, style)
  const textColor = surface.color
  const fontHeading = style.font_heading || 'inherit'

  if (!embedUrl) {
    return (
      <BlockEmptyPlaceholder
        style={style}
        title={title ?? 'Video'}
        message="Upload a video from your device or paste a YouTube, Vimeo, or Instagram link in the section settings."
        hint="Instagram posts and reels work — for reels, set Aspect ratio to 9:16."
        icon={<Video className="w-10 h-10" style={{ color: style.primary_color }} />}
      />
    )
  }

  const player = (
    <VideoPlayer
      embedUrl={embedUrl}
      directSrc={directSrc}
      sourceUrl={videoUrl}
      title={title}
      aspectRatio={aspectRatio}
      mediaClip={mediaClip}
      clipped={clipped}
      verticalReel={isVerticalReel}
      interactive
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
            <div className={builderSectionContainerWithMax('max-w-5xl', 'py-6')}>
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
        <BuilderSectionSurface surface={surface} maxWidth="max-w-6xl">
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
        </BuilderSectionSurface>
      )
      break

    case 'card':
      content = (
        <BuilderSectionSurface surface={surface} maxWidth="max-w-4xl">
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
        </BuilderSectionSurface>
      )
      break

    case 'minimal':
      content = (
        <BuilderSectionSurface surface={surface} maxWidth="max-w-xl">
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
        </BuilderSectionSurface>
      )
      break

    default:
      content = (
        <BuilderSectionSurface
          surface={surface}
          maxWidth={isVerticalReel ? 'max-w-md' : 'max-w-5xl'}
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
        </BuilderSectionSurface>
      )
      break
  }

  return content
}
