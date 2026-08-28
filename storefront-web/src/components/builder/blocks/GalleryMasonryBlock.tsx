import { useEffect, useState, type MouseEvent } from 'react'
import { ChevronLeft, ChevronRight, ImageIcon, X } from 'lucide-react'
import { cn, imgUrl } from '@/lib/utils'
import { builderSectionContainerClass, builderSectionContainerWithMax } from '@/lib/builderSectionLayout'
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
import { arrayItemImageFrameStyle, arrayItemImageRenderStyle } from '@/lib/sectionImageStyle'
import {
  arrayImageDeleteFieldKey,
  isBlockFieldHidden,
  isNestedBlockFieldHidden,
  resolveBlockTextField,
  visibleArrayEntries,
} from '@/lib/blockHiddenFields'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null; blockId?: string }

const DEFAULT_PAGE_SIZE = 6

export default function GalleryMasonryBlock({ style, props, liveItems, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const previewBp = isEditorCanvas ? (builderCanvas?.previewBreakpoint ?? 'desktop') : undefined
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const title = resolveBlockTextField(props, 'title')
  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)
  const layout = String(props.layout ?? 'grid')
  const columns = columnsFromProps(props, layout === 'featured' ? 'grid-3' : layout)
  const itemGap = sectionItemGap(props, 12)
  // Only drive an explicit tile height once the owner actually uses the "Card size"
  // slider — otherwise keep the natural aspect-ratio tiles so existing galleries are unchanged.
  const hasItemSize = props.item_size != null && props.item_size !== ''
  const itemSize = hasItemSize ? sectionItemSize(props, 160) : undefined
  const imageShape = imageShapeFromProps(props, 'rounded')
  const tileWrap = catalogTileImageWrapperClass(imageShape)
  const tileImg = catalogTileImageClass(imageShape)
  const showNav = props.show_nav === true
  const pageSizeRaw = Number(props.page_size)
  const requestedPageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
    ? Math.min(24, Math.floor(pageSizeRaw))
    : DEFAULT_PAGE_SIZE
  // Keep full rows so Previous/Next never collapses the configured column count.
  const pageSize = Math.min(
    24,
    Math.max(columns, Math.ceil(requestedPageSize / columns) * columns),
  )
  const propImagesRaw = Array.isArray(props.images)
    ? (props.images as { src?: string; alt?: string; caption?: string }[])
    : []
  const propImages = visibleArrayEntries(propImagesRaw, props, 'images')
    .map(({ item: img, index: rawIndex }) => ({ img, rawIndex }))
    .filter(({ img }) => typeof img?.src === 'string' && img.src)
  const liveImages = liveItems.filter(i => i.image_url).map(i => ({ url: i.image_url as string, alt: i.title }))
  const images = propImages.length > 0
    ? propImages.map(({ img, rawIndex }) => ({
        url: img.src as string,
        alt: img.alt || '',
        item: img as Record<string, unknown>,
        index: rawIndex,
      }))
    : liveImages.map((li, i) => ({ url: li.url, alt: li.alt, item: undefined as Record<string, unknown> | undefined, index: i }))

  const pageCount = Math.max(1, Math.ceil(images.length / pageSize))
  const paged = showNav && images.length > pageSize
  const visible = paged ? images.slice(page * pageSize, page * pageSize + pageSize) : images
  const displayIndexOf = (i: number) => (paged ? page * pageSize : 0) + i

  useEffect(() => {
    setPage(p => Math.min(p, pageCount - 1))
  }, [pageCount])

  useEffect(() => {
    if (lightboxIndex == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null)
      if (e.key === 'ArrowLeft') setLightboxIndex(i => (i == null ? i : (i - 1 + images.length) % images.length))
      if (e.key === 'ArrowRight') setLightboxIndex(i => (i == null ? i : (i + 1) % images.length))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, images.length])

  if (images.length === 0) {
    return (
      <BlockEmptyPlaceholder
        style={style}
        title={title ?? undefined}
        message="Add photos to bring this gallery to life. Use Images & media in the builder or upload from the Media panel."
        hint="You can also drag images directly onto this section from your media library."
        icon={<ImageIcon className="w-10 h-10" style={{ color: style.primary_color }} />}
      />
    )
  }

  const openLightbox = (displayIndex: number) => {
    if (isEditorCanvas) return
    setLightboxIndex(displayIndex)
  }

  const goLightbox = (delta: number, e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setLightboxIndex(i => (i == null ? i : (i + delta + images.length) % images.length))
  }

  const goPage = (delta: number, e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setPage(p => (p + delta + pageCount) % pageCount)
  }

  const Img = ({ url, alt, className, index, displayIndex, item, heightPx }: {
    url: string
    alt: string
    className?: string
    index: number
    displayIndex: number
    item?: Record<string, unknown>
    heightPx?: number
  }) => {
    const resolved = imgUrl(url)
    // Circle tiles stay square; everything else honours the "Card size" slider (item_size).
    const useFixedHeight = heightPx != null && imageShape !== 'circle'
    const shellClass = cn(
      'relative w-full overflow-hidden',
      tileWrap,
      imageShape === 'circle' && (showNav
        ? 'aspect-square w-full'
        : 'aspect-square max-w-[min(100%,280px)] mx-auto'),
    )
    const frameStyle = {
      ...(item ? arrayItemImageFrameStyle(item) : {}),
      ...(useFixedHeight ? { height: heightPx } : {}),
    }
    if (isEditorCanvas) {
      return (
        <div className={cn(shellClass, className)} style={frameStyle}>
          <BuilderSectionImage
            blockId={blockId}
            field="image_url"
            arrayKey="images"
            index={index}
            itemField="src"
            blockProps={props}
            src={resolved}
            alt={alt}
            className={cn('absolute inset-0 h-full w-full', tileImg)}
          />
        </div>
      )
    }
    return (
      <div className={cn(shellClass, className)} style={frameStyle} onClick={() => openLightbox(displayIndex)}>
        <img
          src={resolved}
          alt={alt}
          className={cn('absolute inset-0 h-full w-full cursor-pointer hover:opacity-90', tileImg)}
          style={item ? arrayItemImageRenderStyle(item, props) : undefined}
          loading="lazy"
        />
      </div>
    )
  }

  const controlBtnClass =
    'absolute top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-md transition hover:bg-black/65 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70'

  const lightboxImage = lightboxIndex != null ? images[lightboxIndex] : null

  const pageNav = paged ? (
    <div className="mt-6 flex items-center justify-center gap-4">
      <button
        type="button"
        aria-label="Previous images"
        onClick={e => goPage(-1, e)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="text-sm text-gray-600 tabular-nums">{page + 1} / {pageCount}</span>
      <button
        type="button"
        aria-label="Next images"
        onClick={e => goPage(1, e)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  ) : null

  return (
    <section className={builderSectionContainerClass()}>
      {(showTitle) && (
        <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title ?? ''} as="h2" className="text-3xl font-bold text-gray-900 mb-8 text-center" placeholder="Section title" />
      )}
      {layout === 'featured' && !showNav ? (
        <div className="grid grid-cols-3 grid-rows-2 max-w-5xl mx-auto min-h-[320px]" style={{ gap: itemGap }}>
          <Img url={visible[0].url} alt={visible[0].alt} index={visible[0].index} displayIndex={displayIndexOf(0)} item={visible[0].item} className="col-span-2 row-span-2 h-full min-h-[280px] rounded-xl" />
          {visible.slice(1, 3).map((img, i) => (
            <Img key={i} url={img.url} alt={img.alt} index={img.index} displayIndex={displayIndexOf(1 + i)} item={img.item} className="h-full min-h-[130px]" />
          ))}
        </div>
      ) : layout === 'masonry' && !showNav ? (
        <div className={cn('columns-2 sm:columns-3 gap-4 space-y-4 max-w-5xl mx-auto', columns >= 4 && 'lg:columns-4', columns >= 5 && 'lg:columns-5')} style={{ columnGap: itemGap }}>
          {visible.map((img, i) => (
            <Img key={i} url={img.url} alt={img.alt} index={img.index} displayIndex={displayIndexOf(i)} item={img.item} heightPx={itemSize ?? 240} className="break-inside-avoid mb-4" />
          ))}
        </div>
      ) : (
        <div className={cn('grid max-w-5xl mx-auto', sectionGridColumnClass(columns, previewBp))} style={{ gap: itemGap }}>
          {visible.map((img, i) => (
            <Img
              key={i}
              url={img.url}
              alt={img.alt}
              index={img.index}
              displayIndex={displayIndexOf(i)}
              item={img.item}
              heightPx={itemSize}
              className={itemSize != null ? undefined : columns <= 2 ? 'aspect-[4/3]' : 'aspect-square'}
            />
          ))}
        </div>
      )}
      {pageNav}
      {lightboxImage && lightboxIndex != null && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setLightboxIndex(null)}>
          <button type="button" className="absolute top-4 right-4 text-white" onClick={() => setLightboxIndex(null)} aria-label="Close gallery">
            <X className="w-8 h-8" />
          </button>
          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={e => goLightbox(-1, e)}
                className={cn(controlBtnClass, 'left-4 sm:left-6')}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={e => goLightbox(1, e)}
                className={cn(controlBtnClass, 'right-4 sm:right-6')}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
          <img
            src={imgUrl(lightboxImage.url)}
            alt={lightboxImage.alt}
            className="max-w-full max-h-full rounded-xl"
            onClick={e => e.stopPropagation()}
          />
          {images.length > 1 && (
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/80 tabular-nums">
              {lightboxIndex + 1} / {images.length}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
