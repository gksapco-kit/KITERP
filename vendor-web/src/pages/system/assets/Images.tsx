import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { cn, isLikelyImageFile, mediaUrl } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  BUSINESS_IMAGE_CATEGORIES,
  BUSINESS_IMAGES,
  IMAGE_CATEGORY_GROUPS,
  categoriesInGroup,
  categoryById,
  imagesForCategory,
  totalImageCount,
  type BusinessImage,
  type BusinessImageCategory,
} from '@/data/businessImagePack'
import { BusinessGalleryThumb } from '@/components/common/BusinessGalleryThumb'
import { useImageSourcePicker } from '@/components/common/ImageSourcePicker'
import { useVendorUploadedImages } from '@/hooks/useVendorUploadedImages'
import {
  galleryTrashEntries,
  type GalleryTrashItem,
  type StoredGalleryImage,
} from '@/lib/galleryPickerImages'
import { vendorApi } from '@/api/vendor'
import { useVendorStore } from '@/stores/vendorStore'
import { isAxiosError } from 'axios'

import { askConfirm } from '@/components/common/ConfirmProvider'
function imageMatchesQuery(img: BusinessImage, q: string): boolean {
  const cat = categoryById(img.categoryId)
  return (
    img.filename.toLowerCase().includes(q) ||
    img.label.toLowerCase().includes(q) ||
    img.categoryId.toLowerCase().includes(q) ||
    (cat?.label.toLowerCase().includes(q) ?? false) ||
    (cat?.group.toLowerCase().includes(q) ?? false)
  )
}

function absoluteImageUrl(path: string): string {
  if (path.startsWith('http')) return path
  return `${window.location.origin}${path}`
}

async function downloadImageFile(path: string, filename: string, options?: { silent?: boolean }) {
  const href = mediaUrl(path)
  try {
    const res = await fetch(href)
    if (!res.ok) throw new Error('fetch failed')
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename || 'image'
    a.rel = 'noopener'
    a.click()
    URL.revokeObjectURL(objectUrl)
    if (!options?.silent) toast.success('Download started')
  } catch {
    const a = document.createElement('a')
    a.href = absoluteImageUrl(path)
    a.download = filename || 'image'
    a.target = '_blank'
    a.rel = 'noopener'
    a.click()
  }
}

const SIDEBAR_SECTION_BTN = cn(
  'mb-1 flex w-full min-w-[9rem] shrink-0 items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition-colors lg:min-w-0 lg:shrink',
  'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
)

function SidebarSectionHeader({
  label,
  count,
  active = false,
  expandable = false,
  expanded = false,
  onClick,
}: {
  label: string
  count: number
  active?: boolean
  expandable?: boolean
  expanded?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expandable ? expanded : undefined}
      className={cn(SIDEBAR_SECTION_BTN, active && 'text-primary')}
    >
      <span
        className={cn(
          'text-[0.625rem] font-semibold uppercase tracking-wide',
          active ? 'text-primary' : 'text-muted-foreground/80',
        )}
      >
        {label}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <span
          className={cn(
            'text-[0.625rem] tabular-nums',
            active ? 'text-primary/70' : 'text-muted-foreground/70',
          )}
        >
          {count}
        </span>
        {expandable ? (
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
              expanded && 'rotate-180',
              active && 'text-primary/70',
            )}
          />
        ) : (
          <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
      </span>
    </button>
  )
}

function filenameFromUrl(url: string): string {
  try {
    const path = url.startsWith('http') ? new URL(url).pathname : url
    const name = path.split('/').filter(Boolean).pop()
    return name || 'upload'
  } catch {
    return url.split('/').filter(Boolean).pop() || 'upload'
  }
}

function storedImageMatchesQuery(img: StoredGalleryImage, q: string): boolean {
  return (
    img.label.toLowerCase().includes(q) ||
    img.url.toLowerCase().includes(q) ||
    filenameFromUrl(img.url).toLowerCase().includes(q)
  )
}

