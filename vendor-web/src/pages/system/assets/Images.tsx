import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Check,
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
  categoryById,
  imagesForCategory,
  type BusinessImage,
  type BusinessImageCategory,
} from '@/data/businessImagePack'

function absoluteImageUrl(path: string): string {
  if (path.startsWith('http')) return path
  return `${window.location.origin}${path}`
}

function ImageCard({
  image,
  onPreview,
}: {
  image: BusinessImage
  onPreview: (image: BusinessImage) => void
}) {
  const [copied, setCopied] = useState(false)

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
        <img
          src={image.url}
          alt={image.label}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
        <span className="truncate text-xs font-medium text-foreground">{image.filename}</span>
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
  onClose,
}: {
  image: BusinessImage
  category?: BusinessImageCategory
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const fullUrl = absoluteImageUrl(image.url)

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
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
          <img src={image.url} alt={image.label} className="mx-auto max-h-[70vh] w-full rounded-lg object-contain" />
        </div>
        <div className="border-t px-4 py-2.5">
          <p className="truncate font-mono text-[0.6875rem] text-muted-foreground">{fullUrl}</p>
        </div>
      </div>
    </div>
  )
}

export default function AssetImagesPage() {
  const [activeCategoryId, setActiveCategoryId] = useState(BUSINESS_IMAGE_CATEGORIES[0]?.id ?? 'beauty')
  const [search, setSearch] = useState('')
  const [preview, setPreview] = useState<BusinessImage | null>(null)

  const activeCategory = BUSINESS_IMAGE_CATEGORIES.find((c) => c.id === activeCategoryId)

  const visibleImages = useMemo(() => {
    const base = imagesForCategory(activeCategoryId)
    const q = search.trim().toLowerCase()
    if (!q) return base
    return base.filter(
      (img) =>
        img.filename.toLowerCase().includes(q) ||
        img.label.toLowerCase().includes(q) ||
        img.categoryId.toLowerCase().includes(q),
    )
  }, [activeCategoryId, search])

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <aside className="shrink-0 border-b bg-muted/20 lg:w-56 lg:border-b-0 lg:border-r">
        <div className="p-3 sm:p-4">
          <p className="mb-2 px-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Categories
          </p>
          <nav className="flex gap-1 overflow-x-auto scrollbar-none lg:flex-col lg:overflow-visible">
            {BUSINESS_IMAGE_CATEGORIES.map((cat) => {
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
                    'flex shrink-0 items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors lg:w-full',
                    active
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <span>{cat.label}</span>
                  <span className={cn('text-xs tabular-nums', active ? 'text-primary/70' : 'text-muted-foreground/70')}>
                    {count}
                  </span>
                </button>
              )
            })}
          </nav>
        </div>
      </aside>

      <div className="min-w-0 flex-1 p-4 sm:p-6">
        <div className="mb-5 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
                  <ImageIcon className="h-4 w-4" strokeWidth={2} />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground sm:text-2xl">Images</h1>
                  <p className="text-sm text-muted-foreground">
                    {activeCategory?.description ?? 'Royalty-free editorial stock photos for your website and business front.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              60 images · 1536×1024 · JPG
            </div>
          </div>

          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search in this category…"
              className="pl-9"
            />
          </div>
        </div>

        {visibleImages.length === 0 ? (
          <div className="rounded-lg border border-dashed px-6 py-16 text-center">
            <ImageIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No images match your search</p>
            <p className="mt-1 text-xs text-muted-foreground">Try another keyword or pick a different category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {visibleImages.map((image) => (
              <ImageCard key={image.id} image={image} onPreview={setPreview} />
            ))}
          </div>
        )}
      </div>

      {preview && (
        <PreviewModal
          image={preview}
          category={categoryById(preview.categoryId)}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}
