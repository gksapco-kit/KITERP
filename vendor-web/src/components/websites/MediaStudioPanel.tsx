import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { BuilderStepSlider } from '@/components/websites/BuilderStepSlider'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  Pencil,
  PlayCircle,
  RefreshCcw,
  Save,
  Trash2,
  Upload,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { cn, mediaUrl } from '@/lib/utils'
import { ImageSourcePicker } from '@/components/common/ImageSourcePicker'
import { ImageCropModal } from '@/components/common/ImageCropModal'
import { websiteApi } from '@/api/websites'
import {
  DEFAULT_IMAGE_TRANSFORM,
  MediaImageEditToolbar,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
} from '@/components/websites/MediaImageEditToolbar'
import { useDeleteMedia, useMedia, useUpdateMedia, useUploadMedia } from '@/hooks/useWebsites'
import { nextDerivedFileName } from '@/lib/mediaFileNames'
import {
  buildImagePreviewTransform,
  hasImageEdits,
  renderEditedImageFile,
  urlToImageFile,
  type ImageEditTransform,
} from '@/lib/mediaImageEdit'
import {
  adjustmentsCssFilter,
  adjustmentsNeedServerAi,
  DEFAULT_MEDIA_ADJUSTMENTS,
  isDefaultAdjustments,
  overlayPreviewStyle,
  renderAdjustedImageFile,
  type MediaAdjustmentsState,
} from '@/lib/mediaAdjustPreview'
import type { WebsiteBlock, WebsiteMedia } from '@/types/websites'

import { askConfirm } from '@/components/common/ConfirmProvider'
/** In-flight upload row before the API returns a full `WebsiteMedia`. */
type MediaStudioRow =
  | WebsiteMedia
  | {
      id: string
      filename: string
      original_url: string
      file_type: 'image' | 'video'
      adjustments: Record<string, unknown>
      ai_tags: string[]
    }

export interface MediaStudioPanelProps {
  siteId: string
  /** When set, primary apply button references this block's label. */
  selectedBlock?: WebsiteBlock | null
  applyToImageLayer?: boolean
  onApplyUrl: (url: string) => void
  /**
   * When there is no selected block, show this instead of the generic 'Apply to Block" hint.
   */
  applyTargetDescription?: string | null
}

type MediaAdjustSliderField = 'brightness' | 'contrast' | 'saturation' | 'sharpness' | 'blur'

function MediaNavButtons({
  onPrev,
  onNext,
  disabled,
}: {
  onPrev: () => void
  onNext: () => void
  disabled: boolean
}) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-lg border border-gray-200 shadow-sm">
      <button
        type="button"
        onClick={onPrev}
        disabled={disabled}
        className="flex h-8 w-8 items-center justify-center border-r border-gray-200 bg-primary/5 text-primary transition-colors hover:bg-primary/10 disabled:opacity-35"
        title="Previous image (←)"
        aria-label="Previous image"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        className="flex h-8 w-8 items-center justify-center bg-info/5 text-info transition-colors hover:bg-info/10 disabled:opacity-35"
        title="Next image (→)"
        aria-label="Next image"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

/** Prev/next chevrons that fade in when hovering the preview image. */
function MediaPreviewHoverNav({
  onPrev,
  onNext,
  disabled,
}: {
  onPrev: () => void
  onNext: () => void
  disabled: boolean
}) {
  const btnClass = cn(
    'absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full',
    'border border-white/60 bg-black/50 text-white shadow-lg backdrop-blur-sm',
    'opacity-0 transition-all duration-200 group-hover/preview:opacity-100',
    'hover:scale-105 hover:border-white/80 hover:bg-black/65',
    'disabled:pointer-events-none disabled:opacity-0',
  )

  return (
    <>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onPrev() }}
        disabled={disabled}
        className={cn(btnClass, 'left-2.5')}
        title="Previous image (←)"
        aria-label="Previous image"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onNext() }}
        disabled={disabled}
        className={cn(btnClass, 'right-2.5')}
        title="Next image (→)"
        aria-label="Next image"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </>
  )
}