function UploadedImageCard({
  image,
  onPreview,
  selecting = false,
  selected = false,
  onToggleSelect,
}: {
  image: StoredGalleryImage
  onPreview: (image: StoredGalleryImage) => void
  selecting?: boolean
  selected?: boolean
  onToggleSelect?: (image: StoredGalleryImage) => void
}) {
  const [copied, setCopied] = useState(false)
  const [visible, setVisible] = useState(true)
  const filename = filenameFromUrl(image.url)

  if (!visible) return null

  const copyUrl = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const url = absoluteImageUrl(image.url)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Image URL copied')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy URL')
    }
  }

  const download = (e: React.MouseEvent) => {
    e.stopPropagation()
    void downloadImageFile(image.url, filename)
  }

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg border bg-card text-left shadow-sm transition hover:border-primary/40 hover:shadow-md',
        selected && 'border-primary ring-2 ring-primary/30',
      )}
    >
      <button
        type="button"
        onClick={() => {
          if (selecting) onToggleSelect?.(image)
          else onPreview(image)
        }}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <div className="aspect-[16/10] overflow-hidden bg-muted">
          <img
            src={mediaUrl(image.url)}
            alt={image.label}
            loading="lazy"
            onError={() => setVisible(false)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        </div>
        <div className="flex items-center justify-between gap-2 px-2.5 py-2">
          <div className="min-w-0">
            <span className="block truncate text-xs font-medium text-foreground">{image.label}</span>
            <span className="block truncate text-[0.625rem] text-muted-foreground">{filename}</span>
          </div>
          {/* Spacer so label row height matches when action buttons overlay */}
          {!selecting && <div className="h-7 w-[3.75rem] shrink-0" aria-hidden />}
        </div>
      </button>
      {selecting && (
        <div className="absolute left-2 top-2 z-10">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect?.(image)}
            aria-label={`Select ${filename}`}
            className="h-4 w-4 border-white bg-white/90 shadow"
          />
        </div>
      )}
      {!selecting && (
        <div className="absolute bottom-2 right-2.5 z-10 flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={download}
            title="Download image"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={copyUrl}
            title="Copy image URL"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}
    </div>
  )
}

function TrashImageCard({
  item,
  selecting = false,
  selected = false,
  onToggleSelect,
  onRestore,
  onPermanentDelete,
  busy = false,
}: {
  item: GalleryTrashItem
  selecting?: boolean
  selected?: boolean
  onToggleSelect?: (item: GalleryTrashItem) => void
  onRestore: (item: GalleryTrashItem) => void
  onPermanentDelete: (item: GalleryTrashItem) => void
  busy?: boolean
}) {
  const [visible, setVisible] = useState(true)
  const filename = item.filename || filenameFromUrl(item.url)
  const label = item.label || filename

  if (!visible) return null

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg border bg-card text-left shadow-sm transition',
        selected && 'border-primary ring-2 ring-primary/30',
      )}
    >
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (selecting) onToggleSelect?.(item)
        }}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <div className="aspect-[16/10] overflow-hidden bg-muted">
          <img
            src={mediaUrl(item.url)}
            alt={label}
            loading="lazy"
            onError={() => setVisible(false)}
            className="h-full w-full object-cover opacity-80"
          />
        </div>
      </button>
      {selecting && (
        <div className="absolute left-2 top-2 z-10">
          <Checkbox
            checked={selected}
            disabled={busy}
            onCheckedChange={() => onToggleSelect?.(item)}
            aria-label={`Select ${filename}`}
            className="h-4 w-4 border-white bg-white/90 shadow"
          />
        </div>
      )}
      <div className="space-y-2 px-2.5 py-2">
        <div className="min-w-0">
          <span className="block truncate text-xs font-medium text-foreground">{label}</span>
          <span className="block truncate text-[0.625rem] text-muted-foreground">{filename}</span>
        </div>
        {!selecting && (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 flex-1 gap-1 px-2 text-xs"
              disabled={busy}
              onClick={() => onRestore(item)}
            >
              <RotateCcw className="h-3 w-3" />
              Restore
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 flex-1 gap-1 border-red-200 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
              disabled={busy}
              onClick={() => onPermanentDelete(item)}
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function UploadedPreviewModal({
  image,
  images,
  onNavigate,
  onClose,
}: {
  image: StoredGalleryImage
  images: StoredGalleryImage[]
  onNavigate: (image: StoredGalleryImage) => void
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const fullUrl = absoluteImageUrl(image.url)
  const currentIndex = images.findIndex((img) => img.id === image.id)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < images.length - 1

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      toast.success('Image URL copied')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy URL')
    }
  }

  return (
    <div data-kiterp-modal
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={image.label}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{image.label}</p>
            <p className="truncate text-xs text-muted-foreground">Your upload · {filenameFromUrl(image.url)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void downloadImageFile(image.url, filenameFromUrl(image.url))}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={copyUrl}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              Copy URL
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="overflow-auto bg-muted/30 p-2 sm:p-4">
          <img
            src={mediaUrl(image.url)}
            alt={image.label}
            className="mx-auto max-h-[70vh] w-full rounded-lg object-contain"
          />
        </div>
        <div className="flex items-center gap-3 border-t px-4 py-2.5">
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              disabled={!hasPrev}
              onClick={() => hasPrev && onNavigate(images[currentIndex - 1])}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              disabled={!hasNext}
              onClick={() => hasNext && onNavigate(images[currentIndex + 1])}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
            {images.length > 1 && currentIndex >= 0 && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {currentIndex + 1} / {images.length}
              </span>
            )}
          </div>
          <p className="min-w-0 flex-1 truncate text-right font-mono text-[0.6875rem] text-muted-foreground">
            {fullUrl}
          </p>
        </div>
      </div>
    </div>
  )
}

