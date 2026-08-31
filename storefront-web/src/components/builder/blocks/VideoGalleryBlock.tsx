import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Play, Video, X } from 'lucide-react'
import { cn, imgUrl } from '@/lib/utils'
import { builderSectionContainerClass } from '@/lib/builderSectionLayout'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import {
  catalogTileImageClass,
  catalogTileImageWrapperClass,
  columnsFromProps,
  imageShapeFromProps,
  sectionGridColumnClass,
  sectionItemGap,
  sectionItemSize,
} from '@/lib/sectionItemLayout'
import { resolveSectionSurface } from '@/lib/navBlockLayout'
import {
  getVideoEmbedUrl,
  getVideoThumbnailUrl,
  isDirectVideoFile,
  isInstagramEmbedUrl,
  usesClickToPlayPoster,
  videoPreviewSrc,
} from '@/lib/videoEmbed'
import {
  isBlockFieldHidden,
  isNestedBlockFieldHidden,
  resolveBlockTextField,
  visibleArrayEntries,
} from '@/lib/blockHiddenFields'

interface VideoItem {
  video_url?: string
  title?: string
  caption?: string
}

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

/** Uploaded MP4/WebM tile — paint a frame (or a fallback) instead of a black box. */
function DirectVideoTile({
  src,
  alt,
  className,
  shellClass,
  frameStyle,
  tileImg,
  interactive,
  onPlay,
}: {
  src: string
  alt: string
  className?: string
  shellClass: string
  frameStyle?: CSSProperties
  tileImg: string
  interactive: boolean
  onPlay?: () => void
}) {
  const [failed, setFailed] = useState(false)
  const previewSrc = videoPreviewSrc(src)

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={cn(shellClass, className, interactive && 'cursor-pointer group')}
      style={frameStyle}
      onClick={interactive ? onPlay : undefined}
      onKeyDown={interactive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPlay?.()
        }
      } : undefined}
    >
      {failed ? (
        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-200 text-neutral-600',
            tileImg,
          )}
        >
          <Video className="h-8 w-8 opacity-70" />
          <span className="px-3 text-center text-xs font-medium">{alt || 'Video'}</span>
        </div>
      ) : (
        <video
          src={previewSrc}
          className={cn('absolute inset-0 h-full w-full bg-neutral-200 object-cover', tileImg)}
          muted
          playsInline
          preload="metadata"
          tabIndex={-1}
          onError={() => setFailed(true)}
        />
      )}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white opacity-90 shadow-lg transition group-hover:scale-105">
          <Play className="ml-0.5 h-6 w-6 fill-current" />
        </span>
      </div>
    </div>
  )
}

/** Poster + play button — same click-to-open flow as YouTube, including Instagram. */
function ClickToPlayPoster({
  thumbUrl,
  isInstagram,
  alt,
  className,
  shellClass,
  frameStyle,
  tileImg,
  interactive,
  onPlay,
}: {
  thumbUrl: string | null
  isInstagram: boolean
  alt: string
  className?: string
  shellClass: string
  frameStyle?: CSSProperties
  tileImg: string
  interactive: boolean
  onPlay?: () => void
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImg = Boolean(thumbUrl) && !imgFailed

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={cn(shellClass, className, interactive && 'cursor-pointer group')}
      style={frameStyle}
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
          className={cn('absolute inset-0 h-full w-full object-cover', tileImg)}
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      ) : isInstagram ? (
        <div
          className={cn('absolute inset-0 flex flex-col items-center justify-center gap-2 text-white', tileImg)}
          style={{
            background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
          }}
        >
          <span className="text-xs font-semibold tracking-wide uppercase opacity-90">Instagram</span>
        </div>
      ) : (
        <div className={cn('absolute inset-0 bg-neutral-800', tileImg)} />
      )}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white opacity-90 shadow-lg transition group-hover:scale-105">
          <Play className="ml-0.5 h-6 w-6 fill-current" />
        </span>
      </div>
    </div>
  )
}

