import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, X, Star, Loader2, Film, Box, Image as ImageIcon, GripVertical } from 'lucide-react'
import { useImageSourcePicker } from './ImageSourcePicker'
import {
  CatalogMediaLightboxHost,
  type LightboxMediaItem,
} from './CatalogMediaLightbox'

import { cn, mediaUrl } from '@/lib/utils'

function resolveUrl(url: string) {
  return mediaUrl(url)
}

function getMediaType(file: File): 'image' | 'video' | 'model3d' {
  if (file.type.startsWith('video/')) return 'video'
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'glb' || ext === 'gltf') return 'model3d'
  return 'image'
}

export function reorderMediaList<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function adjustPrimaryIndexOnReorder(primary: number, from: number, to: number): number {
  if (primary === from) return to
  if (from < primary && to >= primary) return primary - 1
  if (from > primary && to <= primary) return primary + 1
  return primary
}

export function adjustPrimaryIndexOnRemove(primary: number, removed: number, remainingCount: number): number {
  if (remainingCount === 0) return 0
  if (removed === primary) return Math.min(primary, remainingCount - 1)
  if (removed < primary) return primary - 1
  return primary
}

export function findFirstImageIndex(files: File[]): number {
  return files.findIndex((f) => f.type.startsWith('image/'))
}

interface ProductImage {
  id: string
  url: string
  alt_text?: string
  position: number
  is_primary: boolean
  media_type?: 'image' | 'video' | 'model3d'
}

interface ProductImageUploadProps {
  images: ProductImage[]
  onUpload: (file: File) => Promise<void>
  onDelete: (imageId: string) => Promise<void>
  onSetPrimary: (imageId: string) => Promise<void>
  onReorder?: (imageIds: string[]) => Promise<void>
  onEditImage?: (imageId: string, file: File, wasPrimary: boolean) => Promise<void>
  disabled?: boolean
}

const ACCEPT = 'image/*,image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.glb,.gltf'
export const MEDIA_ACCEPT = ACCEPT

const MEDIA_DEVICE_HINT = 'Images, videos, or 3D models (JPG, PNG, WebP, GIF, MP4, WebM, MOV, GLB/GLTF) from your device.'
const MEDIA_PICKER_HINT = 'Device · Gallery · URL'
export const MEDIA_FORMATS_HELPER = 'JPG, PNG, WebP, GIF · MP4, WebM, MOV · GLB/GLTF'

/** Compact but readable catalog media UI for product/service forms. */
const catalogMediaCompact = {
  root: 'space-y-1',
  row: 'flex items-center gap-1.5',
  rowStacked: 'flex flex-col items-stretch gap-1.5',
  dropzone:
    'flex h-[4.25rem] w-[6.5rem] max-w-full shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-gray-300 bg-gray-50/90 px-1.5 text-center shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50/60',
  dropzoneStacked:
    'flex h-[3.25rem] w-full max-w-none shrink-0 flex-row items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 bg-gray-50/90 px-2 text-center shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50/60',
  dropzoneIcon: 'h-3.5 w-3.5 shrink-0 text-gray-500',
  dropzoneSpinner: 'h-3.5 w-3.5 shrink-0 text-blue-500 animate-spin',
  dropzoneTitle: 'text-[10px] font-medium leading-none text-gray-700',
  headerRow: 'mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5',
  headerTitle: 'text-xs font-semibold text-foreground',
  headerHelper: 'text-[11px] leading-snug text-gray-500',
  headerPickerHint: 'text-[10px] font-semibold tracking-wide text-primary',
  thumbStrip: 'flex min-w-0 flex-1 flex-wrap items-center gap-1.5',
  thumbStripStacked: 'flex w-full flex-wrap items-center gap-1',
  thumb: 'relative group aspect-[4/3] h-[4.25rem] w-[6.5rem] shrink-0 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm',
  thumbStacked: 'relative group aspect-[4/3] w-full min-h-[8.5rem] overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm',
  sectionLabel: 'flex items-center gap-1 text-[10px] font-medium text-gray-600',
  sectionLabelIcon: 'h-2.5 w-2.5',
  primaryBadge:
    'absolute left-0.5 top-0.5 z-[3] flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-yellow-900 shadow-sm',
  primaryBadgeIcon: 'h-2.5 w-2.5 fill-current',
  setPrimaryBtn:
    'absolute left-0.5 top-0.5 z-[4] flex h-4 w-4 items-center justify-center rounded-full bg-white/95 text-gray-600 shadow-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-yellow-400 hover:text-yellow-900',
  setPrimaryBtnIcon: 'h-2.5 w-2.5',
  orderBadge:
    'absolute bottom-0.5 left-0.5 z-[3] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/60 text-[8px] font-bold tabular-nums text-white shadow-sm',
  dragHandle:
    'absolute bottom-0.5 right-0.5 z-[4] flex cursor-grab items-center justify-center rounded bg-black/45 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing',
  dragHandleIcon: 'h-2.5 w-2.5',
  thumbDragging: 'opacity-50 ring-2 ring-primary/50',
  thumbDragOver: 'ring-2 ring-primary ring-offset-1',
  deleteBtn: 'absolute right-0.5 top-0.5 z-[5] rounded-full bg-red-500 p-0.5 text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100',
  deleteBtnIcon: 'h-2 w-2',
  model3dIcon: 'h-4 w-4',
  model3dLabel: 'mt-0.5 text-[7px] font-medium',
} as const

