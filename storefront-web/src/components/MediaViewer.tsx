import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { cn, imgUrl } from '@/lib/utils'
import { ensureModelViewerScript } from '@/lib/modelViewerLoader'
import {
  CatalogMediaLightbox,
  useCatalogMediaLightbox,
  type LightboxMediaItem,
} from '@/components/common/CatalogMediaLightbox'
import { ImageHoverZoom } from '@/components/products/ImageHoverZoom'
import { ProductImagePlaceholder } from '@/components/products/ProductThumb'
import { Play, Pause, Volume2, VolumeX, Maximize, Box, Camera, RotateCcw, RotateCw, X } from 'lucide-react'

type MediaType = 'image' | 'video' | 'model3d'

interface MediaItem {
  id: string
  url: string
  alt_text?: string
  is_primary: boolean
  media_type?: MediaType
}

export type MediaViewerLayout = 'detail' | 'square' | 'fit' | 'fill'
export type MediaViewerThumbnailPosition = 'bottom' | 'left'

interface MediaViewerProps {
  items: MediaItem[]
  selectedIndex: number
  onSelect: (i: number) => void
  productName: string
  badges?: React.ReactNode
  /** e.g. wishlist — pinned to the top-right of the main stage */
  topRightOverlay?: React.ReactNode
  /** `detail` — square hero (default). `square` — full-width square. `fit` — 4:3, fills frame. `fill` — stretches to parent height. */
  layout?: MediaViewerLayout
  /** Vertical thumbnails on the left when multiple images exist. */
  thumbnailPosition?: MediaViewerThumbnailPosition
  className?: string
}

const STAGE_LAYOUT: Record<MediaViewerLayout, { stage: string; image: string; video: string }> = {
  detail: {
    stage: 'aspect-square w-full max-w-[640px] mx-auto lg:mx-0',
    image: 'object-cover',
    video: 'object-contain',
  },
  square: {
    stage: 'aspect-square w-full',
    image: 'object-cover',
    video: 'object-contain',
  },
  fit: {
    stage: 'aspect-[4/3] w-full max-w-[640px] mx-auto lg:mx-0',
    image: 'object-cover',
    video: 'object-cover',
  },
  fill: {
    stage: 'h-full min-h-[240px] w-full',
    image: 'object-cover',
    video: 'object-cover',
  },
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string
        alt?: string
        ar?: boolean
        'ar-modes'?: string
        'camera-controls'?: boolean
        'touch-action'?: string
        'auto-rotate'?: boolean
        poster?: string
        loading?: string
        'shadow-intensity'?: string
        'environment-image'?: string
      }, HTMLElement>
    }
  }
}

function VideoPlayer({ url, alt, videoClassName }: { url: string; alt?: string; videoClassName?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)

  const toggle = () => {
    if (!videoRef.current) return
    if (playing) { videoRef.current.pause() } else { videoRef.current.play() }
    setPlaying(!playing)
  }

  return (
    <div className="relative w-full h-full group">
      <video
        ref={videoRef}
        src={imgUrl(url)}
        className={cn('w-full h-full', videoClassName ?? 'object-contain p-4')}
        muted={muted}
        loop
        playsInline
        onClick={toggle}
      />
      <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={toggle} className="bg-black/60 backdrop-blur-sm text-white rounded-full p-2 hover:bg-black/80 transition-colors">
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button onClick={() => setMuted(!muted)} className="bg-black/60 backdrop-blur-sm text-white rounded-full p-2 hover:bg-black/80 transition-colors">
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button onClick={() => videoRef.current?.requestFullscreen()} className="bg-black/60 backdrop-blur-sm text-white rounded-full p-2 hover:bg-black/80 transition-colors ml-auto">
          <Maximize className="w-4 h-4" />
        </button>
      </div>
      <span className="absolute top-3 right-3 bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
        <Play className="w-3 h-3" />Video
      </span>
    </div>
  )
}

