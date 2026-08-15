import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Box,
  Check,
  ChevronLeft,
  ChevronRight,
  Crop,
  Download,
  Film,
  FlipHorizontal,
  FlipVertical,
  Loader2,
  RotateCcw,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImageCropModal } from '@/components/common/ImageCropModal'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import {
  buildImagePreviewTransform,
  hasImageEdits,
  renderEditedImageFile,
  urlToImageFile,
  type ImageEditTransform,
} from '@/lib/mediaImageEdit'
import { cn, mediaUrl } from '@/lib/utils'
import { toast } from 'sonner'

export type LightboxMediaItem = {
  id: string
  url: string
  media_type?: 'image' | 'video' | 'model3d'
  alt_text?: string
}

const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const ZOOM_STEP = 0.25
const DEFAULT_TRANSFORM: ImageEditTransform = { rotation: 0, flipH: false, flipV: false }

function resolveMediaUrl(url: string) {
  if (url.startsWith('blob:') || url.startsWith('data:')) return url
  return mediaUrl(url)
}

export function useCatalogMediaLightbox(itemCount: number) {
  const [index, setIndex] = useState<number | null>(null)

  const open = useCallback((i: number) => setIndex(i), [])
  const close = useCallback(() => setIndex(null), [])

  const goPrev = useCallback(() => {
    if (itemCount <= 0) return
    setIndex((i) => (i === null ? null : (i - 1 + itemCount) % itemCount))
  }, [itemCount])

  const goNext = useCallback(() => {
    if (itemCount <= 0) return
    setIndex((i) => (i === null ? null : (i + 1) % itemCount))
  }, [itemCount])

  return { index, open, close, goPrev, goNext, isOpen: index !== null }
}

type CatalogMediaLightboxProps = {
  items: LightboxMediaItem[]
  index: number | null
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  editable?: boolean
  onSaveImage?: (index: number, file: File) => Promise<void>
}