function PrimaryTopLeft({
  isPrimary,
  canSetPrimary,
  onSetPrimary,
}: {
  isPrimary?: boolean
  canSetPrimary?: boolean
  onSetPrimary?: () => void
}) {
  if (isPrimary) {
    return (
      <span className={catalogMediaCompact.primaryBadge} aria-label="Primary image">
        <Star className={catalogMediaCompact.primaryBadgeIcon} />
      </span>
    )
  }
  if (!canSetPrimary || !onSetPrimary) return null
  return (
    <button
      type="button"
      className={catalogMediaCompact.setPrimaryBtn}
      aria-label="Set as primary"
      onClick={(e) => { e.stopPropagation(); onSetPrimary() }}
    >
      <Star className={catalogMediaCompact.setPrimaryBtnIcon} />
    </button>
  )
}

function ThumbDeleteButton({ onClick, label = 'Remove' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={catalogMediaCompact.deleteBtn}
    >
      <X className={catalogMediaCompact.deleteBtnIcon} />
    </button>
  )
}

const EDIT_MEDIA_HELPER = 'Images, videos & 3D models'
export const STAGED_PRODUCT_HELPER = 'Images, videos & 3D models — uploaded after product is created'
export const STAGED_SERVICE_HELPER = 'Images, videos & 3D models — uploaded after service is created'
export const STAGED_VARIANT_HELPER = 'Images, videos & 3D models — uploaded when product is saved'

export function CatalogMediaSectionHeader({ helperText, title = 'Media' }: { helperText?: string; title?: string }) {
  return (
    <div className={catalogMediaCompact.headerRow}>
      <h3 className={catalogMediaCompact.headerTitle}>{title}</h3>
      {helperText ? (
        <span className={catalogMediaCompact.headerHelper}>{helperText}</span>
      ) : null}
      <span className={catalogMediaCompact.headerHelper} title="Allowed file formats">
        {MEDIA_FORMATS_HELPER}
      </span>
      <span className={catalogMediaCompact.headerPickerHint}>{MEDIA_PICKER_HINT}</span>
      <span className="text-[10px] text-muted-foreground">Drag to reorder · ★ primary</span>
    </div>
  )
}

function MediaBadge({ type }: { type: string }) {
  if (type === 'video') return <span className="absolute right-0.5 top-0.5 flex items-center gap-0.5 rounded-full bg-primary px-0.5 py-px text-[7px] font-semibold text-white"><Film className="h-2 w-2" />Video</span>
  if (type === 'model3d') return <span className="absolute right-0.5 top-0.5 flex items-center gap-0.5 rounded-full bg-cyan-600 px-0.5 py-px text-[7px] font-semibold text-white"><Box className="h-2 w-2" />3D</span>
  return null
}