function Model3DViewer({ url, alt, poster, minHeight = 300 }: { url: string; alt?: string; poster?: string; minHeight?: number }) {
  const [arActive, setArActive] = useState(false)
  const [mvReady, setMvReady] = useState(false)
  const [mvError, setMvError] = useState(false)

  useEffect(() => {
    let cancelled = false
    ensureModelViewerScript()
      .then(() => {
        if (!cancelled) setMvReady(true)
      })
      .catch(() => {
        if (!cancelled) setMvError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (mvError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gray-50 text-center p-6 text-sm text-gray-600" style={{ minHeight }}>
        <Box className="w-10 h-10 text-gray-400" />
        <p>3D preview could not be loaded (network may block the viewer script).</p>
        <a href={imgUrl(url)} download className="text-blue-600 underline font-medium">Download model</a>
      </div>
    )
  }

  if (!mvReady) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 text-sm text-gray-500" style={{ minHeight }}>
        Loading 3D viewer…
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <model-viewer
        src={imgUrl(url)}
        alt={alt || '3D Model'}
        ar
        ar-modes="webxr scene-viewer quick-look"
        camera-controls
        touch-action="pan-y"
        auto-rotate
        poster={poster ? imgUrl(poster) : undefined}
        shadow-intensity="1"
        environment-image="neutral"
        style={{ width: '100%', height: '100%', minHeight }}
      >
        <button
          slot="ar-button"
          onClick={() => setArActive(true)}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center gap-2"
        >
          <Camera className="w-4 h-4" />
          Try On with Camera
        </button>
      </model-viewer>
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <span className="bg-cyan-600 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          <Box className="w-3 h-3" />3D &amp; AR
        </span>
      </div>
      <div className="absolute top-3 left-3">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 text-xs text-gray-500 flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> Drag to rotate &middot; Pinch to zoom
        </div>
      </div>
    </div>
  )
}

function ThumbnailItem({
  item,
  isSelected,
  onClick,
  vertical = false,
}: {
  item: MediaItem
  isSelected: boolean
  onClick: () => void
  vertical?: boolean
}) {
  const mt = item.media_type || 'image'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border-2 overflow-hidden shrink-0 transition-all relative',
        vertical ? 'w-14 h-14 sm:w-16 sm:h-16' : 'w-16 h-16 sm:w-20 sm:h-20',
        isSelected ? 'border-blue-600 ring-1 ring-blue-600' : 'border-gray-200 hover:border-gray-400',
      )}
    >
      {mt === 'video' ? (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center relative">
          <video src={imgUrl(item.url)} className="w-full h-full object-cover" muted preload="metadata" />
          <Play className="absolute w-5 h-5 text-white drop-shadow-lg" />
        </div>
      ) : mt === 'model3d' ? (
        <div className="w-full h-full bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center">
          <Box className="w-6 h-6 text-cyan-600" />
        </div>
      ) : (
        <img src={imgUrl(item.url)} alt="" className="w-full h-full object-cover" />
      )}
      {mt !== 'image' && (
        <span className={`absolute bottom-0.5 right-0.5 text-[8px] font-bold text-white px-1 rounded ${mt === 'video' ? 'bg-primary' : 'bg-cyan-600'}`}>
          {mt === 'video' ? 'VID' : '3D'}
        </span>
      )}
    </button>
  )
}

