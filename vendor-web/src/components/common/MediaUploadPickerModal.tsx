import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Check,
  FolderOpen,
  HardDrive,
  Link2,
  Loader2,
  Search,
  Upload,
} from 'lucide-react'
import { ModalHeader, ModalOverlay, ModalPanel, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { apiClient } from '@/api/client'
import {
  BUSINESS_IMAGE_CATEGORIES,
  BUSINESS_IMAGES,
  IMAGE_CATEGORY_GROUPS,
  businessImageByGalleryUrl,
  categoriesInGroup,
  categoryById,
  imagesForCategory,
  type BusinessImage,
  type BusinessImageCategory,
} from '@/data/businessImagePack'
import { BusinessGalleryThumb } from '@/components/common/BusinessGalleryThumb'
import { useGalleryPickerContext } from '@/hooks/useGalleryPickerContext'
import type { StoredGalleryImage } from '@/lib/galleryPickerImages'
import { mediaUrl } from '@/lib/utils'

export type MediaUploadPickerTarget = 'logo' | 'banner' | 'extra-banner'

type Props = {
  open: boolean
  onClose: () => void
  /** Modal title, e.g. "Add Cover image". Prefer over `target`. */
  title?: string
  /** @deprecated Use `title` instead */
  target?: MediaUploadPickerTarget
  showGallery?: boolean
  /** Override subtitle under "From this device". */
  deviceHint?: string
  /** When true, gallery allows selecting multiple images before adding. */
  galleryMultiSelect?: boolean
  /** When set, "From this device" uses a native label→input association (most reliable). */
  deviceInputId?: string
  /** Include website media library images in the stored-images section. */
  siteId?: string | null
  /** Override default stock category (defaults to active BU business type). */
  defaultCategoryId?: string
  /** Override stored / uploaded images shown before stock gallery. */
  storedImages?: StoredGalleryImage[]
  onChooseLocal: () => void
  onChooseGalleryUrl: (url: string) => void | Promise<void>
  /** Batch gallery pick (used when galleryMultiSelect is true). */
  onChooseGalleryUrls?: (urls: string[]) => void | Promise<void>
  onChooseExternalUrl?: (url: string) => void | Promise<void>
}

type Step = 'menu' | 'gallery' | 'url'

const TARGET_LABELS: Record<MediaUploadPickerTarget, string> = {
  logo: 'Logo',
  banner: 'Primary banner',
  'extra-banner': 'Additional banner',
}

export { TARGET_LABELS as MEDIA_UPLOAD_TARGET_LABELS }

/** First stock category to show under the pinned business-category section. */
function defaultBrowseCategoryId(businessCategoryId: string): string {
  const businessCat = categoryById(businessCategoryId)
  const group = businessCat?.group ?? IMAGE_CATEGORY_GROUPS[0]
  const inGroup = categoriesInGroup(group)
  const sibling = inGroup.find((c) => c.id !== businessCategoryId)
  if (sibling) return sibling.id
  const anyOther = BUSINESS_IMAGE_CATEGORIES.find((c) => c.id !== businessCategoryId)
  return anyOther?.id ?? businessCategoryId
}

function GallerySection({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-2', className)}>
      <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </section>
  )
}

function StockImageGrid({
  images,
  applying,
  galleryMultiSelect,
  selectedUrls,
  onPick,
  className,
}: {
  images: BusinessImage[]
  applying: boolean
  galleryMultiSelect: boolean
  selectedUrls: Set<string>
  onPick: (url: string) => void
  className?: string
}) {
  if (images.length === 0) return null
  return (
    <div className={cn('grid grid-cols-3 gap-2 sm:grid-cols-4', className)}>
      {images.map((img) => (
        <GalleryImageTile
          key={img.id}
          img={img}
          applying={applying}
          galleryMultiSelect={galleryMultiSelect}
          selected={selectedUrls.has(img.url)}
          onPick={() => onPick(img.url)}
        />
      ))}
    </div>
  )
}

function StoredImageGrid({
  images,
  applying,
  galleryMultiSelect,
  selectedUrls,
  onPick,
  className,
}: {
  images: StoredGalleryImage[]
  applying: boolean
  galleryMultiSelect: boolean
  selectedUrls: Set<string>
  onPick: (url: string) => void
  className?: string
}) {
  if (images.length === 0) return null
  return (
    <div className={cn('grid grid-cols-3 gap-2 sm:grid-cols-4', className)}>
      {images.map((img) => (
        <StoredGalleryImageTile
          key={img.id}
          img={img}
          applying={applying}
          galleryMultiSelect={galleryMultiSelect}
          selected={selectedUrls.has(img.url)}
          onPick={() => onPick(img.url)}
        />
      ))}
    </div>
  )
}

function StoredGalleryImageTile({
  img,
  applying,
  galleryMultiSelect,
  selected,
  onPick,
}: {
  img: StoredGalleryImage
  applying: boolean
  galleryMultiSelect: boolean
  selected: boolean
  onPick: () => void
}) {
  const [visible, setVisible] = useState(true)
  if (!visible) return null

  const src = mediaUrl(img.url)

  return (
    <button
      type="button"
      disabled={applying}
      onClick={onPick}
      className={cn(
        'group relative aspect-[4/3] overflow-hidden rounded-md border bg-muted transition disabled:opacity-60',
        galleryMultiSelect && selected
          ? 'border-primary ring-2 ring-primary/40'
          : 'border-border hover:border-primary hover:ring-2 hover:ring-primary/25',
      )}
      title={img.label}
      aria-pressed={galleryMultiSelect ? selected : undefined}
    >
      <img
        src={src}
        alt={img.label}
        loading="lazy"
        onError={() => setVisible(false)}
        className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
      />
      {galleryMultiSelect && (
        <span
          className={cn(
            'absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border shadow-sm transition-colors',
            selected
              ? 'border-primary bg-primary text-white'
              : 'border-white/80 bg-black/35 text-transparent group-hover:text-white/80',
          )}
        >
          <Check className="h-3 w-3" />
        </span>
      )}
    </button>
  )
}

function GalleryImageTile({
  img,
  applying,
  galleryMultiSelect,
  selected,
  onPick,
}: {
  img: BusinessImage
  applying: boolean
  galleryMultiSelect: boolean
  selected: boolean
  onPick: () => void
}) {
  const [visible, setVisible] = useState(true)
  if (!visible) return null

  return (
    <button
      type="button"
      disabled={applying}
      onClick={onPick}
      className={cn(
        'group relative aspect-[4/3] overflow-hidden rounded-md border bg-muted transition disabled:opacity-60',
        galleryMultiSelect && selected
          ? 'border-primary ring-2 ring-primary/40'
          : 'border-border hover:border-primary hover:ring-2 hover:ring-primary/25',
      )}
      title={img.label}
      aria-pressed={galleryMultiSelect ? selected : undefined}
    >
      <BusinessGalleryThumb
        image={img}
        onFailed={() => setVisible(false)}
        className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
      />
      {galleryMultiSelect && (
        <span
          className={cn(
            'absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border shadow-sm transition-colors',
            selected
              ? 'border-primary bg-primary text-white'
              : 'border-white/80 bg-black/35 text-transparent group-hover:text-white/80',
          )}
        >
          <Check className="h-3 w-3" />
        </span>
      )}
    </button>
  )
}

export function MediaUploadPickerModal({
  open,
  onClose,
  title: titleProp,
  target,
  showGallery = true,
  deviceHint,
  galleryMultiSelect = false,
  deviceInputId,
  siteId,
  defaultCategoryId: defaultCategoryIdProp,
  storedImages: storedImagesProp,
  onChooseLocal,
  onChooseGalleryUrl,
  onChooseGalleryUrls,
  onChooseExternalUrl,
}: Props) {
  const galleryContext = useGalleryPickerContext({ siteId })
  const resolvedDefaultCategoryId =
    defaultCategoryIdProp ?? galleryContext.defaultCategoryId ?? BUSINESS_IMAGE_CATEGORIES[0]?.id ?? 'shop'
  const storedImages = storedImagesProp ?? galleryContext.storedImages

  const [step, setStep] = useState<Step>('menu')
  const [categoryId, setCategoryId] = useState<string>(resolvedDefaultCategoryId)
  const [search, setSearch] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [applying, setApplying] = useState(false)
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(() => new Set())
  const [stockTabGroup, setStockTabGroup] = useState<string>(
    () => categoryById(defaultBrowseCategoryId(resolvedDefaultCategoryId))?.group ?? IMAGE_CATEGORY_GROUPS[0],
  )

  useEffect(() => {
    if (!open) return
    const browseId = defaultBrowseCategoryId(resolvedDefaultCategoryId)
    setCategoryId(browseId)
    setStockTabGroup(categoryById(browseId)?.group ?? IMAGE_CATEGORY_GROUPS[0])
  }, [open, resolvedDefaultCategoryId])

  const handleStockTabChange = (group: string) => {
    setStockTabGroup(group)
    const categories = categoriesInGroup(group)
    const next =
      categories.find((c) => c.id !== resolvedDefaultCategoryId)
      ?? categories[0]
    if (next) setCategoryId(next.id)
  }

  const title = titleProp ?? (target ? `Add ${TARGET_LABELS[target]}` : 'Add image')

  const businessCategoryLabel =
    categoryById(resolvedDefaultCategoryId)?.label ?? 'Your business'

  const isSearching = search.trim().length > 0

  const filteredStoredImages = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return storedImages
    return storedImages.filter(
      (img) =>
        img.label.toLowerCase().includes(q) ||
        img.url.toLowerCase().includes(q),
    )
  }, [storedImages, search])

  const businessCategoryStock = useMemo(
    () => imagesForCategory(resolvedDefaultCategoryId),
    [resolvedDefaultCategoryId],
  )

  const filteredBusinessCategoryStock = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return businessCategoryStock
    return businessCategoryStock.filter(
      (img) =>
        img.label.toLowerCase().includes(q) ||
        img.categoryId.toLowerCase().includes(q) ||
        img.filename.toLowerCase().includes(q),
    )
  }, [businessCategoryStock, search])

  const browseCategoryStock = useMemo(
    () => imagesForCategory(categoryId),
    [categoryId],
  )

  const filteredBrowseCategoryStock = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return browseCategoryStock
    return browseCategoryStock.filter(
      (img) =>
        img.label.toLowerCase().includes(q) ||
        img.categoryId.toLowerCase().includes(q) ||
        img.filename.toLowerCase().includes(q),
    )
  }, [browseCategoryStock, search])

  const filteredSearchStock = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return BUSINESS_IMAGES.filter(
      (img) =>
        img.label.toLowerCase().includes(q) ||
        img.categoryId.toLowerCase().includes(q) ||
        img.filename.toLowerCase().includes(q),
    )
  }, [search])

  const visiblePickUrls = useMemo(() => {
    if (isSearching) {
      return [
        ...filteredStoredImages.map((img) => img.url),
        ...filteredSearchStock.map((img) => img.url),
      ]
    }
    const urls = [
      ...filteredStoredImages.map((img) => img.url),
      ...filteredBusinessCategoryStock.map((img) => img.url),
    ]
    if (categoryId !== resolvedDefaultCategoryId) {
      urls.push(...filteredBrowseCategoryStock.map((img) => img.url))
    }
    return urls
  }, [
    isSearching,
    filteredStoredImages,
    filteredSearchStock,
    filteredBusinessCategoryStock,
    filteredBrowseCategoryStock,
    categoryId,
    resolvedDefaultCategoryId,
  ])

  const hasVisibleGallery = visiblePickUrls.length > 0

  const resetAndClose = () => {
    setStep('menu')
    setSearch('')
    setUrlInput('')
    setApplying(false)
    setSelectedUrls(new Set())
    onClose()
  }

  const toggleGallerySelection = (url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  const selectAllVisible = () => {
    setSelectedUrls(new Set(visiblePickUrls))
  }

  const galleryPickUrl = (url: string) => {
    if (galleryMultiSelect) {
      toggleGallerySelection(url)
      return
    }
    void handleGalleryPick(url)
  }

  const clearSelection = () => setSelectedUrls(new Set())

  const handleLocal = () => {
    onChooseLocal()
  }

  const devicePickerClassName =
    'flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 cursor-pointer'

  const handleGalleryPick = async (url: string) => {
    setApplying(true)
    try {
      await onChooseGalleryUrl(url)
    } finally {
      setApplying(false)
      resetAndClose()
    }
  }

  const handleGalleryPickMultiple = async () => {
    const urls = [...selectedUrls]
    if (urls.length === 0) return
    setApplying(true)
    try {
      if (onChooseGalleryUrls) {
        await onChooseGalleryUrls(urls)
      } else {
        for (const url of urls) {
          await onChooseGalleryUrl(url)
        }
      }
    } finally {
      setApplying(false)
      resetAndClose()
    }
  }

  const handleUrlPick = async () => {
    const trimmed = urlInput.trim()
    if (!trimmed || !onChooseExternalUrl) return
    setApplying(true)
    try {
      await onChooseExternalUrl(trimmed)
    } finally {
      setApplying(false)
      resetAndClose()
    }
  }

  if (!open) return null

  return (
    <ModalOverlay onClose={resetAndClose}>
      <ModalPanel className={cn('max-w-lg', step === 'gallery' && 'max-h-[min(90dvh,calc(100vh-2rem))]')}>
        <div className={cn('flex min-h-0 flex-col', step === 'gallery' ? 'max-h-[inherit]' : '')}>
          <div className="shrink-0 space-y-4 p-4 sm:p-5 pb-0">
            <ModalHeader
              title={step === 'menu' ? title : step === 'gallery' ? 'Image gallery' : 'Image URL'}
              subtitle={
                step === 'menu' ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Upload from your device or pick a stock image.
                  </p>
                ) : step === 'gallery' ? (
                  <button
                    type="button"
                    className="mt-0.5 text-xs text-primary hover:underline"
                    onClick={() => setStep('menu')}
                  >
                    ← Back to options
                  </button>
                ) : (
                  <button
                    type="button"
                    className="mt-0.5 text-xs text-primary hover:underline"
                    onClick={() => setStep('menu')}
                  >
                    ← Back to options
                  </button>
                )
              }
              onClose={resetAndClose}
            />

            {step === 'gallery' && (
              <p className="text-xs text-muted-foreground">
                Your uploads first, then stock photos for {businessCategoryLabel.toLowerCase()} and other categories.
                {galleryMultiSelect ? ' Click images to select multiple, then add them together.' : null}
              </p>
            )}
          </div>

          {step === 'menu' && (
            <div className="grid gap-2 p-4 sm:p-5 pt-4 sm:grid-cols-1">
              {deviceInputId ? (
                <label htmlFor={deviceInputId} className={devicePickerClassName} onClick={(e) => e.stopPropagation()}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <HardDrive className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">From this device</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {deviceHint ?? 'Choose a PNG or JPG from your computer or phone.'}
                    </span>
                  </span>
                </label>
              ) : (
                <button
                  type="button"
                  onClick={handleLocal}
                  className={devicePickerClassName}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <HardDrive className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">From this device</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {deviceHint ?? 'Choose a PNG or JPG from your computer or phone.'}
                    </span>
                  </span>
                </button>
              )}

              {showGallery ? (
                <button
                  type="button"
                  onClick={() => setStep('gallery')}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FolderOpen className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">From gallery</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Pick from your uploads, or stock photos for your business type.
                    </span>
                  </span>
                </button>
              ) : null}

              {onChooseExternalUrl ? (
                <button
                  type="button"
                  onClick={() => setStep('url')}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Link2 className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">Paste image URL</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Use a link that is already hosted online.
                    </span>
                  </span>
                </button>
              ) : null}
            </div>
          )}

          {step === 'gallery' && (
            <>
              <ModalBody className="space-y-3 px-4 sm:px-5 py-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search gallery…"
                  className="h-9 pl-8 text-sm"
                />
              </div>

              <div
                className={cn(
                  'space-y-4',
                  galleryMultiSelect ? 'max-h-none' : 'max-h-[min(22rem,50vh)] overflow-y-auto overscroll-contain',
                )}
              >
                {isSearching ? (
                  <>
                    {filteredStoredImages.length > 0 && (
                      <GallerySection title="Your uploads">
                        <StoredImageGrid
                          images={filteredStoredImages}
                          applying={applying}
                          galleryMultiSelect={galleryMultiSelect}
                          selectedUrls={selectedUrls}
                          onPick={galleryPickUrl}
                        />
                      </GallerySection>
                    )}
                    {filteredSearchStock.length > 0 && (
                      <GallerySection title="Stock photos">
                        <StockImageGrid
                          images={filteredSearchStock}
                          applying={applying}
                          galleryMultiSelect={galleryMultiSelect}
                          selectedUrls={selectedUrls}
                          onPick={galleryPickUrl}
                        />
                      </GallerySection>
                    )}
                  </>
                ) : (
                  <>
                    {filteredStoredImages.length > 0 && (
                      <GallerySection title="Your uploads">
                        <StoredImageGrid
                          images={filteredStoredImages}
                          applying={applying}
                          galleryMultiSelect={galleryMultiSelect}
                          selectedUrls={selectedUrls}
                          onPick={galleryPickUrl}
                        />
                      </GallerySection>
                    )}

                    {filteredBusinessCategoryStock.length > 0 && (
                      <GallerySection title={`For your business · ${businessCategoryLabel}`}>
                        <StockImageGrid
                          images={filteredBusinessCategoryStock}
                          applying={applying}
                          galleryMultiSelect={galleryMultiSelect}
                          selectedUrls={selectedUrls}
                          onPick={galleryPickUrl}
                        />
                      </GallerySection>
                    )}

                    <GallerySection title="More stock photos">
                      <Tabs value={stockTabGroup} onValueChange={handleStockTabChange}>
                        <TabsList className="flex h-auto w-full flex-nowrap justify-start gap-0.5 overflow-x-auto rounded-lg bg-muted/60 p-1">
                          {IMAGE_CATEGORY_GROUPS.map((group) => (
                            <TabsTrigger
                              key={group}
                              value={group}
                              className="shrink-0 px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-wide data-[state=active]:bg-background"
                            >
                              {group}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </Tabs>

                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {categoriesInGroup(stockTabGroup).map((cat: BusinessImageCategory) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setCategoryId(cat.id)
                              const catGroup = categoryById(cat.id)?.group
                              if (catGroup) setStockTabGroup(catGroup)
                            }}
                            className={cn(
                              'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                              categoryId === cat.id
                                ? 'border-primary bg-primary/10 text-primary'
                                : cat.id === resolvedDefaultCategoryId
                                  ? 'border-primary/40 bg-primary/5 text-primary/80'
                                  : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground',
                            )}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      {categoryId !== resolvedDefaultCategoryId && filteredBrowseCategoryStock.length > 0 && (
                        <StockImageGrid
                          images={filteredBrowseCategoryStock}
                          applying={applying}
                          galleryMultiSelect={galleryMultiSelect}
                          selectedUrls={selectedUrls}
                          onPick={galleryPickUrl}
                          className="pt-1"
                        />
                      )}
                    </GallerySection>
                  </>
                )}
              </div>

              {!hasVisibleGallery && (
                <p className="py-6 text-center text-sm text-muted-foreground">No images match your search.</p>
              )}
              </ModalBody>

              {galleryMultiSelect && hasVisibleGallery && (
                <ModalFooter className="border-t border-border bg-card px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={selectAllVisible}
                        disabled={applying}
                      >
                        Select all
                      </button>
                      {selectedUrls.size > 0 && (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground"
                          onClick={clearSelection}
                          disabled={applying}
                        >
                          Clear
                        </button>
                      )}
                      {selectedUrls.size > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {selectedUrls.size} selected
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      disabled={selectedUrls.size === 0 || applying}
                      onClick={handleGalleryPickMultiple}
                    >
                      {applying ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      Add selected{selectedUrls.size > 0 ? ` (${selectedUrls.size})` : ''}
                    </Button>
                  </div>
                </ModalFooter>
              )}
            </>
          )}

          {step === 'url' && onChooseExternalUrl && (
            <div className="space-y-3 p-4 sm:p-5 pt-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Image URL</label>
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="text-sm"
                />
              </div>
              <Button
                type="button"
                className="w-full gap-1.5"
                disabled={!urlInput.trim() || applying}
                onClick={handleUrlPick}
              >
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Use this URL
              </Button>
            </div>
          )}
        </div>
      </ModalPanel>
    </ModalOverlay>
  )
}

async function blobLooksLikeImage(blob: Blob): Promise<boolean> {
  if (blob.type.startsWith('image/')) return true
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer())
  if (head.length < 2) return false
  if (head[0] === 0xff && head[1] === 0xd8) return true
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return true
  if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return true
  if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46) return true
  const prefix = new TextDecoder().decode(head).trimStart()
  return !prefix.startsWith('<') && !prefix.startsWith('{')
}

function filenameFromUrl(url: string): string {
  try {
    const base = new URL(url).pathname.split('/').pop()?.split('?')[0] || 'image.jpg'
    return base.includes('.') ? base : `${base}.jpg`
  } catch {
    const tail = url.split('/').pop()?.split('?')[0] || 'image.jpg'
    return tail.includes('.') ? tail : `${tail}.jpg`
  }
}

async function proxyImageToFile(url: string): Promise<File> {
  const res = await apiClient.post('/uploads/proxy-image', { url: url.trim() }, { responseType: 'blob', timeout: 60000 })
  const blob = res.data as Blob
  if (!(await blobLooksLikeImage(blob))) {
    throw new Error('Response was not an image')
  }
  const type = blob.type.startsWith('image/') ? blob.type : 'image/jpeg'
  return new File([blob], filenameFromUrl(url), { type })
}

/** Resolve gallery paths, remote http(s) URLs, or local assets into a File for upload APIs. */
export async function remoteImageToFile(url: string): Promise<File> {
  const trimmed = url.trim()
  if (!trimmed) throw new Error('Image URL is required')
  if (trimmed.startsWith('/business-images') || businessImageByGalleryUrl(trimmed)) {
    return galleryImageToFile(trimmed)
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return proxyImageToFile(trimmed)
  }
  return galleryImageToFile(trimmed)
}

/** Fetch a gallery/static image into a File for upload APIs. */
export async function galleryImageToFile(galleryPath: string): Promise<File> {
  const biz = businessImageByGalleryUrl(galleryPath)
  // Match the gallery grid: primary local path first, remote stock fallback only if missing.
  const candidates = [
    galleryPath,
    ...(biz?.fallbackUrl && biz.fallbackUrl !== galleryPath ? [biz.fallbackUrl] : []),
  ].filter((path, index, all) => path && all.indexOf(path) === index)

  let lastError: Error | null = null
  for (const path of candidates) {
    try {
      const src =
        path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')
          ? path
          : `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`
      const res = await fetch(src)
      if (!res.ok) {
        lastError = new Error(`Could not load image (${res.status})`)
        continue
      }
      const blob = await res.blob()
      if (!(await blobLooksLikeImage(blob))) {
        lastError = new Error('Response was not an image')
        continue
      }
      const name = filenameFromUrl(path.startsWith('http') ? path : `https://local${path.startsWith('/') ? path : `/${path}`}`)
      return new File([blob], name, { type: blob.type.startsWith('image/') ? blob.type : 'image/jpeg' })
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Could not load image')
    }
  }
  throw lastError ?? new Error('Could not load image')
}

/** Resolve logo/banner paths for display (uploads vs local gallery assets). */
export function resolveBrandingImageUrl(url?: string | null): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url
  if (url.startsWith('/business-images')) return url
  const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/api\/v1\/?$/, '')
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`
}