function MediaPreview({ item, compact }: { item: ProductImage; compact?: boolean }) {
  const url = resolveUrl(item.url)
  const mt = item.media_type || 'image'

  if (mt === 'video') {
    return <video src={url} className="h-full w-full object-cover" muted loop playsInline onMouseOver={e => (e.target as HTMLVideoElement).play()} onMouseOut={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0 }} />
  }

  if (mt === 'model3d') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-cyan-50 to-blue-50 text-cyan-600">
        <Box className={compact ? catalogMediaCompact.model3dIcon : 'h-10 w-10'} />
        <span className={compact ? catalogMediaCompact.model3dLabel : 'mt-1 text-xs font-medium'}>3D</span>
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={item.alt_text || ''}
      className={cn(
        'h-full w-full object-contain object-center',
        compact ? 'p-1' : 'p-0.5',
      )}
    />
  )
}

function CatalogMediaThumb({
  onOpen,
  children,
  topLeft,
  topRight,
  orderNumber,
  size = 'default',
  draggable = false,
  isDragging = false,
  isDragOver = false,
  onDragHandleStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  onOpen: () => void
  children: ReactNode
  topLeft?: ReactNode
  topRight?: ReactNode
  orderNumber?: number
  size?: 'default' | 'stacked'
  draggable?: boolean
  isDragging?: boolean
  isDragOver?: boolean
  onDragHandleStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  onDragEnd?: () => void
}) {
  return (
    <div
      className={cn(
        size === 'stacked' ? catalogMediaCompact.thumbStacked : catalogMediaCompact.thumb,
        'group',
        isDragging && catalogMediaCompact.thumbDragging,
        isDragOver && catalogMediaCompact.thumbDragOver,
      )}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <button
        type="button"
        className="absolute inset-0 z-[1] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        onClick={onOpen}
        aria-label="View media"
      />
      <div className="relative z-0 h-full w-full">{children}</div>
      {orderNumber !== undefined && (
        <span className={catalogMediaCompact.orderBadge} aria-hidden>{orderNumber}</span>
      )}
      {topLeft}
      {topRight}
      {draggable && onDragHandleStart && (
        <span
          draggable
          onDragStart={onDragHandleStart}
          onDragEnd={onDragEnd}
          className={catalogMediaCompact.dragHandle}
          title="Drag to reorder"
          aria-label="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className={catalogMediaCompact.dragHandleIcon} />
        </span>
      )}
    </div>
  )
}

function useThumbDragReorder(onReorder: (from: number, to: number) => void) {
  const dragFrom = useRef<number | null>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleDragStart = useCallback((index: number) => (e: React.DragEvent) => {
    dragFrom.current = index
    setDraggingIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }, [])

  const handleDragOver = useCallback((index: number) => (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback((index: number) => (e: React.DragEvent) => {
    e.preventDefault()
    const from = dragFrom.current
    if (from !== null && from !== index) onReorder(from, index)
    dragFrom.current = null
    setDraggingIndex(null)
    setDragOverIndex(null)
  }, [onReorder])

  const handleDragEnd = useCallback(() => {
    dragFrom.current = null
    setDraggingIndex(null)
    setDragOverIndex(null)
  }, [])

  return { draggingIndex, dragOverIndex, handleDragStart, handleDragOver, handleDrop, handleDragEnd }
}

function CatalogMediaDropzone({
  disabled,
  uploading,
  onDrop,
  onClick,
  className,
  label,
}: {
  disabled?: boolean
  uploading?: boolean
  onDrop: (e: React.DragEvent) => void
  onClick: () => void
  className?: string
  label?: string
}) {
  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        catalogMediaCompact.dropzone,
        className,
        disabled ? 'cursor-not-allowed bg-gray-100 opacity-60' : 'cursor-pointer',
      )}
    >
      {uploading ? (
        <Loader2 className={catalogMediaCompact.dropzoneSpinner} />
      ) : (
        <Upload className={catalogMediaCompact.dropzoneIcon} />
      )}
      <p className={catalogMediaCompact.dropzoneTitle}>
        {uploading ? 'Uploading…' : (label ?? 'Click or drag here')}
      </p>
    </div>
  )
}