function ImageCard({
  image,
  categoryLabel,
  onPreview,
}: {
  image: BusinessImage
  categoryLabel?: string
  onPreview: (image: BusinessImage) => void
}) {
  const [copied, setCopied] = useState(false)
  const [visible, setVisible] = useState(true)

  if (!visible) return null

  const copyUrl = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const url = absoluteImageUrl(image.url)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Image URL copied')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy URL')
    }
  }

  const download = (e: React.MouseEvent) => {
    e.stopPropagation()
    void downloadImageFile(image.url, image.filename)
  }

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card text-left shadow-sm transition hover:border-primary/40 hover:shadow-md">
      <button
        type="button"
        onClick={() => onPreview(image)}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <div className="aspect-[16/10] overflow-hidden bg-muted">
          <BusinessGalleryThumb
            image={image}
            onFailed={() => setVisible(false)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        </div>
        <div className="flex items-center justify-between gap-2 px-2.5 py-2">
          <div className="min-w-0">
            <span className="block truncate text-xs font-medium text-foreground">{image.filename}</span>
            {categoryLabel && (
              <span className="block truncate text-[0.625rem] text-muted-foreground">{categoryLabel}</span>
            )}
          </div>
          <div className="h-7 w-[3.75rem] shrink-0" aria-hidden />
        </div>
      </button>
      <div className="absolute bottom-2 right-2.5 z-10 flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={download}
          title="Download image"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={copyUrl}
          title="Copy image URL"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )
}