export function CatalogMediaLightbox({
  items,
  index,
  onClose,
  onPrev,
  onNext,
  editable = false,
  onSaveImage,
}: CatalogMediaLightboxProps) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [transform, setTransform] = useState<ImageEditTransform>(DEFAULT_TRANSFORM)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)
  const item = index !== null ? items[index] : null
  const mt = item?.media_type || 'image'
  const isImage = mt === 'image'
  const canZoom = isImage
  const canPan = canZoom && zoom > 1
  const canEdit = editable && isImage && !!onSaveImage
  const hasMultiple = items.length > 1

  useEscapeToClose(onClose, index !== null && !cropFile)

  const resetView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setTransform(DEFAULT_TRANSFORM)
  }, [])

  useEffect(() => {
    resetView()
  }, [index, resetView])

  useEffect(() => {
    if (index === null) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [index])

  useEffect(() => {
    if (index === null) return

    const onKey = (e: KeyboardEvent) => {
      if (cropFile) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        onNext()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, onPrev, onNext, cropFile])

  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100))

  const applyZoom = (next: number) => {
    const clamped = clampZoom(next)
    setZoom(clamped)
    if (clamped <= 1) setPan({ x: 0, y: 0 })
  }

  const toggleDoubleClickZoom = () => {
    if (zoom <= 1) setZoom(2)
    else resetView()
  }

  const rotateLeft = () => setTransform((t) => ({ ...t, rotation: t.rotation - 90 }))
  const rotateRight = () => setTransform((t) => ({ ...t, rotation: t.rotation + 90 }))
  const flipH = () => setTransform((t) => ({ ...t, flipH: !t.flipH }))
  const flipV = () => setTransform((t) => ({ ...t, flipV: !t.flipV }))

  const openCrop = async () => {
    if (!item || !canEdit) return
    try {
      const src = resolveMediaUrl(item.url)
      let file = await urlToImageFile(src, `media-${item.id}.jpg`)
      if (hasImageEdits(transform)) {
        file = await renderEditedImageFile(src, transform, file.name)
      }
      setCropFile(file)
    } catch {
      toast.error('Could not open crop tool')
    }
  }

  const saveEdits = async (fileOverride?: File) => {
    if (!item || index === null || !onSaveImage) return
    setSaving(true)
    try {
      let file = fileOverride
      if (!file) {
        const src = resolveMediaUrl(item.url)
        file = hasImageEdits(transform)
          ? await renderEditedImageFile(src, transform, `media-${item.id}.jpg`)
          : await urlToImageFile(src, `media-${item.id}.jpg`)
      }
      await onSaveImage(index, file)
      toast.success('Media updated')
      resetView()
      onClose()
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const downloadMedia = () => {
    if (!item) return
    const a = document.createElement('a')
    a.href = resolveMediaUrl(item.url)
    a.download = item.alt_text || `media-${item.id}`
    a.rel = 'noopener'
    a.click()
  }

  const onPanPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canPan || e.button !== 0 || cropFile) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    }
    setDragging(true)
  }

  const onPanPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    setPan({
      x: dragRef.current.panX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.panY + (e.clientY - dragRef.current.startY),
    })
  }

  const endPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  if (index === null || !item) return null

  const src = resolveMediaUrl(item.url)
  const editsDirty = hasImageEdits(transform)

  if (cropFile) {
    return (
      <ImageCropModal
        file={cropFile}
        title="Crop image"
        onConfirm={async (cropped) => {
          setCropFile(null)
          setTransform(DEFAULT_TRANSFORM)
          await saveEdits(cropped)
        }}
        onCancel={() => setCropFile(null)}
      />
    )
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[200] flex flex-col bg-black/55"
        role="dialog"
        aria-modal="true"
        aria-label="Media preview"
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-2 text-white">
          <span className="text-sm font-medium tabular-nums">
            {index + 1} / {items.length}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-1">
            {canZoom && (
              <>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white" disabled={zoom <= ZOOM_MIN} onClick={() => applyZoom(zoom - ZOOM_STEP)} aria-label="Zoom out">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="min-w-[3rem] text-center text-xs tabular-nums text-white/80">{Math.round(zoom * 100)}%</span>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white" disabled={zoom >= ZOOM_MAX} onClick={() => applyZoom(zoom + ZOOM_STEP)} aria-label="Zoom in">
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </>
            )}
            {canEdit && (
              <>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white" onClick={rotateLeft} aria-label="Rotate left">
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white" onClick={rotateRight} aria-label="Rotate right">
                  <RotateCw className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white" onClick={flipH} aria-label="Flip horizontal">
                  <FlipHorizontal className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white" onClick={flipV} aria-label="Flip vertical">
                  <FlipVertical className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white" onClick={openCrop} aria-label="Crop">
                  <Crop className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white" disabled={!editsDirty && zoom === 1} onClick={resetView} aria-label="Reset edits">
                  <RotateCcw className="h-4 w-4 opacity-70" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 gap-1 bg-white/15 text-white hover:bg-white/25"
                  disabled={saving || !editsDirty}
                  onClick={() => saveEdits()}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save
                </Button>
              </>
            )}
            {(mt === 'video' || mt === 'model3d') && (
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white" onClick={downloadMedia} aria-label="Download">
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white" onClick={onClose} aria-label="Close">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 py-2 sm:px-14">
          {hasMultiple && (
            <Button type="button" size="icon" variant="ghost" className="absolute left-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full text-white hover:bg-white/15 hover:text-white" onClick={onPrev} aria-label="Previous">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}

          <div
            className="relative flex h-full max-h-[calc(100vh-8.5rem)] w-full max-w-6xl items-center justify-center overflow-hidden rounded-2xl bg-white p-3 shadow-2xl sm:p-5"
            onPointerDown={canPan ? onPanPointerDown : undefined}
            onPointerMove={canPan ? onPanPointerMove : undefined}
            onPointerUp={canPan ? endPan : undefined}
            onPointerCancel={canPan ? endPan : undefined}
            style={{ cursor: canPan ? (dragging ? 'grabbing' : 'grab') : canZoom ? 'zoom-in' : 'default' }}
          >
            {mt === 'video' ? (
              <div className="flex h-full w-full items-center justify-center bg-white">
                <video key={src} src={src} className="max-h-full max-w-full rounded-lg" controls autoPlay playsInline />
              </div>
            ) : mt === 'model3d' ? (
              <div className="flex h-full w-full items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-3 rounded-xl bg-slate-50 px-8 py-10 text-slate-700">
                  <Box className="h-16 w-16 text-cyan-600" />
                  <p className="text-sm font-medium">3D model preview</p>
                  <p className="max-w-xs text-center text-xs text-slate-500">
                    Download the file or replace it from the media upload area.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white select-none touch-none">
                <img
                  key={`${src}-${transform.rotation}-${transform.flipH}-${transform.flipV}`}
                  src={src}
                  alt={item.alt_text || 'Media preview'}
                  className="max-h-full max-w-full object-contain object-center"
                  style={{
                    backgroundColor: '#ffffff',
                    transform: buildImagePreviewTransform(transform, pan, zoom),
                    transition: dragging ? 'none' : 'transform 150ms ease-out',
                  }}
                  draggable={false}
                  onDoubleClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    toggleDoubleClickZoom()
                  }}
                />
              </div>
            )}
          </div>

          {hasMultiple && (
            <Button type="button" size="icon" variant="ghost" className="absolute right-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full text-white hover:bg-white/15 hover:text-white" onClick={onNext} aria-label="Next">
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}
        </div>

        <div className="flex shrink-0 justify-center px-4 pb-3">
          {isImage ? (
            <span className="text-center text-xs text-white/60">
              {canEdit
                ? 'Rotate · Flip · Crop · Save · Double-click zoom · Drag when zoomed'
                : 'Double-click to zoom · Drag to pan when zoomed'}
            </span>
          ) : mt === 'video' ? (
            <span className="inline-flex items-center gap-1 text-xs text-white/60">
              <Film className="h-3 w-3" />Use player controls · Download to save a copy
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white">
              <Box className="h-3 w-3" />3D Model
            </span>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}

export function urlsToLightboxItems(
  urls: string[],
  opts?: {
    idPrefix?: string
    altText?: string | ((index: number) => string)
  },
): LightboxMediaItem[] {
  const prefix = opts?.idPrefix ?? 'img'
  return urls.map((url, i) => ({
    id: `${prefix}-${i}`,
    url,
    media_type: 'image' as const,
    alt_text:
      typeof opts?.altText === 'function'
        ? opts.altText(i)
        : opts?.altText ?? `Image ${i + 1}`,
  }))
}

export function CatalogMediaLightboxHost({
  items,
  children,
  editable,
  onSaveImage,
}: {
  items: LightboxMediaItem[]
  children: (ctx: ReturnType<typeof useCatalogMediaLightbox> & { items: LightboxMediaItem[] }) => ReactNode
  editable?: boolean
  onSaveImage?: (index: number, file: File) => Promise<void>
}) {
  const lightbox = useCatalogMediaLightbox(items.length)
  return (
    <>
      {children({ ...lightbox, items })}
      <CatalogMediaLightbox
        items={items}
        index={lightbox.index}
        onClose={lightbox.close}
        onPrev={lightbox.goPrev}
        onNext={lightbox.goNext}
        editable={editable}
        onSaveImage={onSaveImage}
      />
    </>
  )
}

export function ManagedImageLightbox({
  items,
  initialIndex,
  onClose,
  editable,
  onSaveImage,
}: {
  items: LightboxMediaItem[]
  initialIndex: number
  onClose: () => void
  editable?: boolean
  onSaveImage?: (index: number, file: File) => Promise<void>
}) {
  const lightbox = useCatalogMediaLightbox(items.length)

  useEffect(() => {
    lightbox.open(initialIndex)
  }, [initialIndex, lightbox.open])

  if (items.length === 0) return null

  return (
    <CatalogMediaLightbox
      items={items}
      index={lightbox.index}
      onClose={() => {
        lightbox.close()
        onClose()
      }}
      onPrev={lightbox.goPrev}
      onNext={lightbox.goNext}
      editable={editable && !!onSaveImage}
      onSaveImage={onSaveImage}
    />
  )
}

export function ImageLightboxSession({
  items,
  openIndex,
  onClose,
  editable,
  onSaveImage,
}: {
  items: LightboxMediaItem[]
  openIndex: number | null
  onClose: () => void
  editable?: boolean
  onSaveImage?: (index: number, file: File) => Promise<void>
}) {
  if (openIndex === null || items.length === 0) return null
  return (
    <ManagedImageLightbox
      key={`${items[openIndex]?.id ?? openIndex}-${openIndex}`}
      items={items}
      initialIndex={openIndex}
      onClose={onClose}
      editable={editable}
      onSaveImage={onSaveImage}
    />
  )
}

export function ClickableImageButton({
  src,
  alt = 'Image',
  title = 'View and edit image',
  className,
  imgClassName = 'h-full w-full object-cover',
  onClick,
}: {
  src: string
  alt?: string
  title?: string
  className?: string
  imgClassName?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'block overflow-hidden ring-offset-1 hover:ring-2 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/50',
        className,
      )}
    >
      <img src={src} alt={alt} className={imgClassName} />
    </button>
  )
}

export function SingleImagePreview({
  url,
  alt = 'Image',
  resolveUrl = resolveMediaUrl,
  className,
  imgClassName,
  editable,
  onSave,
  children,
  viewOnlyTitle = 'View image',
  editTitle = 'View and edit image',
}: {
  url: string
  alt?: string
  resolveUrl?: (url: string) => string
  className?: string
  imgClassName?: string
  editable?: boolean
  onSave?: (file: File) => Promise<void>
  children?: ReactNode
  viewOnlyTitle?: string
  editTitle?: string
}) {
  const [open, setOpen] = useState(false)
  const items = useMemo(() => urlsToLightboxItems([url], { altText: alt }), [url, alt])

  return (
    <>
      <div className={cn('relative', className)}>
        <ClickableImageButton
          src={resolveUrl(url)}
          alt={alt}
          title={editable && onSave ? editTitle : viewOnlyTitle}
          imgClassName={imgClassName}
          onClick={() => setOpen(true)}
        />
        {children}
      </div>
      {open && (
        <ManagedImageLightbox
          key={url}
          items={items}
          initialIndex={0}
          editable={editable && !!onSave}
          onSaveImage={onSave ? async (_i, file) => onSave(file) : undefined}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