export function ProductImageUpload({ images, onUpload, onDelete, onSetPrimary, onReorder, onEditImage, disabled }: ProductImageUploadProps) {
  const [uploading, setUploading] = useState(false)

  const sortedImages = useMemo(
    () => [...images].sort((a, b) => a.position - b.position),
    [images],
  )

  const handleReorder = useCallback((from: number, to: number) => {
    if (!onReorder) return
    const ids = reorderMediaList(sortedImages.map((img) => img.id), from, to)
    void onReorder(ids)
  }, [onReorder, sortedImages])

  const thumbDrag = useThumbDragReorder(handleReorder)

  const processFiles = useCallback(async (files: File[]) => {
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      try { await onUpload(file) } catch { /* handled by caller */ }
    }
    setUploading(false)
  }, [onUpload])

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return
    void processFiles(Array.from(files))
  }, [processFiles])

  const handlePickerFile = useCallback(async (file: File) => {
    await processFiles([file])
  }, [processFiles])

  const handlePickerFiles = useCallback((files: File[]) => {
    void processFiles(files)
  }, [processFiles])

  const { openPicker, modal: pickerModal } = useImageSourcePicker({
    title: 'Product media',
    accept: ACCEPT,
    deviceHint: MEDIA_DEVICE_HINT,
    galleryMultiSelect: true,
    onFile: handlePickerFile,
    onFiles: handlePickerFiles,
  })

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const imageItems = sortedImages.filter(i => (i.media_type || 'image') === 'image')
  const videoItems = sortedImages.filter(i => i.media_type === 'video')
  const modelItems = sortedImages.filter(i => i.media_type === 'model3d')

  return (
    <div className={catalogMediaCompact.root}>
      {pickerModal}
      <div className={catalogMediaCompact.row}>
        <CatalogMediaDropzone
          disabled={disabled}
          uploading={uploading}
          onDrop={handleDrop}
          onClick={() => !disabled && !uploading && openPicker()}
        />

        {sortedImages.length > 0 && (
          <CatalogMediaLightboxHost
            items={sortedImages.map((item) => ({
              id: item.id,
              url: item.url,
              media_type: item.media_type || 'image',
              alt_text: item.alt_text,
            }))}
            editable={!!onEditImage}
            onSaveImage={
              onEditImage
                ? async (index, file) => {
                    const item = sortedImages[index]
                    if (!item) return
                    await onEditImage(item.id, file, item.is_primary)
                  }
                : undefined
            }
          >
            {({ open }) => (
              <div className={catalogMediaCompact.thumbStrip}>
                {imageItems.length > 0 && videoItems.length + modelItems.length > 0 && (
                  <p className={cn(catalogMediaCompact.sectionLabel, 'mb-1 w-full')}><ImageIcon className={catalogMediaCompact.sectionLabelIcon} />Images ({imageItems.length})</p>
                )}
                {sortedImages.map((item, i) => (
                  <CatalogMediaThumb
                    key={item.id}
                    orderNumber={i + 1}
                    draggable={!!onReorder && !disabled}
                    isDragging={thumbDrag.draggingIndex === i}
                    isDragOver={thumbDrag.dragOverIndex === i}
                    onDragHandleStart={thumbDrag.handleDragStart(i)}
                    onDragOver={thumbDrag.handleDragOver(i)}
                    onDrop={thumbDrag.handleDrop(i)}
                    onDragEnd={thumbDrag.handleDragEnd}
                    onOpen={() => open(i)}
                    topLeft={
                      <PrimaryTopLeft
                        isPrimary={item.is_primary}
                        canSetPrimary={(item.media_type || 'image') === 'image'}
                        onSetPrimary={() => onSetPrimary(item.id)}
                      />
                    }
                    topRight={<ThumbDeleteButton onClick={() => onDelete(item.id)} label="Delete" />}
                  >
                    <MediaPreview item={item} compact />
                    <MediaBadge type={item.media_type || 'image'} />
                  </CatalogMediaThumb>
                ))}
              </div>
            )}
          </CatalogMediaLightboxHost>
        )}
      </div>
    </div>
  )
}


interface ServiceMediaItem {
  id: string
  url: string
  media_type: 'image' | 'video' | 'model3d'
  is_primary: boolean
  alt_text?: string
  position: number
}

