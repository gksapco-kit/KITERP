import { useCallback, useRef, useState } from 'react'
import { formDisplayCompact } from '@/components/common/FormSectionNav'
import { Button } from '@/components/ui/button'
import { Upload, X, Star, Loader2, Film, Box, Image as ImageIcon } from 'lucide-react'
import { ImageCropModal } from './ImageCropModal'
import { ImageSourcePicker } from './ImageSourcePicker'

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
  disabled?: boolean
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.glb,.gltf'

function MediaBadge({ type }: { type: string }) {
  if (type === 'video') return <span className="absolute top-1 right-1 bg-primary text-white text-xs px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5"><Film className="w-2.5 h-2.5" />Video</span>
  if (type === 'model3d') return <span className="absolute top-1 right-1 bg-cyan-600 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5"><Box className="w-2.5 h-2.5" />3D</span>
  return null
}

function MediaPreview({ item }: { item: ProductImage }) {
  const url = resolveUrl(item.url)
  const mt = item.media_type || 'image'

  if (mt === 'video') {
    return <video src={url} className="w-full h-full object-cover" muted loop playsInline onMouseOver={e => (e.target as HTMLVideoElement).play()} onMouseOut={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0 }} />
  }

  if (mt === 'model3d') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-cyan-50 to-blue-50 text-cyan-600">
        <Box className="w-10 h-10" />
        <span className="text-xs mt-1 font-medium">3D Model</span>
      </div>
    )
  }

  return <img src={url} alt={item.alt_text || ''} className="w-full h-full object-cover" />
}

