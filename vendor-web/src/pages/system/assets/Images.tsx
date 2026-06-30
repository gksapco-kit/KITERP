import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Image as ImageIcon,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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

  return (
    <button
      type="button"
      onClick={() => onPreview(image)}
      className="group relative overflow-hidden rounded-lg border bg-card text-left shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"
          onClick={copyUrl}
          title="Copy image URL"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </button>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto"
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

  const [activeCategoryId, setActiveCategoryId] = useState(defaultCategoryId)
  const [search, setSearch] = useState('')
  const [preview, setPreview] = useState<BusinessImage | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(defaultGroup ? [defaultGroup] : []))

  const activeCategory = BUSINESS_IMAGE_CATEGORIES.find((c) => c.id === activeCategoryId)

  useEffect(() => {
    const group = activeCategory?.group
    if (!group) return
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

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <aside className="shrink-0 border-b bg-muted/20 lg:w-44 lg:border-b-0 lg:border-r">
        <div className="p-2 sm:p-2.5">
          <nav className="flex gap-2 overflow-x-auto scrollbar-none lg:flex-col lg:overflow-visible lg:gap-2">
            {IMAGE_CATEGORY_GROUPS.map((group) => {
              const categories = categoriesInGroup(group)
              const expanded = expandedGroups.has(group)
              const activeInGroup = categories.some((cat) => cat.id === activeCategoryId)

              return (
                <div key={group} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    aria-expanded={expanded}
                    className={cn(
                      'mb-1 flex w-full min-w-[9rem] items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition-colors lg:min-w-0',
                      'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                      activeInGroup && !expanded && 'text-primary',
                    )}
                  >
                    <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground/80">
                      {group}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="text-[0.625rem] tabular-nums text-muted-foreground/70">{categories.length}</span>
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
                          expanded && 'rotate-180',
                        )}
                      />
                    </span>
                  </button>
                  {expanded && (
                    <div className="flex gap-1 lg:flex-col">
                      {categories.map((cat) => {
                        const count = imagesForCategory(cat.id).length
                        const active = cat.id === activeCategoryId
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setActiveCategoryId(cat.id)
                              setSearch('')
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
          </nav>
        </div>
      </aside>

      <div className="min-w-0 flex-1 p-3 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 lg:flex-nowrap lg:gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
              <ImageIcon className="h-4 w-4" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold leading-tight text-foreground">Images</h1>
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                {gallerySearch
                  ? `${visibleImages.length} result${visibleImages.length === 1 ? '' : 's'} across the entire gallery`
                  : activeCategory?.description ?? 'Royalty-free editorial stock photos for your website and business front.'}
              </p>
            </div>
          </div>

          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
            <div className="relative w-full min-w-[11rem] sm:w-52 lg:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search entire gallery…"
                className="h-9 pl-9"
              />
            </div>
            <div className="flex shrink-0 items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {totalImageCount()} images · 1536×1024 · JPG
            </div>
          </div>
        </div>

        {visibleImages.length === 0 ? (
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
    </div>
  )
}