interface ServiceMediaUploadProps {
  media: ServiceMediaItem[]
  onUpload: (file: File) => Promise<void>
  onDelete: (mediaId: string) => Promise<void>
  onSetPrimary: (mediaId: string) => Promise<void>
  onReorder?: (mediaIds: string[]) => Promise<void>
  onEditMedia?: (mediaId: string, file: File, wasPrimary: boolean) => Promise<void>
  disabled?: boolean
  /** Label shown in the media source picker modal. Defaults to 'Service media'. */
  pickerTitle?: string
}

/** Generic re-export alias — use this for any catalog entity (products, services, rentals, …). */
export { ServiceMediaUpload as CatalogMediaUpload }
export type { ServiceMediaUploadProps as CatalogMediaUploadProps }

export function ServiceMediaUpload({ media, onUpload, onDelete, onSetPrimary, onReorder, onEditMedia, disabled, pickerTitle = 'Media' }: ServiceMediaUploadProps) {
  const [uploading, setUploading] = useState(false)

  const sortedMedia = useMemo(
    () => [...media].sort((a, b) => a.position - b.position),
    [media],
  )

  const handleReorder = useCallback((from: number, to: number) => {
    if (!onReorder) return
    const ids = reorderMediaList(sortedMedia.map((m) => m.id), from, to)
    void onReorder(ids)
  }, [onReorder, sortedMedia])

  const thumbDrag = useThumbDragReorder(handleReorder)

  const processFiles = useCallback(async (files: File[]) => {
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      try { await onUpload(file) } catch { /* handled by caller */ }
    }
    setUploading(false)
  }, [onUpload])

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return
    void processFiles(Array.from(files))
  }, [processFiles])

  const handlePickerFile = useCallback(async (file: File) => {
    await processFiles([file])
  }, [processFiles])

  const handlePickerFiles = useCallback((files: File[]) => {
    void processFiles(files)
  }, [processFiles])

  const { openPicker, modal: pickerModal } = useImageSourcePicker({
    title: pickerTitle,
    accept: ACCEPT,
    deviceHint: MEDIA_DEVICE_HINT,
    galleryMultiSelect: true,
    onFile: handlePickerFile,
    onFiles: handlePickerFiles,
  })

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  return (
    <div className={catalogMediaCompact.root}>
      {pickerModal}
      <div className={catalogMediaCompact.row}>
        <CatalogMediaDropzone
          disabled={disabled}
          uploading={uploading}
          onDrop={handleDrop}
          onClick={() => !disabled && !uploading && openPicker()}
        />

        {sortedMedia.length > 0 && (
          <CatalogMediaLightboxHost
            items={sortedMedia.map((item) => ({
              id: item.id,
              url: item.url,
              media_type: item.media_type || 'image',
              alt_text: item.alt_text,
            }))}
            editable={!!onEditMedia}
            onSaveImage={
              onEditMedia
                ? async (index, file) => {
                    const item = sortedMedia[index]
                    if (!item) return
                    await onEditMedia(item.id, file, item.is_primary)
                  }
                : undefined
            }
          >
            {({ open }) => (
              <div className={catalogMediaCompact.thumbStrip}>
                {sortedMedia.map((item, i) => {
                  const asProductImage: ProductImage = { ...item }
                  return (
                    <CatalogMediaThumb
                      key={item.id}
                      orderNumber={i + 1}
                      draggable={!!onReorder && !disabled}
                      isDragging={thumbDrag.draggingIndex === i}
                      isDragOver={thumbDrag.dragOverIndex === i}
                      onDragHandleStart={thumbDrag.handleDragStart(i)}
                      onDragOver={thumbDrag.handleDragOver(i)}
                      onDrop={thumbDrag.handleDrop(i)}
                      onDragEnd={thumbDrag.handleDragEnd}
                      onOpen={() => open(i)}
                      topLeft={
                        <PrimaryTopLeft
                          isPrimary={item.is_primary}
                          canSetPrimary={item.media_type === 'image'}
                          onSetPrimary={() => onSetPrimary(item.id)}
                        />
                      }
                      topRight={<ThumbDeleteButton onClick={() => onDelete(item.id)} label="Delete" />}
                    >
                      <MediaPreview item={asProductImage} compact />
                      <MediaBadge type={item.media_type || 'image'} />
                    </CatalogMediaThumb>
                  )
                })}
              </div>
            )}
          </CatalogMediaLightboxHost>
        )}
      </div>
    </div>
  )
}

