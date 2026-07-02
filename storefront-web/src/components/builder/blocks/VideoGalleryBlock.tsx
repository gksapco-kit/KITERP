import { useState } from 'react'
import type { ReactNode } from 'react'
import { Play, Video, X } from 'lucide-react'
import { cn, imgUrl } from '@/lib/utils'
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
import { getVideoEmbedUrl, getVideoThumbnailUrl, isDirectVideoFile } from '@/lib/videoEmbed'
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

export default function VideoGalleryBlock({ style, props, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const [lightbox, setLightbox] = useState<string | null>(null)

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
        message="Upload videos from your device or add YouTube / Vimeo links in the builder sidebar."
        hint="Each video can have its own title and caption."
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
      !useFixedHeight && imageShape !== 'circle' && 'aspect-video',
    )
    const frameStyle = useFixedHeight ? { height: heightPx } : undefined

    const directPlayer: ReactNode = isDirect ? (
      <div
        className={cn(shellClass, className, !isEditorCanvas && 'cursor-pointer group')}
        style={frameStyle}
        onClick={!isEditorCanvas ? () => setLightbox(directSrc) : undefined}
      >
        <video
          src={directSrc}
          className={cn('absolute inset-0 h-full w-full bg-black object-contain', tileImg)}
          muted
          playsInline
          preload="metadata"
          tabIndex={-1}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white opacity-90 shadow-lg transition group-hover:scale-105">
            <Play className="ml-0.5 h-6 w-6 fill-current" />
          </span>
        </div>
      </div>
    ) : null

    const player = directPlayer ? directPlayer : embedUrl ? (
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
          ) : (
            <>
              <iframe
                src={embedUrl}
                className="absolute inset-0 h-full w-full pointer-events-none"
                allowFullScreen
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
            </>
          )}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white shadow-lg">
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            </span>
          </div>
        </div>
      ) : (
        <div
          className={cn(shellClass, className, thumb && 'cursor-pointer group')}
          style={frameStyle}
          onClick={thumb ? () => setLightbox(embedUrl) : undefined}
        >
          {thumb ? (
            <>
              <img
                src={thumb}
                alt={itemTitle || 'Video'}
                className={cn('absolute inset-0 h-full w-full object-cover', tileImg)}
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white opacity-90 shadow-lg transition group-hover:scale-105">
                  <Play className="ml-0.5 h-6 w-6 fill-current" />
                </span>
              </div>
            </>
          ) : (
            <iframe
              src={embedUrl}
              className={cn('absolute inset-0 h-full w-full', tileImg)}
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              title={itemTitle || 'Video'}
            />
          )}
        </div>
      )
    ) : isEditorCanvas ? (
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
    ) : null

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
      className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
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
        <div className={cn('grid max-w-5xl mx-auto', sectionGridColumnClass(columns))} style={{ gap: itemGap }}>
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
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setLightbox(null)}
        >
          <button type="button" className="absolute top-4 right-4 text-white" onClick={() => setLightbox(null)}>
            <X className="w-8 h-8" />
          </button>
          <div
            className="relative w-full max-w-5xl aspect-video rounded-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {isDirectVideoFile(lightbox) ? (
              <video
                src={lightbox}
                className="absolute inset-0 h-full w-full bg-black object-contain"
                controls
                autoPlay
                playsInline
              />
            ) : (
              <iframe
                src={lightbox}
                className="absolute inset-0 h-full w-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                title="Video"
              />
            )}
          </div>
        </div>
      )}
    </section>
  )
}
