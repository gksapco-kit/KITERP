import { useMemo, useState } from 'react'
import {
  ChevronDown,
  FolderOpen,
  HardDrive,
  Link2,
  Loader2,
  Search,
  Upload,
} from 'lucide-react'
import { ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  BUSINESS_IMAGE_CATEGORIES,
  BUSINESS_IMAGES,
  IMAGE_CATEGORY_GROUPS,
  categoriesInGroup,
  imagesForCategory,
  type BusinessImageCategory,
} from '@/data/businessImagePack'

export type MediaUploadPickerTarget = 'logo' | 'banner' | 'extra-banner'

type Props = {
  open: boolean
  onClose: () => void
  /** Modal title, e.g. "Add Cover image". Prefer over `target`. */
  title?: string
  /** @deprecated Use `title` instead */
  target?: MediaUploadPickerTarget
  showGallery?: boolean
  onChooseLocal: () => void
  onChooseGalleryUrl: (url: string) => void | Promise<void>
  onChooseExternalUrl?: (url: string) => void | Promise<void>
}

type Step = 'menu' | 'gallery' | 'url'

const TARGET_LABELS: Record<MediaUploadPickerTarget, string> = {
  logo: 'Logo',
  banner: 'Primary banner',
  'extra-banner': 'Additional banner',
}

export { TARGET_LABELS as MEDIA_UPLOAD_TARGET_LABELS }

export function MediaUploadPickerModal({
  open,
  onClose,
  title: titleProp,
  target,
  showGallery = true,
  onChooseLocal,
  onChooseGalleryUrl,
  onChooseExternalUrl,
}: Props) {
  const [step, setStep] = useState<Step>('menu')
  const [categoryId, setCategoryId] = useState<string>(BUSINESS_IMAGE_CATEGORIES[0]?.id ?? 'shop')
  const [search, setSearch] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [applying, setApplying] = useState(false)
  const defaultGalleryGroup =
    BUSINESS_IMAGE_CATEGORIES.find((c) => c.id === categoryId)?.group ?? IMAGE_CATEGORY_GROUPS[0]
  const [expandedGalleryGroups, setExpandedGalleryGroups] = useState<Set<string>>(
    () => new Set(defaultGalleryGroup ? [defaultGalleryGroup] : []),
  )

  const title = titleProp ?? (target ? `Add ${TARGET_LABELS[target]}` : 'Add image')

  const filteredGallery = useMemo(() => {
    const q = search.trim().toLowerCase()
    const pool = q
      ? BUSINESS_IMAGES.filter(
          (img) =>
            img.label.toLowerCase().includes(q) ||
            img.categoryId.toLowerCase().includes(q) ||
            img.filename.toLowerCase().includes(q),
        )
      : imagesForCategory(categoryId)
    return pool
  }, [categoryId, search])

  const resetAndClose = () => {
    setStep('menu')
    setSearch('')
    setUrlInput('')
    setApplying(false)
    onClose()
  }

  const handleLocal = () => {
    resetAndClose()
    onChooseLocal()
  }

  const handleGalleryPick = async (url: string) => {
    setApplying(true)
    try {
      await onChooseGalleryUrl(url)
      resetAndClose()
    } finally {
      setApplying(false)
    }
  }

  const handleUrlPick = async () => {
    const trimmed = urlInput.trim()
    if (!trimmed || !onChooseExternalUrl) return
    setApplying(true)
    try {
      await onChooseExternalUrl(trimmed)
      resetAndClose()
    } finally {
      setApplying(false)
    }
  }

  if (!open) return null

  return (
    <ModalOverlay onClose={resetAndClose}>
      <ModalPanel className="max-w-lg">
        <div className="space-y-4 p-4 sm:p-5">
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

          {step === 'menu' && (
            <div className="grid gap-2 sm:grid-cols-1">
              <button
                type="button"
                onClick={handleLocal}
                className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <HardDrive className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">From this device</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Choose a PNG or JPG from your computer or phone.
                  </span>
                </span>
              </button>

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
                      Browse ready-made business photos (beauty, retail, food, etc.).
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
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search gallery…"
                  className="h-9 pl-8 text-sm"
                />
              </div>

              {!search.trim() && (
                <div className="max-h-36 space-y-1 overflow-y-auto overscroll-contain pr-0.5">
                  {IMAGE_CATEGORY_GROUPS.map((group) => {
                    const categories = categoriesInGroup(group)
                    const expanded = expandedGalleryGroups.has(group)
                    const activeInGroup = categories.some((cat) => cat.id === categoryId)

                    return (
                      <div key={group} className="rounded-lg border border-border/80 bg-muted/20">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedGalleryGroups((prev) => {
                              const next = new Set(prev)
                              if (next.has(group)) next.delete(group)
                              else next.add(group)
                              return next
                            })
                          }
                          aria-expanded={expanded}
                          className={cn(
                            'flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left',
                            activeInGroup && !expanded && 'text-primary',
                          )}
                        >
                          <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">
                            {group}
                          </span>
                          <span className="flex items-center gap-1">
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
                          <div className="flex flex-wrap gap-1.5 border-t border-border/60 px-2.5 pb-2 pt-1.5">
                            {categories.map((cat: BusinessImageCategory) => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                  setCategoryId(cat.id)
                                  setExpandedGalleryGroups((prev) => new Set([...prev, group]))
                                }}
                                className={cn(
                                  'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                                  categoryId === cat.id
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground',
                                )}
                              >
                                {cat.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="grid max-h-[min(22rem,50vh)] grid-cols-3 gap-2 overflow-y-auto overscroll-contain sm:grid-cols-4">
                {filteredGallery.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    disabled={applying}
                    onClick={() => handleGalleryPick(img.url)}
                    className="group relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-muted transition hover:border-primary hover:ring-2 hover:ring-primary/25 disabled:opacity-60"
                    title={img.label}
                  >
                    <img
                      src={img.url}
                      alt={img.label}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                    />
                  </button>
                ))}
              </div>

              {filteredGallery.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No images match your search.</p>
              )}
            </div>
          )}

          {step === 'url' && onChooseExternalUrl && (
            <div className="space-y-3">
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

/** Fetch a gallery/static image into a File for upload APIs. */
export async function galleryImageToFile(galleryPath: string): Promise<File> {
  const src =
    galleryPath.startsWith('http://') || galleryPath.startsWith('https://') || galleryPath.startsWith('data:')
      ? galleryPath
      : `${window.location.origin}${galleryPath.startsWith('/') ? galleryPath : `/${galleryPath}`}`
  const res = await fetch(src)
  if (!res.ok) throw new Error(`Could not load image (${res.status})`)
  const blob = await res.blob()
  const name = galleryPath.split('/').pop() || 'image.jpg'
  return new File([blob], name, { type: blob.type || 'image/jpeg' })
}

/** Resolve logo/banner paths for display (uploads vs local gallery assets). */
export function resolveBrandingImageUrl(url?: string | null): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url
  if (url.startsWith('/business-images')) return url
  const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/api\/v1\/?$/, '')
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`
}