export interface VariantMediaItem {
  url: string
  media_type?: 'image' | 'video' | 'model3d'
  is_primary: boolean
  alt_text?: string
  position: number
}

interface VariantMediaUploadProps {
  media: VariantMediaItem[]
  onUpload: (file: File) => Promise<void>
  onDelete: (url: string) => Promise<void>
  onSetPrimary: (url: string) => Promise<void>
  onReorder?: (urls: string[]) => Promise<void>
  disabled?: boolean
  pickerTitle?: string
  layout?: 'inline' | 'stacked'
}

/** Catalog media UI for variant-level images/videos/3D (url-keyed). */
export function VariantMediaUpload({
  media,
  onUpload,
  onDelete,
  onSetPrimary,
  onReorder,
  disabled,
  pickerTitle = 'Variant media',
  layout = 'inline',
}: VariantMediaUploadProps) {
  const [uploading, setUploading] = useState(false)

  const sortedMedia = useMemo(
    () => [...media].sort((a, b) => a.position - b.position),
    [media],
  )

  const handleReorder = useCallback((from: number, to: number) => {
    if (!onReorder) return
    const urls = reorderMediaList(sortedMedia.map((m) => m.url), from, to)
    void onReorder(urls)
  }, [onReorder, sortedMedia])

  const thumbDrag = useThumbDragReorder(handleReorder)

  const processFiles = useCallback(async (files: File[]) => {
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      try { await onUpload(file) } catch { /* handled by caller */ }
    }
    setUploading(false)
  }, [onUpload])

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return
    void processFiles(Array.from(files))
  }, [processFiles])

  const handlePickerFile = useCallback(async (file: File) => {
    await processFiles([file])
  }, [processFiles])

  const handlePickerFiles = useCallback((files: File[]) => {
    void processFiles(files)
  }, [processFiles])

  const { openPicker, modal: pickerModal } = useImageSourcePicker({
    title: pickerTitle,
    accept: ACCEPT,
    deviceHint: MEDIA_DEVICE_HINT,
    galleryMultiSelect: true,
    onFile: handlePickerFile,
    onFiles: handlePickerFiles,
  })

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const stacked = layout === 'stacked'

  return (
    <div className={catalogMediaCompact.root}>
      {pickerModal}
      <div className={stacked ? catalogMediaCompact.rowStacked : catalogMediaCompact.row}>
        <CatalogMediaDropzone
          disabled={disabled}
          uploading={uploading}
          onDrop={handleDrop}
          onClick={() => !disabled && !uploading && openPicker()}
          className={stacked ? catalogMediaCompact.dropzoneStacked : undefined}
          label={stacked ? 'Add media' : undefined}
        />

        {sortedMedia.length > 0 && (
          <CatalogMediaLightboxHost
            items={sortedMedia.map((item) => ({
              id: item.url,
              url: item.url,
              media_type: item.media_type || 'image',
              alt_text: item.alt_text,
            }))}
          >
            {({ open }) => (
              <div className={stacked ? catalogMediaCompact.thumbStripStacked : catalogMediaCompact.thumbStrip}>
                {sortedMedia.map((item, i) => {
                  const asProductImage: ProductImage = {
                    id: item.url,
                    url: item.url,
                    alt_text: item.alt_text,
                    position: item.position,
                    is_primary: item.is_primary,
                    media_type: item.media_type || 'image',
                  }
                  return (
                    <CatalogMediaThumb
                      key={item.url}
                      orderNumber={i + 1}
                      size={stacked ? 'stacked' : 'default'}
                      draggable={!!onReorder && !disabled}
                      isDragging={thumbDrag.draggingIndex === i}
                      isDragOver={thumbDrag.dragOverIndex === i}
                      onDragHandleStart={thumbDrag.handleDragStart(i)}
                      onDragOver={thumbDrag.handleDragOver(i)}
                      onDrop={thumbDrag.handleDrop(i)}
                      onDragEnd={thumbDrag.handleDragEnd}
                      onOpen={() => open(i)}
                      topLeft={
                        <PrimaryTopLeft
                          isPrimary={item.is_primary}
                          canSetPrimary={(item.media_type || 'image') === 'image'}
                          onSetPrimary={() => onSetPrimary(item.url)}
                        />
                      }
                      topRight={<ThumbDeleteButton onClick={() => onDelete(item.url)} label="Delete" />}
                    >
                      <MediaPreview item={asProductImage} compact />
                      <MediaBadge type={item.media_type || 'image'} />
                    </CatalogMediaThumb>
                  )
                })}
              </div>
            )}
          </CatalogMediaLightboxHost>
        )}
      </div>
    </div>
  )
}