function PreviewModal({
  image,
  category,
  images,
  onNavigate,
  onClose,
}: {
  image: BusinessImage
  category?: BusinessImageCategory
  images: BusinessImage[]
  onNavigate: (image: BusinessImage) => void
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const fullUrl = absoluteImageUrl(image.url)
  const currentIndex = images.findIndex((img) => img.id === image.id)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < images.length - 1

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      toast.success('Image URL copied')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy URL')
    }
  }

  return (
    <div data-kiterp-modal
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={image.label}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{image.label}</p>
            {category && (
              <p className="truncate text-xs text-muted-foreground">{category.label} · Editorial / cinematic</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void downloadImageFile(image.url, image.filename)}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={copyUrl}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              Copy URL
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="overflow-auto bg-muted/30 p-2 sm:p-4">
          <BusinessGalleryThumb
            image={image}
            className="mx-auto max-h-[70vh] w-full rounded-lg object-contain"
          />
        </div>
        <div className="flex items-center gap-3 border-t px-4 py-2.5">
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              disabled={!hasPrev}
              onClick={() => hasPrev && onNavigate(images[currentIndex - 1])}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              disabled={!hasNext}
              onClick={() => hasNext && onNavigate(images[currentIndex + 1])}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
            {images.length > 1 && currentIndex >= 0 && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {currentIndex + 1} / {images.length}
              </span>
            )}
          </div>
          <p className="min-w-0 flex-1 truncate text-right font-mono text-[0.6875rem] text-muted-foreground">
            {fullUrl}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AssetImagesPage() {
  const defaultCategoryId = BUSINESS_IMAGE_CATEGORIES[0]?.id ?? 'beauty'
  const defaultGroup =
    BUSINESS_IMAGE_CATEGORIES.find((c) => c.id === defaultCategoryId)?.group ?? IMAGE_CATEGORY_GROUPS[0]

  const [viewMode, setViewMode] = useState<'gallery' | 'uploads' | 'trash'>('gallery')
  const [activeCategoryId, setActiveCategoryId] = useState(defaultCategoryId)
  const [search, setSearch] = useState('')
  const [preview, setPreview] = useState<BusinessImage | null>(null)
  const [uploadPreview, setUploadPreview] = useState<StoredGalleryImage | null>(null)
  const [systemStockExpanded, setSystemStockExpanded] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(defaultGroup ? [defaultGroup] : []))
  const [uploading, setUploading] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(() => new Set())
  const [actionBusy, setActionBusy] = useState(false)

  const vendor = useVendorStore((s) => s.vendor)
  const setVendor = useVendorStore((s) => s.setVendor)
  const { images: uploadedImages, isLoading: uploadsLoading, count: uploadCount, refetch: refetchUploads } = useVendorUploadedImages()

  const trashItems = useMemo(
    () => galleryTrashEntries(vendor?.theme_config as Record<string, unknown> | undefined),
    [vendor?.theme_config],
  )

  const applyThemeConfig = useCallback((
    gallery_uploads?: Array<{ url: string; filename?: string; label?: string }>,
    gallery_trash?: GalleryTrashItem[],
    gallery_purged?: string[],
  ) => {
    if (!vendor) return
    setVendor({
      ...vendor,
      theme_config: {
        ...(vendor.theme_config ?? {}),
        ...(gallery_uploads !== undefined ? { gallery_uploads } : {}),
        ...(gallery_trash !== undefined ? { gallery_trash } : {}),
        ...(gallery_purged !== undefined ? { gallery_purged } : {}),
      },
    })
  }, [setVendor, vendor])

  const clearSelection = useCallback(() => {
    setSelectedUrls(new Set())
    setSelecting(false)
  }, [])

  const persistUploadFiles = useCallback(async (files: File[]) => {
    const fileList = files.filter(isLikelyImageFile)
    if (!fileList.length) {
      toast.error('Choose a JPEG, PNG, WebP, GIF, or SVG image')
      return
    }

    setUploading(true)
    try {
      let nextVendor = vendor

      for (const file of fileList) {
        const result = await vendorApi.uploadGalleryImage(file)
        if (nextVendor) {
          nextVendor = {
            ...nextVendor,
            theme_config: {
              ...(nextVendor.theme_config ?? {}),
              gallery_uploads: result.gallery_uploads,
            },
          }
          setVendor(nextVendor)
        }
      }

      await refetchUploads()
      setViewMode('uploads')
      clearSelection()
      toast.success(fileList.length === 1 ? 'Image uploaded' : `${fileList.length} images uploaded`)
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail ?? err.message
        : 'Upload failed — try again or pick another file'
      toast.error(typeof message === 'string' ? message : 'Upload failed — try again or pick another file')
    } finally {
      setUploading(false)
    }
  }, [clearSelection, refetchUploads, setVendor, vendor])

  const { openPicker, modal: uploadPickerModal } = useImageSourcePicker({
    title: 'Add image',
    showGallery: true,
    galleryMultiSelect: true,
    deviceHint: 'Choose a PNG, JPG, or WebP from your computer or phone.',
    onFile: (file) => persistUploadFiles([file]),
    onFiles: persistUploadFiles,
  })

  const activeCategory = BUSINESS_IMAGE_CATEGORIES.find((c) => c.id === activeCategoryId)

  useEffect(() => {
    const group = activeCategory?.group
    if (!group) return
    setSystemStockExpanded(true)
    setExpandedGroups((prev) => {
      if (prev.has(group)) return prev
      return new Set([...prev, group])
    })
  }, [activeCategory?.group])

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  const gallerySearch = search.trim().length > 0

  const visibleImages = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return imagesForCategory(activeCategoryId)
    return BUSINESS_IMAGES.filter((img) => imageMatchesQuery(img, q))
  }, [activeCategoryId, search])

  const visibleUploads = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return uploadedImages
    return uploadedImages.filter((img) => storedImageMatchesQuery(img, q))
  }, [uploadedImages, search])

  const visibleTrash = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return trashItems
    return trashItems.filter((item) => {
      const filename = (item.filename || filenameFromUrl(item.url)).toLowerCase()
      const label = (item.label || '').toLowerCase()
      return filename.includes(q) || label.includes(q) || item.url.toLowerCase().includes(q)
    })
  }, [trashItems, search])

  const showUploads = viewMode === 'uploads'
  const showTrash = viewMode === 'trash'
  const showGallery = viewMode === 'gallery'
  const selectedCount = selectedUrls.size

  const toggleUrlSelected = (url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  const selectAllVisible = () => {
    const urls = showTrash
      ? visibleTrash.map((item) => item.url)
      : visibleUploads.map((img) => img.url)
    setSelectedUrls(new Set(urls))
    setSelecting(true)
  }

  const downloadSelected = async () => {
    const items = showTrash
      ? visibleTrash
          .filter((item) => selectedUrls.has(item.url))
          .map((item) => ({
            url: item.url,
            filename: item.filename || filenameFromUrl(item.url),
          }))
      : visibleUploads
          .filter((img) => selectedUrls.has(img.url))
          .map((img) => ({
            url: img.url,
            filename: filenameFromUrl(img.url),
          }))
    if (!items.length) return

    setActionBusy(true)
    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        await downloadImageFile(item.url, item.filename, { silent: true })
        if (i < items.length - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 250))
        }
      }
      toast.success(
        items.length === 1 ? 'Download started' : `${items.length} images downloading`,
      )
    } finally {
      setActionBusy(false)
    }
  }

  const moveSelectedToTrash = async () => {
    const items = visibleUploads
      .filter((img) => selectedUrls.has(img.url))
      .map((img) => ({ url: img.url, label: img.label, filename: filenameFromUrl(img.url) }))
    if (!items.length) return
    setActionBusy(true)
    try {
      const result = await vendorApi.trashGalleryImages(items)
      applyThemeConfig(result.gallery_uploads, result.gallery_trash)
      await refetchUploads()
      clearSelection()
      toast.success(items.length === 1 ? 'Moved to recycle bin' : `${items.length} images moved to recycle bin`)
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail ?? err.message
        : 'Could not move to recycle bin'
      toast.error(typeof message === 'string' ? message : 'Could not move to recycle bin')
    } finally {
      setActionBusy(false)
    }
  }

  const restoreUrls = async (urls: string[]) => {
    if (!urls.length) return
    setActionBusy(true)
    try {
      const result = await vendorApi.restoreGalleryImages(urls)
      applyThemeConfig(result.gallery_uploads, result.gallery_trash)
      await refetchUploads()
      clearSelection()
      toast.success(urls.length === 1 ? 'Image restored' : `${urls.length} images restored`)
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail ?? err.message
        : 'Could not restore'
      toast.error(typeof message === 'string' ? message : 'Could not restore')
    } finally {
      setActionBusy(false)
    }
  }

  const permanentlyDeleteUrls = async (urls: string[]) => {
    if (!urls.length) return
    const confirmed = await askConfirm(
      urls.length === 1
        ? 'Permanently delete this image? This cannot be undone.'
        : `Permanently delete ${urls.length} images? This cannot be undone.`,
    )
    if (!confirmed) return
    setActionBusy(true)
    try {
      const result = await vendorApi.permanentlyDeleteGalleryImages(urls)
      applyThemeConfig(undefined, result.gallery_trash, result.gallery_purged)
      clearSelection()
      toast.success(urls.length === 1 ? 'Image deleted permanently' : `${urls.length} images deleted permanently`)
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail ?? err.message
        : 'Could not delete permanently'
      toast.error(typeof message === 'string' ? message : 'Could not delete permanently')
    } finally {
      setActionBusy(false)
    }
  }

  const switchView = (mode: 'gallery' | 'uploads' | 'trash') => {
    setViewMode(mode)
    setSearch('')
    setPreview(null)
    setUploadPreview(null)
    clearSelection()
  }

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <aside className="shrink-0 border-b bg-muted/20 lg:w-44 lg:border-b-0 lg:border-r">
        <div className="p-2 sm:p-2.5">
          <nav className="flex gap-2 overflow-x-auto scrollbar-none lg:flex-col lg:overflow-visible lg:gap-2">
            <SidebarSectionHeader
              label="My Uploads"
              count={uploadCount}
              active={showUploads}
              onClick={() => switchView('uploads')}
            />
            <SidebarSectionHeader
              label="Recycle Bin"
              count={trashItems.length}
              active={showTrash}
              onClick={() => switchView('trash')}
            />

            <div className="shrink-0 lg:shrink">
              <SidebarSectionHeader
                label="System Stock"
                count={IMAGE_CATEGORY_GROUPS.length}
                active={showGallery}
                expandable
                expanded={systemStockExpanded}
                onClick={() => setSystemStockExpanded((prev) => !prev)}
              />
              {systemStockExpanded && (
                <div className="space-y-2 pl-1 lg:pl-1.5">
            {IMAGE_CATEGORY_GROUPS.map((group) => {
              const categories = categoriesInGroup(group)
              const expanded = expandedGroups.has(group)
              const activeInGroup = showGallery && categories.some((cat) => cat.id === activeCategoryId)

              return (
                <div key={group} className="shrink-0 lg:shrink">
                  <SidebarSectionHeader
                    label={group}
                    count={categories.length}
                    active={activeInGroup}
                    expandable
                    expanded={expanded}
                    onClick={() => toggleGroup(group)}
                  />
                  {expanded && (
                    <div className="flex gap-1 lg:flex-col">
                      {categories.map((cat) => {
                        const count = imagesForCategory(cat.id).length
                        const active = showGallery && cat.id === activeCategoryId
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setViewMode('gallery')
                              setActiveCategoryId(cat.id)
                              setSearch('')
                              setUploadPreview(null)
                              clearSelection()
                            }}
                            className={cn(
                              'flex shrink-0 items-center justify-between gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors lg:w-full',
                              active
                                ? 'bg-primary/10 font-medium text-primary'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                          >
                            <span>{cat.label}</span>
                            <span
                              className={cn(
                                'text-xs tabular-nums',
                                active ? 'text-primary/70' : 'text-muted-foreground/70',
                              )}
                            >
                              {count}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
                </div>
              )}
            </div>
          </nav>
        </div>
      </aside>

      <div className="min-w-0 flex-1 p-3 sm:p-5">
        <div className="mb-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
                {showTrash ? (
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                ) : showUploads ? (
                  <Upload className="h-4 w-4" strokeWidth={2} />
                ) : (
                  <ImageIcon className="h-4 w-4" strokeWidth={2} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold leading-tight text-foreground">
                  {showTrash ? 'Recycle Bin' : showUploads ? 'My Uploads' : activeCategory?.label ?? 'Images'}
                </h1>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground sm:text-sm">
                  {showTrash
                    ? gallerySearch
                      ? `${visibleTrash.length} result${visibleTrash.length === 1 ? '' : 's'} in recycle bin`
                      : 'Deleted uploads stay here until you restore or permanently delete them.'
                    : showUploads
                      ? gallerySearch
                        ? `${visibleUploads.length} result${visibleUploads.length === 1 ? '' : 's'} in your uploads`
                        : 'Images you have uploaded across products, categories, websites, and account settings.'
                      : gallerySearch
                        ? `${visibleImages.length} result${visibleImages.length === 1 ? '' : 's'} across the entire gallery`
                        : activeCategory?.description ?? 'Royalty-free editorial stock photos for your website and business front.'}
                </p>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:max-w-none sm:shrink-0 sm:justify-end">
              {!selecting && (showUploads || showTrash) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 gap-1.5"
                  disabled={showUploads ? visibleUploads.length === 0 : visibleTrash.length === 0}
                  onClick={() => setSelecting(true)}
                >
                  <Square className="h-3.5 w-3.5" />
                  Select
                </Button>
              )}
              {showUploads && !selecting && (
                <Button
                  type="button"
                  size="sm"
                  className="h-9 shrink-0 gap-1.5"
                  disabled={uploading}
                  onClick={openPicker}
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Upload
                </Button>
              )}
              <div className="relative min-w-[11rem] flex-1 sm:w-52 sm:flex-none lg:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    showTrash
                      ? 'Search recycle bin…'
                      : showUploads
                        ? 'Search your uploads…'
                        : 'Search entire gallery…'
                  }
                  className="h-9 pl-9"
                />
              </div>
              {showGallery && (
                <div className="flex shrink-0 items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {totalImageCount()} images · 1536×1024 · JPG
                </div>
              )}
            </div>
          </div>

          {selecting && (showUploads || showTrash) && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              <p className="mr-auto text-sm font-medium text-foreground">
                {selectedCount > 0
                  ? `${selectedCount} selected`
                  : 'Select images'}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 gap-1.5 bg-background"
                disabled={actionBusy || (showUploads ? visibleUploads.length === 0 : visibleTrash.length === 0)}
                onClick={selectAllVisible}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Select all
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 gap-1.5 bg-background"
                disabled={actionBusy || selectedCount === 0}
                onClick={() => void downloadSelected()}
              >
                {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Download{selectedCount > 0 ? ` (${selectedCount})` : ''}
              </Button>
              {showUploads ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 gap-1.5 border-red-200 bg-background text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={actionBusy || selectedCount === 0}
                  onClick={() => void moveSelectedToTrash()}
                >
                  {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Delete{selectedCount > 0 ? ` (${selectedCount})` : ''}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 gap-1.5 bg-background"
                    disabled={actionBusy || selectedCount === 0}
                    onClick={() => void restoreUrls([...selectedUrls])}
                  >
                    {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    Restore{selectedCount > 0 ? ` (${selectedCount})` : ''}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 gap-1.5 border-red-200 bg-background text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={actionBusy || selectedCount === 0}
                    onClick={() => void permanentlyDeleteUrls([...selectedUrls])}
                  >
                    {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Delete forever{selectedCount > 0 ? ` (${selectedCount})` : ''}
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 bg-background"
                disabled={actionBusy}
                onClick={clearSelection}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>

        {showTrash ? (
          visibleTrash.length === 0 ? (
            <div className="rounded-lg border border-dashed px-6 py-16 text-center">
              <Trash2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">
                {gallerySearch ? 'No deleted images match your search' : 'Recycle bin is empty'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {gallerySearch
                  ? 'Try another keyword.'
                  : 'Images you delete from My Uploads will appear here.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visibleTrash.map((item) => (
                <TrashImageCard
                  key={item.url}
                  item={item}
                  selecting={selecting}
                  selected={selectedUrls.has(item.url)}
                  onToggleSelect={(trashItem) => toggleUrlSelected(trashItem.url)}
                  onRestore={(trashItem) => void restoreUrls([trashItem.url])}
                  onPermanentDelete={(trashItem) => void permanentlyDeleteUrls([trashItem.url])}
                  busy={actionBusy}
                />
              ))}
            </div>
          )
        ) : showUploads ? (
          uploadsLoading ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed px-6 py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : visibleUploads.length === 0 ? (
            <div className="rounded-lg border border-dashed px-6 py-16 text-center">
              <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">
                {gallerySearch ? 'No uploads match your search' : 'No uploads yet'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {gallerySearch
                  ? 'Try another keyword — search covers filenames, labels, and URLs.'
                  : 'Images you upload here and elsewhere in the app will appear in this gallery.'}
              </p>
              {!gallerySearch && (
                <Button
                  type="button"
                  size="sm"
                  className="mt-4 gap-1.5"
                  disabled={uploading}
                  onClick={openPicker}
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Upload image
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visibleUploads.map((image) => (
                <UploadedImageCard
                  key={image.id}
                  image={image}
                  onPreview={setUploadPreview}
                  selecting={selecting}
                  selected={selectedUrls.has(image.url)}
                  onToggleSelect={(img) => toggleUrlSelected(img.url)}
                />
              ))}
            </div>
          )
        ) : visibleImages.length === 0 ? (
          <div className="rounded-lg border border-dashed px-6 py-16 text-center">
            <ImageIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No images match your search</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {gallerySearch
                ? 'Try another keyword — search covers all categories and industry types.'
                : 'Try another keyword or pick a different category.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {visibleImages.map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                categoryLabel={gallerySearch ? categoryById(image.categoryId)?.label : undefined}
                onPreview={setPreview}
              />
            ))}
          </div>
        )}
      </div>

      {preview && (
        <PreviewModal
          image={preview}
          category={categoryById(preview.categoryId)}
          images={visibleImages}
          onNavigate={setPreview}
          onClose={() => setPreview(null)}
        />
      )}

      {uploadPreview && (
        <UploadedPreviewModal
          image={uploadPreview}
          images={visibleUploads}
          onNavigate={setUploadPreview}
          onClose={() => setUploadPreview(null)}
        />
      )}

      {uploadPickerModal}
    </div>
  )
}