export default function MediaViewer({
  items,
  selectedIndex,
  onSelect,
  productName,
  badges,
  topRightOverlay,
  layout = 'detail',
  thumbnailPosition = 'bottom',
  className,
}: MediaViewerProps) {
  const selected = items[selectedIndex]
  const mt = selected?.media_type || 'image'
  const firstImage = items.find(i => (i.media_type || 'image') === 'image')
  const stage = STAGE_LAYOUT[layout]
  const fillHeight = layout === 'fill'
  const modelMinHeight = layout === 'detail' ? 320 : 300
  const useLeftThumbs = items.length > 1 && thumbnailPosition === 'left'

  const lightboxItems = useMemo<LightboxMediaItem[]>(
    () => items.map(item => ({
      id: item.id,
      url: item.url,
      media_type: item.media_type,
      alt_text: item.alt_text,
    })),
    [items],
  )
  const lightbox = useCatalogMediaLightbox(lightboxItems.length)
  const [isDragging360, setIsDragging360] = useState(false)
  const [mainImageFailed, setMainImageFailed] = useState(false)
  const spinDragRef = useRef<{ startX: number; anchorIndex: number; moved: boolean } | null>(null)

  useEffect(() => {
    setMainImageFailed(false)
  }, [selected?.url, selectedIndex])

  const imageItems = useMemo(
    () => items.filter((i) => (i.media_type || 'image') === 'image'),
    [items],
  )
  const imageItemIndices = useMemo(
    () => imageItems.map((img) => items.findIndex((i) => i.id === img.id)),
    [items, imageItems],
  )
  const can360 = imageItems.length >= 3

  const spinToOffset = useCallback(
    (offsetSteps: number, anchorIndex: number) => {
      const anchorSpinIdx = imageItemIndices.indexOf(anchorIndex)
      if (anchorSpinIdx < 0 || imageItemIndices.length === 0) return
      const len = imageItemIndices.length
      const nextSpinIdx = (((anchorSpinIdx + offsetSteps) % len) + len) % len
      const nextItemIdx = imageItemIndices[nextSpinIdx]
      if (nextItemIdx >= 0 && nextItemIdx !== selectedIndex) onSelect(nextItemIdx)
    },
    [imageItemIndices, onSelect, selectedIndex],
  )

  const openLightbox = useCallback(() => {
    if (!selected || lightboxItems.length === 0) return
    lightbox.open(selectedIndex)
  }, [selected, lightboxItems.length, lightbox, selectedIndex])

  const handleImagePointerDown = (e: React.PointerEvent) => {
    if (!can360 || mt !== 'image') return
    spinDragRef.current = { startX: e.clientX, anchorIndex: selectedIndex, moved: false }
    setIsDragging360(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleImagePointerMove = (e: React.PointerEvent) => {
    const drag = spinDragRef.current
    if (!drag || !can360) return
    const dx = e.clientX - drag.startX
    if (Math.abs(dx) > 4) drag.moved = true
    const steps = -Math.round(dx / 28)
    spinToOffset(steps, drag.anchorIndex)
  }

  const handleImagePointerUp = (e: React.PointerEvent) => {
    const drag = spinDragRef.current
    spinDragRef.current = null
    setIsDragging360(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (drag && !drag.moved && mt === 'image') openLightbox()
  }

  useEffect(() => {
    if (lightbox.index !== null && lightbox.index !== selectedIndex) {
      onSelect(lightbox.index)
    }
  }, [lightbox.index, selectedIndex, onSelect])

  const thumbnailRail = items.length > 1 ? (
    <div
      className={cn(
        useLeftThumbs
          ? 'flex flex-row gap-2 shrink-0 overflow-x-auto pb-1 scrollbar-hide md:flex-col md:max-h-[640px] md:overflow-y-auto md:overflow-x-hidden md:pb-0 md:pr-0.5 md:scrollbar-thin'
          : 'flex gap-2 overflow-x-auto scrollbar-hide pb-1',
      )}
    >
      {items.map((item, i) => (
        <ThumbnailItem
          key={item.id}
          item={item}
          isSelected={i === selectedIndex}
          onClick={() => onSelect(i)}
          vertical={useLeftThumbs}
        />
      ))}
    </div>
  ) : null

  return (
    <div
      className={cn(
        useLeftThumbs
          ? 'flex flex-col gap-3 md:flex-row md:items-stretch'
          : fillHeight
            ? 'flex min-h-0 flex-col gap-3'
            : 'space-y-3',
        fillHeight && 'h-full',
        className,
      )}
    >
      {useLeftThumbs ? thumbnailRail : null}
      <div className={cn('min-w-0', useLeftThumbs ? 'flex-1' : 'w-full', fillHeight && 'flex min-h-0 flex-1 flex-col')}>
      <div className={cn('bg-gray-50 rounded-xl overflow-hidden border relative group/stage', stage.stage, fillHeight && 'min-h-0 flex-1')}>
        {!selected || (mt === 'image' && mainImageFailed) ? (
          <div className="absolute inset-0">
            <ProductImagePlaceholder size="lg" />
          </div>
        ) : mt === 'video' ? (
          <div className="absolute inset-0">
            <VideoPlayer url={selected.url} alt={selected.alt_text} videoClassName={stage.video} />
            <button
              type="button"
              onClick={openLightbox}
              className="absolute top-3 left-3 z-10 rounded-full bg-black/55 p-2 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover/stage:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              aria-label="Open full screen preview"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        ) : mt === 'model3d' ? (
          <div className="absolute inset-0">
            <Model3DViewer
              url={selected.url}
              alt={productName}
              poster={firstImage ? imgUrl(firstImage.url) : undefined}
              minHeight={modelMinHeight}
            />
            <button
              type="button"
              onClick={openLightbox}
              className="absolute bottom-3 right-3 z-10 rounded-full bg-black/55 p-2 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover/stage:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              aria-label="Open full screen preview"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            className={cn(
              'absolute inset-0',
              can360 && (isDragging360 ? 'cursor-grabbing' : 'cursor-grab'),
            )}
            onPointerDown={handleImagePointerDown}
            onPointerMove={handleImagePointerMove}
            onPointerUp={handleImagePointerUp}
            onPointerCancel={handleImagePointerUp}
          >
            <ImageHoverZoom
              src={selected.url}
              alt={selected.alt_text || productName}
              imgClassName={stage.image}
              disabled={isDragging360}
              onClick={can360 ? undefined : openLightbox}
              onError={() => setMainImageFailed(true)}
            />
            {can360 && !isDragging360 && (
              <span className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover/stage:opacity-100">
                <RotateCw className="h-3.5 w-3.5" aria-hidden />
                Drag for 360°
              </span>
            )}
            {can360 && (
              <span className="pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                360°
              </span>
            )}
          </div>
        )}
        {mt === 'image' && (
          <div className="pointer-events-none absolute inset-0 z-[1]">
            {badges}
          </div>
        )}
        {topRightOverlay ? (
          <div className="absolute top-3 right-3 z-20 pointer-events-auto">
            {topRightOverlay}
          </div>
        ) : null}
      </div>
      {!useLeftThumbs ? thumbnailRail : null}
      </div>
      <CatalogMediaLightbox
        items={lightboxItems}
        index={lightbox.index}
        onClose={lightbox.close}
        onPrev={lightbox.goPrev}
        onNext={lightbox.goNext}
      />
    </div>
  )
}