interface ServiceImageUploadProps {
  imageUrl: string | null
  galleryUrls: string[]
  onUploadMain: (file: File) => Promise<void>
  onUploadGallery: (file: File) => Promise<void>
  onDeleteGallery: (url: string) => Promise<void>
  disabled?: boolean
}

/** @deprecated Use ServiceMediaUpload instead */
export function ServiceImageUpload({ imageUrl, galleryUrls, onUploadMain, onUploadGallery, onDeleteGallery, disabled }: ServiceImageUploadProps) {
  const mainRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [uploadingMain, setUploadingMain] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)

  const handleMain = async (files: FileList | null) => {
    if (!files?.[0]) return
    setUploadingMain(true)
    try { await onUploadMain(files[0]) } catch { /* handled by caller */ }
    setUploadingMain(false)
    if (mainRef.current) mainRef.current.value = ''
  }

  const handleGallery = async (files: FileList | null) => {
    if (!files) return
    setUploadingGallery(true)
    for (const file of Array.from(files)) {
      try { await onUploadGallery(file) } catch { /* */ }
    }
    setUploadingGallery(false)
    if (galleryRef.current) galleryRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium mb-2">Main Image</p>
        <div className="flex items-start gap-4">
          {imageUrl ? (
            <div className="relative w-32 h-32 rounded-lg overflow-hidden border bg-gray-50 shrink-0">
              <img src={resolveUrl(imageUrl)} alt="Service" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-32 h-32 rounded-lg border-2 border-dashed flex items-center justify-center text-gray-400 shrink-0">
              <Upload className="w-6 h-6" />
            </div>
          )}
          <div>
            <Button type="button" variant="outline" size="sm" disabled={disabled || uploadingMain} onClick={() => mainRef.current?.click()}>
              {uploadingMain ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
              {imageUrl ? 'Replace' : 'Upload'}
            </Button>
            <input ref={mainRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleMain(e.target.files)} />
            <p className="text-xs text-gray-400 mt-1">Max 5 MB</p>
          </div>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Gallery</p>
          <Button type="button" variant="outline" size="sm" disabled={disabled || uploadingGallery} onClick={() => galleryRef.current?.click()}>
            {uploadingGallery ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            Add Photos
          </Button>
          <input ref={galleryRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleGallery(e.target.files)} />
        </div>
        {galleryUrls.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {galleryUrls.map((url, i) => (
              <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border bg-gray-50">
                <img src={resolveUrl(url)} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => onDeleteGallery(url)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">No gallery images yet</p>
        )}
      </div>
    </div>
  )
}

export { getMediaType, catalogMediaCompact, EDIT_MEDIA_HELPER }

interface StagedMediaUploadProps {
  files: File[]
  previews: string[]
  primaryIndex: number
  onPrimaryIndexChange: (index: number) => void
  onReorderFiles: (from: number, to: number) => void
  onAddFiles: (files: FileList | File[]) => void
  onRemoveFile: (index: number) => void
  onReplaceFile?: (index: number, file: File) => void
  pickerTitle?: string
  disabled?: boolean
  layout?: 'inline' | 'stacked'
}

/** Drop zone for media staged until product/service is saved (create flow). */
export function StagedMediaUpload({
  files,
  previews,
  primaryIndex,
  onPrimaryIndexChange,
  onReorderFiles,
  onAddFiles,
  onRemoveFile,
  onReplaceFile,
  pickerTitle = 'Media',
  disabled,
  layout = 'inline',
}: StagedMediaUploadProps) {
  const thumbDrag = useThumbDragReorder(onReorderFiles)

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList?.length) return
    onAddFiles(Array.from(fileList))
  }, [onAddFiles])

  const handlePickerFile = useCallback((file: File) => {
    onAddFiles([file])
  }, [onAddFiles])

  const handlePickerFiles = useCallback((incoming: File[]) => {
    onAddFiles(incoming)
  }, [onAddFiles])

  const { openPicker, modal: pickerModal } = useImageSourcePicker({
    title: pickerTitle,
    accept: ACCEPT,
    deviceHint: MEDIA_DEVICE_HINT,
    galleryMultiSelect: true,
    onFile: handlePickerFile,
    onFiles: handlePickerFiles,
  })

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const stacked = layout === 'stacked'

  return (
    <div className={catalogMediaCompact.root}>
      {pickerModal}
      <div className={stacked ? catalogMediaCompact.rowStacked : catalogMediaCompact.row}>
        <CatalogMediaDropzone
          disabled={disabled}
          uploading={false}
          onDrop={handleDrop}
          onClick={() => !disabled && openPicker()}
          className={stacked ? catalogMediaCompact.dropzoneStacked : undefined}
          label={stacked ? 'Add media' : undefined}
        />
        {files.length > 0 && (
          <CatalogMediaLightboxHost
            items={files.map((file, i) => ({
              id: String(i),
              url: previews[i],
              media_type: getMediaType(file),
            }))}
            editable={!!onReplaceFile}
            onSaveImage={
              onReplaceFile
                ? async (index, file) => {
                    onReplaceFile(index, file)
                  }
                : undefined
            }
          >
            {({ open }) => (
              <div className={stacked ? catalogMediaCompact.thumbStripStacked : catalogMediaCompact.thumbStrip}>
                {files.map((file, i) => {
                  const mt = getMediaType(file)
                  const isPrimary = i === primaryIndex && mt === 'image'
                  return (
                    <CatalogMediaThumb
                      key={`${file.name}-${file.size}-${i}`}
                      orderNumber={i + 1}
                      size={stacked ? 'stacked' : 'default'}
                      draggable={!disabled}
                      isDragging={thumbDrag.draggingIndex === i}
                      isDragOver={thumbDrag.dragOverIndex === i}
                      onDragHandleStart={thumbDrag.handleDragStart(i)}
                      onDragOver={thumbDrag.handleDragOver(i)}
                      onDrop={thumbDrag.handleDrop(i)}
                      onDragEnd={thumbDrag.handleDragEnd}
                      onOpen={() => open(i)}
                      topLeft={
                        <PrimaryTopLeft
                          isPrimary={isPrimary}
                          canSetPrimary={mt === 'image'}
                          onSetPrimary={() => onPrimaryIndexChange(i)}
                        />
                      }
                      topRight={<ThumbDeleteButton onClick={() => onRemoveFile(i)} />}
                    >
                      {mt === 'video' ? (
                        <video src={previews[i]} className="h-full w-full object-cover" muted />
                      ) : mt === 'model3d' ? (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-cyan-50 to-blue-50 text-cyan-600">
                          <Box className={catalogMediaCompact.model3dIcon} />
                          <span className={catalogMediaCompact.model3dLabel}>{file.name.split('.').pop()?.toUpperCase()}</span>
                        </div>
                      ) : (
                        <img src={previews[i]} alt="" className="h-full w-full object-contain object-center bg-white p-1" />
                      )}
                      {mt === 'video' && <span className="absolute right-0.5 top-0.5 flex items-center gap-0.5 rounded-full bg-primary px-0.5 py-px text-[7px] font-semibold text-white"><Film className="h-2 w-2" />Video</span>}
                      {mt === 'model3d' && <span className="absolute right-0.5 top-0.5 flex items-center gap-0.5 rounded-full bg-cyan-600 px-0.5 py-px text-[7px] font-semibold text-white"><Box className="h-2 w-2" />3D</span>}
                    </CatalogMediaThumb>
                  )
                })}
              </div>
            )}
          </CatalogMediaLightboxHost>
        )}
      </div>
    </div>
  )
}