export default function VideoGalleryBlock({ style, props, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const previewBp = isEditorCanvas ? (builderCanvas?.previewBreakpoint ?? 'desktop') : undefined
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    if (!lightbox) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [lightbox])

  const title = resolveBlockTextField(props, 'title')
  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)
  const layout = String(props.layout ?? 'grid')
  const columns = columnsFromProps(props, layout === 'featured' ? 'grid-3' : layout)
  const itemGap = sectionItemGap(props, 12)
  const hasItemSize = props.item_size != null && props.item_size !== ''
  const itemSize = hasItemSize ? sectionItemSize(props, 160) : undefined
  const imageShape = imageShapeFromProps(props, 'rounded')
  const tileWrap = catalogTileImageWrapperClass(imageShape)
  const tileImg = catalogTileImageClass(imageShape)
  const surface = resolveSectionSurface(props, style)

  const propVideosRaw = Array.isArray(props.videos) ? (props.videos as VideoItem[]) : []
  const propVideos = visibleArrayEntries(propVideosRaw, props, 'videos').map(({ item, index }) => ({
    item: item as VideoItem,
    index,
  }))

  const videos = isEditorCanvas
    ? propVideos
    : propVideos.filter(({ item }) => {
        const url = String(item.video_url ?? '').trim()
        return url && (isDirectVideoFile(url) || getVideoEmbedUrl(url))
      })

  if (videos.length === 0) {
    return (
      <BlockEmptyPlaceholder
        style={style}
        title={title ?? undefined}
        message="Upload videos from your device or add YouTube, Vimeo, or Instagram links in the builder sidebar."
        hint="Each video can have its own title and caption. Instagram posts and reels are supported."
        icon={<Video className="w-10 h-10" style={{ color: style.primary_color }} />}
      />
    )
  }

  const VideoTile = ({
    item,
    index,
    className,
    heightPx,
  }: {
    item: VideoItem
    index: number
    className?: string
    heightPx?: number
  }) => {
    const videoUrl = String(item.video_url ?? '').trim()
    const isDirect = videoUrl ? isDirectVideoFile(videoUrl) : false
    const directSrc = isDirect ? imgUrl(videoUrl) : ''
    const embedUrl = videoUrl && !isDirect ? getVideoEmbedUrl(videoUrl) : null
    const thumb = videoUrl && !isDirect ? getVideoThumbnailUrl(videoUrl) : null
    const clickToPlay = videoUrl ? usesClickToPlayPoster(videoUrl) : false
    const isInstagram = Boolean(embedUrl && isInstagramEmbedUrl(embedUrl))
    const itemTitle = String(item.title ?? '').trim()
    const itemCaption = String(item.caption ?? '').trim()
    const showItemTitle =
      !isNestedBlockFieldHidden(props, 'videos', index, 'title') && (itemTitle || isEditorCanvas)
    const showItemCaption =
      !isNestedBlockFieldHidden(props, 'videos', index, 'caption') && (itemCaption || isEditorCanvas)
    const useFixedHeight = heightPx != null && imageShape !== 'circle'
    const shellClass = cn(
      'relative w-full overflow-hidden bg-black/5',
      tileWrap,
      imageShape === 'circle' && 'aspect-square max-w-[min(100%,280px)] mx-auto',
      !useFixedHeight && imageShape !== 'circle' && (isInstagram ? 'aspect-[4/5]' : 'aspect-video'),
    )
    const frameStyle = useFixedHeight ? { height: heightPx } : undefined

    const directPlayer: ReactNode = isDirect ? (
      <DirectVideoTile
        src={directSrc}
        alt={itemTitle || 'Video'}
        className={className}
        shellClass={shellClass}
        frameStyle={frameStyle}
        tileImg={tileImg}
        interactive={!isEditorCanvas}
        onPlay={!isEditorCanvas ? () => setLightbox(directSrc) : undefined}
      />
    ) : null

    const posterPlayer = embedUrl && clickToPlay ? (
      isEditorCanvas ? (
        <div className={cn(shellClass, className)} style={frameStyle}>
          {thumb ? (
            <BuilderSectionImage
              blockId={blockId}
              field="video_url"
              arrayKey="videos"
              index={index}
              itemField="video_url"
              blockProps={props}
              src={thumb}
              alt={itemTitle || 'Video'}
              className={cn('absolute inset-0 h-full w-full', tileImg)}
            />
          ) : isInstagram ? (
            <div
              className={cn('absolute inset-0 flex flex-col items-center justify-center gap-2 text-white', tileImg)}
              style={{ background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)' }}
            >
              <span className="text-xs font-semibold tracking-wide uppercase opacity-90">Instagram</span>
              <BuilderSectionImage
                blockId={blockId}
                field="video_url"
                arrayKey="videos"
                index={index}
                itemField="video_url"
                blockProps={props}
                src=""
                empty
                alt={itemTitle || 'Video'}
                className="absolute inset-0 h-full w-full opacity-0"
              />
            </div>
          ) : (
            <BuilderSectionImage
              blockId={blockId}
              field="video_url"
              arrayKey="videos"
              index={index}
              itemField="video_url"
              blockProps={props}
              src=""
              empty
              alt={itemTitle || 'Video'}
              className={cn('absolute inset-0 h-full w-full', tileImg)}
            />
          )}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white shadow-lg">
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            </span>
          </div>
        </div>
      ) : (
        <ClickToPlayPoster
          thumbUrl={thumb}
          isInstagram={isInstagram}
          alt={itemTitle || 'Video'}
          className={className}
          shellClass={shellClass}
          frameStyle={frameStyle}
          tileImg={tileImg}
          interactive
          onPlay={() => setLightbox(embedUrl)}
        />
      )
    ) : null

    const player = directPlayer
      ? directPlayer
      : posterPlayer
        ? posterPlayer
        : embedUrl
          ? (
            // Vimeo / other embeds without a stable poster — inline iframe
            isEditorCanvas ? (
              <div className={cn(shellClass, className)} style={frameStyle}>
                <iframe
                  src={embedUrl}
                  className="absolute inset-0 h-full w-full pointer-events-none"
                  allowFullScreen
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  title={itemTitle || 'Video'}
                />
                <BuilderSectionImage
                  blockId={blockId}
                  field="video_url"
                  arrayKey="videos"
                  index={index}
                  itemField="video_url"
                  blockProps={props}
                  src=""
                  empty
                  alt={itemTitle || 'Video'}
                  className="absolute inset-0 h-full w-full opacity-0"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white shadow-lg">
                    <Play className="ml-0.5 h-5 w-5 fill-current" />
                  </span>
                </div>
              </div>
            ) : (
              <div className={cn(shellClass, className)} style={frameStyle}>
                <iframe
                  src={embedUrl}
                  className={cn('absolute inset-0 h-full w-full', tileImg)}
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  title={itemTitle || 'Video'}
                />
              </div>
            )
          )
          : isEditorCanvas
            ? (
              <div className={cn(shellClass, className)} style={frameStyle}>
                <BuilderSectionImage
                  blockId={blockId}
                  field="video_url"
                  arrayKey="videos"
                  index={index}
                  itemField="video_url"
                  blockProps={props}
                  src=""
                  empty
                  alt={itemTitle || 'Video'}
                  className={cn('absolute inset-0 h-full w-full', tileImg)}
                />
              </div>
            )
            : null

    return (
      <div className="space-y-2">
        {player}
        {showItemTitle && (
          <BuilderTextField
            fieldKey={`videos.${index}.title`}
            blockId={blockId}
            blockProps={props}
            value={itemTitle}
            as="h3"
            className="text-base font-semibold text-center"
            style={{ color: surface.color }}
            placeholder="Video title"
          />
        )}
        {showItemCaption && (
          <BuilderTextField
            fieldKey={`videos.${index}.caption`}
            blockId={blockId}
            blockProps={props}
            value={itemCaption}
            as="p"
            multiline
            className="text-sm text-center opacity-80"
            style={{ color: surface.color }}
            placeholder="Caption"
          />
        )}
      </div>
    )
  }

  return (
    <section
      className={builderSectionContainerClass()}
      style={{ background: surface.background, color: surface.color }}
    >
      {showTitle && (
        <BuilderTextField
          fieldKey="title"
          blockId={blockId}
          blockProps={props}
          value={title ?? ''}
          as="h2"
          className="text-3xl font-bold mb-8 text-center"
          style={{ color: surface.color, fontFamily: style.font_heading || 'inherit' }}
          placeholder="Section title"
        />
      )}
      {layout === 'featured' ? (
        <div className="grid grid-cols-3 grid-rows-2 max-w-5xl mx-auto min-h-[320px]" style={{ gap: itemGap }}>
          <VideoTile item={videos[0].item} index={videos[0].index} className="col-span-2 row-span-2 h-full min-h-[280px] rounded-xl" />
          {videos.slice(1, 3).map((v, i) => (
            <VideoTile key={i} item={v.item} index={v.index} className="h-full min-h-[130px]" />
          ))}
        </div>
      ) : layout === 'masonry' ? (
        <div
          className={cn(
            'columns-2 sm:columns-3 gap-4 space-y-4 max-w-5xl mx-auto',
            columns >= 4 && 'lg:columns-4',
            columns >= 5 && 'lg:columns-5',
          )}
          style={{ columnGap: itemGap }}
        >
          {videos.map((v, i) => (
            <VideoTile
              key={i}
              item={v.item}
              index={v.index}
              heightPx={itemSize ?? 240}
              className="break-inside-avoid mb-4"
            />
          ))}
        </div>
      ) : (
        <div className={cn('grid max-w-5xl mx-auto', sectionGridColumnClass(columns, previewBp))} style={{ gap: itemGap }}>
          {videos.map((v, i) => (
            <VideoTile
              key={i}
              item={v.item}
              index={v.index}
              heightPx={itemSize}
              className={itemSize != null ? undefined : columns <= 2 ? 'aspect-[4/3]' : 'aspect-video'}
            />
          ))}
        </div>
      )}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/85 backdrop-blur-sm p-3 sm:p-6"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Video player"
        >
          <button
            type="button"
            className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 sm:right-5 sm:top-5"
            onClick={() => setLightbox(null)}
            aria-label="Close video"
          >
            <X className="h-5 w-5" />
          </button>

          {isDirectVideoFile(lightbox) ? (
            <div
              className="relative w-full max-w-5xl aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10"
              onClick={e => e.stopPropagation()}
            >
              <video
                src={lightbox}
                className="absolute inset-0 h-full w-full object-contain"
                controls
                autoPlay
                playsInline
              />
            </div>
          ) : isInstagramEmbedUrl(lightbox) ? (
            /* Phone-style frame: crop Instagram chrome/comments so the lightbox isn't a tall scroll. */
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
                  src={`${lightbox}${lightbox.includes('?') ? '&' : '?'}utm_source=ig_embed`}
                  className="absolute inset-x-0 top-0 w-full border-0"
                  style={{
                    // Embed page is taller than the video; oversize + clip hides comments/footer.
                    height: '128%',
                    maxWidth: '100%',
                    overflow: 'hidden',
                  }}
                  scrolling="no"
                  allowFullScreen
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  title="Instagram video"
                />
                {/* Soft mask so clipped chrome doesn't look abruptly cut off */}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black to-transparent"
                  aria-hidden
                />
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-4 pb-4 pt-10">
                <p className="text-center text-[11px] font-medium tracking-wide text-white/80">
                  Instagram
                </p>
              </div>
            </div>
          ) : (
            <div
              className="relative w-full max-w-5xl aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10"
              onClick={e => e.stopPropagation()}
            >
              <iframe
                src={lightbox}
                className="absolute inset-0 h-full w-full border-0"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                title="Video"
              />
            </div>
          )}
        </div>
      )}
    </section>
  )
}