/** Wheel / trackpad pinch zoom — needs non-passive listener so preventDefault works. */
function useWheelZoom(
  containerRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  onZoomDelta: (delta: number) => void,
) {
  useEffect(() => {
    const el = containerRef.current
    if (!el || !enabled) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const sensitivity = (e.ctrlKey || e.metaKey) ? 0.006 : 0.003
      const delta = -e.deltaY * sensitivity
      if (Math.abs(delta) < 0.001) return
      onZoomDelta(delta)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [containerRef, enabled, onZoomDelta])
}

/** Stable module component — inline definitions remount on every drag tick and break range input tracking. */
function MediaAdjustSlider({
  label,
  value,
  min = 0,
  max = 200,
  step = 1,
  onValueChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onValueChange: (value: number) => void
}) {
  return (
    <div
      className="space-y-0.5"
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">{label}</label>
      </div>
      <div onPointerDown={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
        <BuilderStepSlider
          aria-label={label}
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={onValueChange}
          onInput={onValueChange}
          sliderClassName="h-1.5 touch-none"
        />
      </div>
    </div>
  )
}

/**
 * Uploads, media library, and AI image adjustments — shared by the Website Builder.
 */
export function MediaStudioPanel({
  siteId,
  selectedBlock,
  applyToImageLayer = false,
  onApplyUrl,
  applyTargetDescription,
}: MediaStudioPanelProps) {
  const { data: mediaListRaw = [], isLoading, refetch } = useMedia(siteId)
  const uploadMedia = useUploadMedia(siteId)
  const updateMedia = useUpdateMedia(siteId)
  const deleteMedia = useDeleteMedia(siteId)
  const [localMedia, setLocalMedia] = useState<MediaStudioRow[]>([])
  const mediaList: MediaStudioRow[] = localMedia.length > 0 ? localMedia : mediaListRaw

  const [selectedMedia, setSelectedMedia] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [adjustments, setAdjustments] = useState<MediaAdjustmentsState>(DEFAULT_MEDIA_ADJUSTMENTS)
  const [adjustedUrl, setAdjustedUrl] = useState<string | null>(null)
  const [isAdjusting, setIsAdjusting] = useState(false)
  const [isBaking, setIsBaking] = useState(false)

  const updateAdjustments = useCallback((
    patch: Partial<MediaAdjustmentsState> | ((prev: MediaAdjustmentsState) => MediaAdjustmentsState),
  ) => {
    setAdjustedUrl(null)
    setAdjustments(prev => (
      typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
    ))
  }, [])

  const handleSliderValueChange = useCallback((
    field: MediaAdjustSliderField,
    value: number,
  ) => {
    updateAdjustments({ [field]: value } as Partial<MediaAdjustmentsState>)
  }, [updateAdjustments])
  const [imageTransform, setImageTransform] = useState<ImageEditTransform>(DEFAULT_IMAGE_TRANSFORM)
  const [previewZoom, setPreviewZoom] = useState(1)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')
  const [showBakePreviewModal, setShowBakePreviewModal] = useState(false)
  const [bakeModalZoom, setBakeModalZoom] = useState(1)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const imagePreviewSurfaceRef = useRef<HTMLDivElement>(null)
  const bakePreviewSurfaceRef = useRef<HTMLDivElement>(null)

  const clampZoomLevel = useCallback((z: number) => (
    Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100))
  ), [])

  const handleImagePreviewWheelZoom = useCallback((delta: number) => {
    setPreviewZoom(z => clampZoomLevel(z + delta))
  }, [clampZoomLevel])

  const handleBakePreviewWheelZoom = useCallback((delta: number) => {
    setBakeModalZoom(z => clampZoomLevel(z + delta))
  }, [clampZoomLevel])

  const libraryFilenames = useMemo(
    () => mediaList.map(m => m.filename),
    [mediaList],
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mediaListRaw.length > 0) setLocalMedia(mediaListRaw)
  }, [mediaListRaw])

  const selectedMediaObj = mediaList.find(m => m.id === selectedMedia)
  const selectedMediaIndex = selectedMedia
    ? mediaList.findIndex(m => m.id === selectedMedia)
    : -1
  const resolveUrl = (url: string) => (url?.startsWith('blob:') ? url : mediaUrl(url))
  const isAdjustableImage = selectedMediaObj && selectedMediaObj.file_type !== 'video'

  useWheelZoom(
    imagePreviewSurfaceRef,
    Boolean(selectedMedia) && Boolean(selectedMediaObj) && Boolean(isAdjustableImage),
    handleImagePreviewWheelZoom,
  )
  useWheelZoom(
    bakePreviewSurfaceRef,
    showBakePreviewModal && Boolean(selectedMediaObj),
    handleBakePreviewWheelZoom,
  )

  const openMediaTools = useCallback((mediaId: string, options?: { keepBakePreview?: boolean }) => {
    if (!options?.keepBakePreview) {
      setShowBakePreviewModal(false)
      setBakeModalZoom(1)
    }
    setSelectedMedia(mediaId)
    setAdjustedUrl(null)
  }, [])

  const stepMedia = useCallback((delta: number, options?: { keepBakePreview?: boolean }) => {
    if (mediaList.length <= 1 || selectedMediaIndex < 0) return
    const next = (selectedMediaIndex + delta + mediaList.length) % mediaList.length
    openMediaTools(mediaList[next].id, options)
  }, [mediaList, selectedMediaIndex, openMediaTools])

  const updateImageTransform = useCallback((
    patch: ImageEditTransform | ((prev: ImageEditTransform) => ImageEditTransform),
  ) => {
    setAdjustedUrl(null)
    setImageTransform(prev => (typeof patch === 'function' ? patch(prev) : patch))
  }, [])

  const resetTransformView = useCallback(() => {
    setImageTransform(prev => {
      if (hasImageEdits(prev)) setAdjustedUrl(null)
      return DEFAULT_IMAGE_TRANSFORM
    })
    setPreviewZoom(1)
  }, [])

  const resetAllEdits = useCallback(() => {
    setAdjustments(DEFAULT_MEDIA_ADJUSTMENTS)
    setImageTransform(DEFAULT_IMAGE_TRANSFORM)
    setPreviewZoom(1)
    setAdjustedUrl(null)
  }, [])

  useEffect(() => {
    if (!selectedMedia) return
    setAdjustments(DEFAULT_MEDIA_ADJUSTMENTS)
    setAdjustedUrl(null)
    setImageTransform(DEFAULT_IMAGE_TRANSFORM)
    setPreviewZoom(1)
    setCropFile(null)
    setIsRenaming(false)
    setRenameDraft('')
    setBakeModalZoom(1)
  }, [selectedMedia])

  const doUpload = async (file: File) => {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast.error('Only images and videos are allowed')
      return
    }
    const localPreviewUrl = URL.createObjectURL(file)
    const tempItem = {
      id: `temp-${Date.now()}`,
      filename: file.name,
      original_url: localPreviewUrl,
      file_type: file.type.startsWith('image/') ? ('image' as const) : ('video' as const),
      adjustments: {},
      ai_tags: [] as string[],
    }
    setLocalMedia(prev => [tempItem, ...prev])
    try {
      const saved = await uploadMedia.mutateAsync(file)
      setLocalMedia(prev => prev.map(m => (m.id === tempItem.id ? saved : m)))
      setSelectedMedia(saved.id)
      toast.success(`"${file.name}" uploaded!`)
      refetch()
    } catch {
      setLocalMedia(prev => prev.filter(m => m.id !== tempItem.id))
      toast.error('Upload failed — check file size and format')
    }
  }

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    for (const f of files) await doUpload(f)
    e.target.value = ''
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    for (const f of files) await doUpload(f)
  }

  const handleServerAdjust = useCallback(async (): Promise<string | null> => {
    if (!selectedMediaObj || selectedMediaObj.file_type === 'video') return null
    setIsAdjusting(true)
    try {
      const r = await websiteApi.aiMediaAdjust(siteId, selectedMediaObj.original_url, adjustments as any)
      if (r.adjusted_url && r.adjusted_url !== selectedMediaObj.original_url) {
        setAdjustedUrl(r.adjusted_url)
        toast.success('AI adjustments applied')
        return r.adjusted_url
      }
      toast.info('Server AI is unavailable — baking adjustments locally instead')
      return null
    } catch {
      toast.error('Server adjustment failed — baking locally instead')
      return null
    } finally {
      setIsAdjusting(false)
    }
  }, [selectedMediaObj, adjustments, siteId])

  const previewFilter = useMemo(() => adjustmentsCssFilter(adjustments), [adjustments])
  const previewOverlayStyle = useMemo(
    () => overlayPreviewStyle(adjustments.overlay),
    [adjustments.overlay],
  )
  const hasVisualAdjustments = !isDefaultAdjustments(adjustments)
  const hasTransformEdits = hasImageEdits(imageTransform)
  const hasPendingEdits = hasVisualAdjustments || hasTransformEdits

  /** Bake current controls into a library file, then return its URL. */
  const bakeAdjustmentsToUrl = useCallback(async (): Promise<string> => {
    if (!selectedMediaObj || selectedMediaObj.file_type === 'video') {
      return selectedMediaObj?.original_url || ''
    }

    const adjustmentsDirty = !isDefaultAdjustments(adjustments)
    const transformDirty = hasImageEdits(imageTransform)

    if (!adjustmentsDirty && !transformDirty) {
      return adjustedUrl || selectedMediaObj.original_url
    }

    if (adjustmentsDirty && !transformDirty && adjustmentsNeedServerAi(adjustments)) {
      const serverUrl = await handleServerAdjust()
      if (serverUrl) return serverUrl
    }

    setIsBaking(true)
    let tempBlobUrl: string | null = null
    try {
      let sourceUrl = resolveUrl(selectedMediaObj.original_url)

      if (transformDirty) {
        const transformName = nextDerivedFileName(selectedMediaObj.filename, libraryFilenames, 'edited')
        const transformFile = await renderEditedImageFile(sourceUrl, imageTransform, transformName)
        if (!adjustmentsDirty) {
          const saved = await uploadMedia.mutateAsync(transformFile)
          setLocalMedia(prev => [saved, ...prev.filter(m => m.id !== saved.id)])
          refetch()
          setAdjustedUrl(saved.original_url)
          setImageTransform(DEFAULT_IMAGE_TRANSFORM)
          setPreviewZoom(1)
          return saved.original_url
        }
        tempBlobUrl = URL.createObjectURL(transformFile)
        sourceUrl = tempBlobUrl
      }

      const derivedName = nextDerivedFileName(selectedMediaObj.filename, libraryFilenames, 'edited')
      const file = await renderAdjustedImageFile(sourceUrl, adjustments, derivedName)
      const saved = await uploadMedia.mutateAsync(file)
      setLocalMedia(prev => [saved, ...prev.filter(m => m.id !== saved.id)])
      refetch()
      setAdjustedUrl(saved.original_url)
      setImageTransform(DEFAULT_IMAGE_TRANSFORM)
      setPreviewZoom(1)
      return saved.original_url
    } catch {
      toast.error('Could not bake image — it may block cross-origin export')
      return adjustedUrl || selectedMediaObj.original_url
    } finally {
      if (tempBlobUrl) URL.revokeObjectURL(tempBlobUrl)
      setIsBaking(false)
    }
  }, [
    selectedMediaObj,
    adjustedUrl,
    adjustments,
    imageTransform,
    libraryFilenames,
    uploadMedia,
    refetch,
    handleServerAdjust,
  ])

  const openCropTool = useCallback(async () => {
    if (!selectedMediaObj || selectedMediaObj.file_type === 'video') return
    try {
      const baseUrl = adjustedUrl
        ? resolveUrl(adjustedUrl)
        : resolveUrl(selectedMediaObj.original_url)
      let file = await urlToImageFile(baseUrl, selectedMediaObj.filename)
      if (hasImageEdits(imageTransform)) {
        file = await renderEditedImageFile(
          resolveUrl(selectedMediaObj.original_url),
          imageTransform,
          file.name,
        )
      }
      setCropFile(file)
    } catch {
      toast.error('Could not open crop tool')
    }
  }, [selectedMediaObj, adjustedUrl, imageTransform])

  const handleCropConfirm = useCallback(async (cropped: File) => {
    if (!selectedMediaObj) return
    setCropFile(null)
    setImageTransform(DEFAULT_IMAGE_TRANSFORM)
    setPreviewZoom(1)
    setAdjustedUrl(null)
    try {
      const derivedName = nextDerivedFileName(selectedMediaObj.filename, libraryFilenames, 'cropped')
      const renamed = new File([cropped], derivedName, { type: cropped.type })
      const saved = await uploadMedia.mutateAsync(renamed)
      setLocalMedia(prev => [saved, ...prev.filter(m => m.id !== saved.id)])
      openMediaTools(saved.id)
      refetch()
      toast.success('Cropped image saved')
    } catch {
      toast.error('Could not save cropped image')
    }
  }, [selectedMediaObj, libraryFilenames, uploadMedia, openMediaTools, refetch])

  const closeBakePreviewModal = useCallback(() => {
    setShowBakePreviewModal(false)
    setBakeModalZoom(1)
  }, [])

  const closeToolsModal = useCallback(() => {
    setShowBakePreviewModal(false)
    setBakeModalZoom(1)
    setSelectedMedia(null)
  }, [])

  // Register above the builder canvas handler so Esc closes this modal first.
  useEscapeToClose(closeBakePreviewModal, showBakePreviewModal)
  useEscapeToClose(closeToolsModal, Boolean(selectedMedia) && !cropFile && !showBakePreviewModal)

  useEffect(() => {
    if (!selectedMedia) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return
      const keepBakePreview = showBakePreviewModal
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        stepMedia(-1, { keepBakePreview })
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        stepMedia(1, { keepBakePreview })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedMedia, showBakePreviewModal, stepMedia])

  const canApplyToSelection = Boolean(selectedBlock || applyTargetDescription || applyToImageLayer)

  const applyUrlToSelection = useCallback((url: string) => {
    if (!canApplyToSelection) {
      toast.error('Select a section on the canvas first')
      return
    }
    onApplyUrl(url)
    closeToolsModal()
  }, [canApplyToSelection, onApplyUrl, closeToolsModal])

  const applyCurrentToSelection = useCallback(async () => {
    if (!selectedMediaObj) return
    try {
      const url = await bakeAdjustmentsToUrl()
      applyUrlToSelection(url)
    } catch {
      toast.error('Could not apply image')
    }
  }, [selectedMediaObj, bakeAdjustmentsToUrl, applyUrlToSelection])

  const saveAdjustmentsOnly = useCallback(async () => {
    try {
      await bakeAdjustmentsToUrl()
      toast.success('Adjustments saved to library')
    } catch {
      toast.error('Could not save adjustments')
    }
  }, [bakeAdjustmentsToUrl])

  const openBakePreviewModal = useCallback(() => {
    setBakeModalZoom(1)
    setShowBakePreviewModal(true)
  }, [])

  const saveFromBakePreviewModal = useCallback(async () => {
    try {
      if (hasPendingEdits) {
        await bakeAdjustmentsToUrl()
        toast.success('Adjustments saved to library')
      } else {
        toast.success('Preview is up to date')
      }
      closeBakePreviewModal()
    } catch {
      toast.error('Could not save adjustments')
    }
  }, [hasPendingEdits, bakeAdjustmentsToUrl, closeBakePreviewModal])

  const downloadMediaFile = useCallback(async (url: string, filename: string) => {
    try {
      const resolved = resolveUrl(url)
      const res = await fetch(resolved)
      if (!res.ok) throw new Error('fetch failed')
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = filename.includes('.') ? filename : `${filename}.jpg`
      anchor.click()
      URL.revokeObjectURL(objectUrl)
      toast.success('Download started')
    } catch {
      toast.error('Could not download file')
    }
  }, [])

  const commitRename = useCallback(async () => {
    if (!selectedMediaObj) return
    const nextName = renameDraft.trim()
    setIsRenaming(false)
    if (!nextName || nextName === selectedMediaObj.filename) return

    if (selectedMediaObj.id.startsWith('temp-')) {
      setLocalMedia(prev => prev.map(m => (
        m.id === selectedMediaObj.id ? { ...m, filename: nextName } : m
      )))
      toast.success('Renamed')
      return
    }

    try {
      const saved = await updateMedia.mutateAsync({ mediaId: selectedMediaObj.id, filename: nextName })
      setLocalMedia(prev => prev.map(m => (m.id === saved.id ? saved : m)))
      refetch()
      toast.success('Renamed')
    } catch {
      toast.error('Could not rename file')
    }
  }, [selectedMediaObj, renameDraft, updateMedia, refetch])

  const startRename = useCallback(() => {
    if (!selectedMediaObj) return
    setRenameDraft(selectedMediaObj.filename)
    setIsRenaming(true)
    requestAnimationFrame(() => renameInputRef.current?.select())
  }, [selectedMediaObj])

  const handleDeleteSelectedMedia = useCallback (async () => {
    if (!selectedMediaObj) return
    const label = selectedMediaObj.filename || 'this file'
    if (!await askConfirm(`Delete "${label}" from your media library? This cannot be undone.`)) return

    const deletedId = selectedMediaObj.id
    const currentIndex = selectedMediaIndex
    const keepBakePreview = showBakePreviewModal

    const advanceAfterDelete = (remaining: MediaStudioRow[]) => {
      if (remaining.length === 0) {
        setLocalMedia(remaining)
        setSelectedMedia(null)
        setShowBakePreviewModal(false)
        setBakeModalZoom(1)
        return
      }
      const nextIndex = currentIndex >= remaining.length ? remaining.length - 1 : currentIndex
      setLocalMedia(remaining)
      openMediaTools(remaining[nextIndex].id, { keepBakePreview })
    }

    if (deletedId.startsWith('temp-')) {
      advanceAfterDelete(mediaList.filter(m => m.id !== deletedId))
      toast.success('Removed unsaved upload')
      return
    }

    try {
      await deleteMedia.mutateAsync(deletedId)
      advanceAfterDelete(mediaList.filter(m => m.id !== deletedId))
      refetch()
      toast.success('Image deleted')
    } catch {
      toast.error('Could not delete image')
    }
  }, [
    selectedMediaObj,
    selectedMediaIndex,
    showBakePreviewModal,
    mediaList,
    openMediaTools,
    deleteMedia,
    refetch,
  ])

  const applyPrimaryLabel = applyToImageLayer
    ? 'Apply to Image Layer'
    : selectedBlock
      ? `Apply to "${selectedBlock.label || selectedBlock.block_type}"`
      : applyTargetDescription
        ? `Apply to ${applyTargetDescription}`
        : 'Apply to business front'

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="p-3 border-b border-gray-100 shrink-0">
        {applyToImageLayer && (
          <div className="mb-2 px-2 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs text-emerald-800">
            Selected: image layer — uploads and library items apply to that layer.
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileInput} />
        <div
          ref={dropZoneRef}
          onDragOver={e => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'w-full py-5 border-2 border-dashed rounded-xl text-xs cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5',
            isDragging
              ? 'border-primary bg-accent text-primary'
              : 'border-primary/30 text-primary hover:bg-accent hover:border-primary/60',
          )}
        >
          {uploadMedia.isPending ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Uploading…</span>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6" />
              <span className="font-semibold">{isDragging ? 'Drop files here' : 'Click or drag & drop to upload'}</span>
              <span className="text-xs text-gray-400">JPG, PNG, WebP, GIF, MP4 • Multiple files ok</span>
            </>
          )}
        </div>
        <div className="mt-2">
          <ImageSourcePicker
            title="Image"
            disabled={uploadMedia.isPending}
            uploading={uploadMedia.isPending}
            galleryMultiSelect
            onFile={doUpload}
            onFiles={async (files) => {
              for (const f of files) await doUpload(f)
            }}
            buttonLabel="Add image (device · gallery · URL)"
            buttonVariant="outline"
            buttonSize="sm"
            buttonClassName="w-full text-xs"
          />
        </div>
      </div>

      <div className="p-3 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Media Library ({mediaList.length})</span>
          <button type="button" onClick={() => refetch()} className="text-xs text-primary/80 hover:text-primary flex items-center gap-0.5">
            <RefreshCcw className="w-3 h-3" /> Refresh
          </button>
        </div>
        {isLoading && mediaList.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary/70" />
          </div>
        ) : mediaList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400 gap-2">
            <ImageIcon className="w-10 h-10 opacity-20" />
            <p className="text-xs font-medium">No media yet</p>
            <p className="text-xs">Upload images or generate with AI</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 max-h-64 overflow-y-auto">
            {mediaList.map(m => {
              const src = resolveUrl(m.original_url)
              const isSelected = selectedMedia === m.id
              return (
                <div
                  key={m.id}
                  onClick={() => applyUrlToSelection(m.original_url)}
                  className={cn(
                    'group relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all',
                    isSelected ? 'border-primary ring-2 ring-primary/25' : 'border-transparent hover:border-primary/40',
                  )}
                  title="Click to apply to your section"
                >
                  {m.file_type === 'video' ? (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <PlayCircle className="w-6 h-6 text-white opacity-80" />
                    </div>
                  ) : (
                    <img
                      src={src}
                      alt={m.filename}
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
                    />
                  )}
                  {m.ai_tags?.includes('ai-generated') && (
                    <div className="absolute top-1 left-1 bg-primary text-white text-[8px] font-bold px-1 py-0.5 rounded">AI</div>
                  )}
                  <div className="pointer-events-none absolute bottom-1.5 right-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      title="Edit image"
                      onClick={ev => { ev.stopPropagation(); openMediaTools(m.id) }}
                      className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-white/80 bg-white/90 text-primary shadow-md backdrop-blur-sm transition-transform hover:scale-105 hover:bg-white"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Copy URL"
                      onClick={ev => {
                        ev.stopPropagation()
                        void navigator.clipboard.writeText(src)
                        toast.success('URL copied!')
                      }}
                      className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-white/80 bg-white/90 text-gray-700 shadow-md backdrop-blur-sm transition-transform hover:scale-105 hover:bg-white"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {isSelected && (
                    <div className="pointer-events-none absolute left-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary shadow-sm">
                      <Check className="h-2 w-2 text-white" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {cropFile && createPortal(
        <div
          className="fixed inset-0 z-[100030]"
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        >
          <ImageCropModal
            file={cropFile}
            title="Crop image"
            onConfirm={cropped => { void handleCropConfirm(cropped) }}
            onCancel={() => setCropFile(null)}
          />
        </div>,
        document.body,
      )}

      {selectedMediaObj && createPortal(
        <div
          data-kiterp-modal
          className="fixed inset-0 z-[100020] flex items-center justify-center bg-black/40 p-4 sm:p-6 animate-in fade-in duration-150"
          onClick={closeToolsModal}
        >
          <div
            className="flex w-full max-w-5xl max-h-[min(90vh,860px)] flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-4 py-3">
              <Wand2 className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-bold text-gray-800">Image tools</span>

              <div className="ml-auto flex min-w-0 items-center gap-2.5">
                <div className="group/name flex min-w-0 max-w-[min(260px,42vw)] items-center rounded-lg border border-gray-200 bg-gray-50/80 px-2.5 py-1.5">
                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renameDraft}
                      onChange={e => setRenameDraft(e.target.value)}
                      onBlur={() => { void commitRename() }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void commitRename()
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setIsRenaming(false)
                          setRenameDraft(selectedMediaObj.filename)
                        }
                      }}
                      className="w-full bg-transparent text-xs text-gray-800 outline-none"
                      aria-label="Rename file"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={startRename}
                      disabled={updateMedia.isPending}
                      className="flex min-w-0 flex-1 items-center gap-1 text-xs text-gray-600 transition-colors hover:text-gray-900 disabled:opacity-50"
                      title="Click to rename"
                    >
                      <span className="truncate">{selectedMediaObj.filename}</span>
                      <Pencil className="h-3 w-3 shrink-0 text-primary/70 opacity-0 transition-opacity group-hover/name:opacity-100" />
                    </button>
                  )}
                </div>

                <span className="min-w-[2.75rem] shrink-0 text-center text-[11px] font-medium tabular-nums text-gray-400">
                  {selectedMediaIndex + 1}/{mediaList.length}
                </span>

                <MediaNavButtons
                  onPrev={() => stepMedia(-1)}
                  onNext={() => stepMedia(1)}
                  disabled={mediaList.length <= 1}
                />
              </div>

              <button
                type="button"
                onClick={closeToolsModal}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition-colors hover:border-red-300 hover:bg-red-100"
                title="Close"
                aria-label="Close"
                data-escape-close
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              {/* Preview + primary actions — fixed, does not scroll */}
              <div className="flex w-full shrink-0 flex-col gap-3 border-b border-gray-100 p-4 md:w-[min(420px,44%)] md:border-b-0 md:border-r">
                {selectedMediaObj.file_type === 'video' ? (
                  <p className="text-xs text-gray-500 rounded-lg border border-gray-100 bg-gray-50 px-2 py-2">
                    Video is ready to insert; adjustments apply to images only.
                  </p>
                ) : null}

                <div
                  ref={imagePreviewSurfaceRef}
                  className="group/preview relative aspect-[4/3] w-full touch-none overflow-hidden rounded-xl border border-gray-200 bg-gray-900 shadow-sm"
                  title="Scroll or pinch to zoom"
                >
                  <button
                    type="button"
                    disabled={!canApplyToSelection || isBaking || isAdjusting}
                    onClick={() => { void applyCurrentToSelection() }}
                    title={canApplyToSelection ? 'Click to apply to your section' : 'Select a section on the canvas first'}
                    className="absolute inset-0 w-full text-left disabled:cursor-not-allowed"
                  >
                    <img
                      src={adjustedUrl ? resolveUrl(adjustedUrl) : resolveUrl(selectedMediaObj.original_url)}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover/preview:scale-[1.02]"
                      alt=""
                      style={
                        adjustedUrl
                          ? undefined
                          : {
                              filter: previewFilter,
                              transform: buildImagePreviewTransform(
                                imageTransform,
                                { x: 0, y: 0 },
                                previewZoom,
                              ),
                            }
                      }
                      onError={e => {
                        ;(e.target as HTMLImageElement).style.opacity = '0.3'
                      }}
                    />
                    {!adjustedUrl && previewOverlayStyle ? (
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={previewOverlayStyle}
                        aria-hidden
                      />
                    ) : null}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/preview:bg-black/25 disabled:bg-transparent">
                      <span className="rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover/preview:opacity-100">
                        Click to apply
                      </span>
                    </div>
                    {(adjustedUrl || hasPendingEdits) && (
                      <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
                        {adjustedUrl ? '✓ Baked' : 'Preview'}
                      </div>
                    )}
                  </button>

                  <MediaPreviewHoverNav
                    onPrev={() => stepMedia(-1)}
                    onNext={() => stepMedia(1)}
                    disabled={mediaList.length <= 1}
                  />
                </div>

                {isAdjustableImage && (
                  <MediaImageEditToolbar
                    zoom={previewZoom}
                    onZoomChange={setPreviewZoom}
                    transform={imageTransform}
                    onTransformChange={updateImageTransform}
                    onCrop={() => { void openCropTool() }}
                    onReset={resetTransformView}
                  />
                )}

                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={resetAllEdits}
                    disabled={!hasPendingEdits}
                    className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-600 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 active:scale-[0.98] disabled:opacity-50"
                  >
                    <RefreshCcw className="h-4 w-4 shrink-0 text-gray-500" />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => { void saveAdjustmentsOnly() }}
                    disabled={isAdjusting || isBaking || !hasPendingEdits}
                    className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm font-semibold text-primary shadow-sm transition-all hover:border-primary/40 hover:bg-primary/10 active:scale-[0.98] disabled:opacity-50"
                  >
                    {(isAdjusting || isBaking) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 shrink-0" />}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={openBakePreviewModal}
                    disabled={isAdjusting || isBaking}
                    className="flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-primary via-primary to-info px-3 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
                  >
                    <Wand2 className="h-4 w-4 shrink-0" />
                    Bake Preview
                  </button>
                </div>

              </div>

              {/* Adjustment controls — scroll independently */}
              {isAdjustableImage ? (
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <MediaAdjustSlider
                      label="Brightness"
                      value={adjustments.brightness}
                      min={0}
                      max={200}
                      onValueChange={v => handleSliderValueChange('brightness', v)}
                    />
                    <MediaAdjustSlider
                      label="Contrast"
                      value={adjustments.contrast}
                      min={0}
                      max={200}
                      onValueChange={v => handleSliderValueChange('contrast', v)}
                    />
                    <MediaAdjustSlider
                      label="Saturation"
                      value={adjustments.saturation}
                      min={0}
                      max={200}
                      onValueChange={v => handleSliderValueChange('saturation', v)}
                    />
                    <MediaAdjustSlider
                      label="Sharpness"
                      value={adjustments.sharpness}
                      min={0}
                      max={100}
                      onValueChange={v => handleSliderValueChange('sharpness', v)}
                    />
                    <MediaAdjustSlider
                      label="Blur"
                      value={adjustments.blur}
                      min={0}
                      max={20}
                      onValueChange={v => handleSliderValueChange('blur', v)}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'remove_background', label: 'Remove BG' },
                      { key: 'ai_enhance', label: 'AI Enhance' },
                      { key: 'grayscale', label: 'Grayscale' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-2">
                        <input
                          type="checkbox"
                          checked={(adjustments as any)[key]}
                          onChange={e => updateAdjustments({ [key]: e.target.checked } as Partial<MediaAdjustmentsState>)}
                          className="rounded accent-primary"
                        />
                        <span className="text-xs font-medium text-gray-600">{label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-600">Color Grade</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[null, 'cinematic', 'vivid', 'matte', 'vintage', 'cool', 'warm', 'faded'].map(grade => (
                        <button
                          type="button"
                          key={grade || 'none'}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={() => updateAdjustments({ color_grade: grade })}
                          className={cn(
                            'rounded-lg border py-2 text-xs font-bold transition-colors',
                            adjustments.color_grade === grade
                              ? 'border-primary bg-primary text-white'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-primary/40',
                          )}
                        >
                          {grade ? grade.charAt(0).toUpperCase() + grade.slice(1) : 'None'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-600">Overlay</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[null, 'dark', 'light', 'gradient_down', 'gradient_up', 'vignette'].map(ov => (
                        <button
                          type="button"
                          key={ov || 'none'}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={() => updateAdjustments({ overlay: ov })}
                          className={cn(
                            'rounded-lg border py-2 text-xs font-bold transition-colors',
                            adjustments.overlay === ov
                              ? 'border-primary bg-primary text-white'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-primary/40',
                          )}
                        >
                          {ov ? ov.replace('_', ' ').charAt(0).toUpperCase() + ov.replace('_', ' ').slice(1) : 'None'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-[11px] leading-snug text-gray-400">
                    Crop, rotate, and sliders update the preview instantly. Use <span className="font-semibold">Save</span> or <span className="font-semibold">Bake Preview</span> to review and save a copy, then click the image or <span className="font-semibold">Apply</span> to your section.
                  </p>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center p-6 text-sm text-gray-500">
                  Adjustments are available for images only.
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-gray-200 bg-gradient-to-b from-white to-gray-50/90 px-4 py-3">
              {!canApplyToSelection ? (
                <p className="mb-2.5 text-center text-xs text-amber-600">
                  Select a section on the canvas to apply this image
                </p>
              ) : applyTargetDescription && !selectedBlock ? (
                <p className="mb-2.5 text-center text-xs text-emerald-700">
                  Applies to: {applyTargetDescription}
                </p>
              ) : adjustedUrl ? (
                <p className="mb-2.5 text-center text-xs text-emerald-700">
                  Baked version ready — Apply sends the edited image to your section
                </p>
              ) : null}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!canApplyToSelection || isBaking || isAdjusting}
                  onClick={() => { void applyCurrentToSelection() }}
                  className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Check className="h-4 w-4 shrink-0" />
                  <span className="truncate">{applyPrimaryLabel}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(adjustedUrl || resolveUrl(selectedMediaObj.original_url))
                    toast.success('URL copied!')
                  }}
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-gray-600 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50"
                  title="Copy image URL"
                  aria-label="Copy image URL"
                >
                  <Copy className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-xs font-semibold">Copy URL</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void downloadMediaFile(
                      adjustedUrl || selectedMediaObj.original_url,
                      selectedMediaObj.filename,
                    )
                  }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50"
                  title="Download image"
                  aria-label="Download image"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={deleteMedia.isPending}
                  onClick={() => { void handleDeleteSelectedMedia() }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 shadow-sm transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                  title="Delete from library"
                  aria-label="Delete from library"
                >
                  {deleteMedia.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {selectedMediaObj && showBakePreviewModal && isAdjustableImage && createPortal(
        <div
          data-kiterp-modal
          className="fixed inset-0 z-[100025] flex items-center justify-center bg-black/55 p-4 sm:p-6 animate-in fade-in duration-150"
          onClick={closeBakePreviewModal}
        >
          <div
            className="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-5 py-3.5">
              <Wand2 className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-bold text-gray-800">Bake Preview</span>

              <div className="ml-auto flex min-w-0 items-center gap-2.5">
                <span className="max-w-[min(260px,42vw)] truncate text-xs text-gray-500">
                  {selectedMediaObj.filename}
                </span>

                <span className="min-w-[2.75rem] shrink-0 text-center text-[11px] font-medium tabular-nums text-gray-400">
                  {selectedMediaIndex + 1}/{mediaList.length}
                </span>

                <MediaNavButtons
                  onPrev={() => stepMedia(-1, { keepBakePreview: true })}
                  onNext={() => stepMedia(1, { keepBakePreview: true })}
                  disabled={mediaList.length <= 1}
                />
              </div>

              <button
                type="button"
                onClick={closeBakePreviewModal}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition-colors hover:border-red-300 hover:bg-red-100"
                title="Close"
                aria-label="Close"
                data-escape-close
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              ref={bakePreviewSurfaceRef}
              className="group/preview relative flex min-h-[min(62vh,560px)] touch-none items-center justify-center overflow-hidden bg-gray-900 p-6"
              title="Scroll or pinch to zoom"
            >
              <img
                src={adjustedUrl ? resolveUrl(adjustedUrl) : resolveUrl(selectedMediaObj.original_url)}
                alt=""
                className="max-h-[min(62vh,560px)] max-w-full object-contain transition-transform duration-200"
                style={
                  adjustedUrl
                    ? { transform: `scale(${bakeModalZoom})` }
                    : {
                        filter: previewFilter,
                        transform: buildImagePreviewTransform(
                          imageTransform,
                          { x: 0, y: 0 },
                          bakeModalZoom,
                        ),
                      }
                }
                onError={e => {
                  ;(e.target as HTMLImageElement).style.opacity = '0.3'
                }}
              />
              {!adjustedUrl && previewOverlayStyle ? (
                <div
                  className="pointer-events-none absolute inset-4"
                  style={previewOverlayStyle}
                  aria-hidden
                />
              ) : null}
              {(adjustedUrl || hasPendingEdits) && (
                <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
                  {adjustedUrl ? '✓ Saved' : 'Preview'}
                </div>
              )}

              <MediaPreviewHoverNav
                onPrev={() => stepMedia(-1, { keepBakePreview: true })}
                onNext={() => stepMedia(1, { keepBakePreview: true })}
                disabled={mediaList.length <= 1}
              />
            </div>

            <div className="flex shrink-0 items-center justify-between gap-4 border-t border-gray-100 bg-gray-50/50 px-5 py-4">
              <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2 py-1.5 shadow-sm">
                <button
                  type="button"
                  title="Zoom out"
                  aria-label="Zoom out"
                  disabled={bakeModalZoom <= ZOOM_MIN}
                  onClick={() => setBakeModalZoom(z => clampZoomLevel(z - ZOOM_STEP))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:opacity-35"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="min-w-[3.25rem] select-none text-center text-xs font-semibold tabular-nums text-gray-600">
                  {Math.round(bakeModalZoom * 100)}%
                </span>
                <button
                  type="button"
                  title="Zoom in"
                  aria-label="Zoom in"
                  disabled={bakeModalZoom >= ZOOM_MAX}
                  onClick={() => setBakeModalZoom(z => clampZoomLevel(z + ZOOM_STEP))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:opacity-35"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => { void saveFromBakePreviewModal() }}
                disabled={isAdjusting || isBaking}
                className="flex min-h-11 min-w-[7.5rem] items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {(isAdjusting || isBaking) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