export function ProductImageUpload({ images, onUpload, onDelete, onSetPrimary, disabled }: ProductImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [cropQueue, setCropQueue] = useState<File[]>([])
  const nonImageQueue = useRef<File[]>([])

  const processFiles = useCallback(async (files: File[]) => {
    setUploading(true)
    for (const file of files) {
      try { await onUpload(file) } catch { /* handled by caller */ }
    }
    setUploading(false)
  }, [onUpload])

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const images: File[] = []
    const others: File[] = []
    for (const f of Array.from(files)) {
      if (f.type.startsWith('image/')) images.push(f)
      else others.push(f)
    }
    nonImageQueue.current = others
    if (images.length > 0) {
      setCropQueue(images)
    } else if (others.length > 0) {
      processFiles(others)
    }
    if (inputRef.current) inputRef.current.value = ''
  }, [processFiles])

  const handleCropConfirm = useCallback(async (croppedFile: File) => {
    setCropQueue((q) => {
      const remaining = q.slice(1)
      if (remaining.length === 0) {
        processFiles([croppedFile, ...nonImageQueue.current])
        nonImageQueue.current = []
      } else {
        processFiles([croppedFile])
      }
      return remaining
    })
  }, [processFiles])

  const handleCropCancel = useCallback(() => {
    setCropQueue((q) => {
      const remaining = q.slice(1)
      if (remaining.length === 0 && nonImageQueue.current.length > 0) {
        processFiles(nonImageQueue.current)
        nonImageQueue.current = []
      }
      return remaining
    })
  }, [processFiles])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const imageItems = images.filter(i => (i.media_type || 'image') === 'image')
  const videoItems = images.filter(i => i.media_type === 'video')
  const modelItems = images.filter(i => i.media_type === 'model3d')

  return (
    <div className="space-y-2">
      {cropQueue.length > 0 && (
        <ImageCropModal
          file={cropQueue[0]}
          title={`Crop Image${cropQueue.length > 1 ? ` (${cropQueue.length} remaining)` : ''}`}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          formDisplayCompact.mediaDropzone,
          disabled ? 'cursor-not-allowed opacity-50 bg-gray-50' : '',
        )}
      >
        {uploading ? (
          <Loader2 className="mx-auto h-6 w-6 text-blue-500 animate-spin" />
        ) : (
          <Upload className="mx-auto h-6 w-6 text-gray-400" />
        )}
        <p className="mt-1 text-xs text-gray-600 sm:text-sm">
          {uploading ? 'Uploading...' : 'Click or drag files here'}
        </p>
        <div className="flex items-center justify-center gap-4 mt-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400"><ImageIcon className="w-3 h-3" />Images</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400"><Film className="w-3 h-3" />Videos</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400"><Box className="w-3 h-3" />3D Models</span>
        </div>
        <p className="text-xs text-gray-300 mt-1">Images: 5 MB &middot; Videos: 50 MB &middot; 3D (GLB/GLTF): 30 MB</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />
      </div>

      <div className="flex justify-center">
        <ImageSourcePicker
          title="Product image"
          disabled={disabled || uploading}
          uploading={uploading}
          onFile={async (file) => setCropQueue([file])}
          buttonLabel="Add image (device · gallery · URL)"
          buttonVariant="outline"
          buttonSize="sm"
          buttonClassName="text-xs"
        />
      </div>

      {/* Media grid */}
      {images.length > 0 && (
        <>
          {/* Section labels */}
          {imageItems.length > 0 && videoItems.length + modelItems.length > 0 && (
            <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" />Images ({imageItems.length})</p>
          )}
          <div className="grid grid-cols-3 gap-1.5 min-[26rem]:grid-cols-4 sm:gap-2">
            {images.map((item) => (
              <div key={item.id} className="relative group rounded-lg overflow-hidden border bg-gray-50 aspect-square">
                <MediaPreview item={item} />
                <MediaBadge type={item.media_type || 'image'} />
                {item.is_primary && (
                  <span className="absolute top-1 left-1 bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                    <Star className="w-3 h-3" />Primary
                  </span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!item.is_primary && (item.media_type || 'image') === 'image' && (
                    <Button type="button" size="sm" variant="secondary" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onSetPrimary(item.id) }}>
                      <Star className="w-3 h-3 mr-1" />Primary
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="destructive" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
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
  disabled?: boolean
}

export function ServiceMediaUpload({ media, onUpload, onDelete, onSetPrimary, disabled }: ServiceMediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [cropQueue, setCropQueue] = useState<File[]>([])
  const nonImageQueue = useRef<File[]>([])

  const processFiles = useCallback(async (files: File[]) => {
    setUploading(true)
    for (const file of files) {
      try { await onUpload(file) } catch { /* handled by caller */ }
    }
    setUploading(false)
  }, [onUpload])

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const imgs: File[] = []
    const others: File[] = []
    for (const f of Array.from(files)) {
      if (f.type.startsWith('image/')) imgs.push(f)
      else others.push(f)
    }
    nonImageQueue.current = others
    if (imgs.length > 0) {
      setCropQueue(imgs)
    } else if (others.length > 0) {
      processFiles(others)
    }
    if (inputRef.current) inputRef.current.value = ''
  }, [processFiles])

  const handleCropConfirm = useCallback(async (croppedFile: File) => {
    setCropQueue((q) => {
      const remaining = q.slice(1)
      if (remaining.length === 0) {
        processFiles([croppedFile, ...nonImageQueue.current])
        nonImageQueue.current = []
      } else {
        processFiles([croppedFile])
      }
      return remaining
    })
  }, [processFiles])

  const handleCropCancel = useCallback(() => {
    setCropQueue((q) => {
      const remaining = q.slice(1)
      if (remaining.length === 0 && nonImageQueue.current.length > 0) {
        processFiles(nonImageQueue.current)
        nonImageQueue.current = []
      }
      return remaining
    })
  }, [processFiles])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  return (
    <div className="space-y-2">
      {cropQueue.length > 0 && (
        <ImageCropModal
          file={cropQueue[0]}
          title={`Crop Image${cropQueue.length > 1 ? ` (${cropQueue.length} remaining)` : ''}`}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          formDisplayCompact.mediaDropzone,
          disabled ? 'cursor-not-allowed opacity-50 bg-gray-50' : '',
        )}
      >
        {uploading ? (
          <Loader2 className="mx-auto h-6 w-6 text-blue-500 animate-spin" />
        ) : (
          <Upload className="mx-auto h-6 w-6 text-gray-400" />
        )}
        <p className="mt-1 text-xs text-gray-600 sm:text-sm">
          {uploading ? 'Uploading...' : 'Click or drag files here'}
        </p>
        <div className="flex items-center justify-center gap-4 mt-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400"><ImageIcon className="w-3 h-3" />Images</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400"><Film className="w-3 h-3" />Videos</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400"><Box className="w-3 h-3" />3D Models</span>
        </div>
        <p className="text-xs text-gray-300 mt-1">Images: 5 MB &middot; Videos: 50 MB &middot; 3D (GLB/GLTF): 30 MB</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />
      </div>

      <div className="flex justify-center">
        <ImageSourcePicker
          title="Service image"
          disabled={disabled || uploading}
          uploading={uploading}
          onFile={async (file) => setCropQueue([file])}
          buttonLabel="Add image (device · gallery · URL)"
          buttonVariant="outline"
          buttonSize="sm"
          buttonClassName="text-xs"
        />
      </div>

      {media.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {media.map((item) => {
            const asProductImage: ProductImage = { ...item }
            return (
              <div key={item.id} className="relative group rounded-lg overflow-hidden border bg-gray-50 aspect-square">
                <MediaPreview item={asProductImage} />
                <MediaBadge type={item.media_type || 'image'} />
                {item.is_primary && (
                  <span className="absolute top-1 left-1 bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                    <Star className="w-3 h-3" />Primary
                  </span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!item.is_primary && item.media_type === 'image' && (
                    <Button type="button" size="sm" variant="secondary" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onSetPrimary(item.id) }}>
                      <Star className="w-3 h-3 mr-1" />Primary
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="destructive" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
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

export { getMediaType }
