import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, ImagePlus, Loader2, Save, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn, mediaUrl, solidButtonFocusClassName } from '@/lib/utils'
import { normalizePageSlug, pageSlugTaken } from '@/lib/pageSlug'
import {
  clampCanonicalUrl,
  clampFocusKeyword,
  clampSeoDescription,
  clampSeoKeywords,
  clampSeoTitle,
  SEO_CANONICAL_MAX,
  SEO_DESCRIPTION_MAX,
  SEO_FOCUS_KEYWORD_MAX,
  SEO_KEYWORDS_MAX,
  SEO_TITLE_MAX,
} from '@/lib/seoLimits'
import { Checkbox } from '@/components/ui/checkbox'
import { Select } from '@/components/ui/select'
import { SeoScoreCard } from '@/components/websites/SeoScoreCard'
import {
  computePageSeoScore,
  computeSiteSeoScore,
} from '@/lib/seoScore'
import {
  describeStructuredData,
  PAGE_SCHEMA_OPTIONS,
  SITE_SCHEMA_OPTIONS,
  type PageSchemaType,
  type SiteSchemaType,
} from '@/lib/schemaTypes'
import { useAIGenerateSEO, useUploadMedia } from '@/hooks/useWebsites'
import type { WebsitePage, WebsiteSite } from '@/types/websites'

const fieldClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring'

type PageSeoSavePayload = Partial<
  Pick<
    WebsitePage,
    | 'seo_title'
    | 'seo_description'
    | 'og_image_url'
    | 'slug'
    | 'focus_keyword'
    | 'seo_keywords'
    | 'noindex'
    | 'og_title'
    | 'og_description'
    | 'canonical_url'
    | 'schema_type'
  >
>

type SiteSeoSavePayload = {
  seo_title?: string
  seo_description?: string
  seo_keywords?: string
  schema_org_type?: string
}

function FieldLabel({
  children,
  count,
  max,
  warnAt,
}: {
  children: ReactNode
  count?: number
  max?: number
  warnAt?: number
}) {
  const warn = count != null && warnAt != null && count > warnAt
  const over = count != null && max != null && count >= max
  return (
    <div className="mb-1.5 flex items-end justify-between gap-2">
      <label className="text-sm font-medium text-foreground">{children}</label>
      {count != null && max != null && (
        <span className={cn('text-[11px] tabular-nums', over ? 'text-destructive' : warn ? 'text-amber-600' : 'text-muted-foreground')}>
          {count}/{max}
        </span>
      )}
    </div>
  )
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{children}</p>
}

function GroupTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
    </div>
  )
}

export function SEOPanel({
  siteId,
  activePage,
  pages = [],
  site,
  onSavePage,
  onSaveSite,
}: {
  siteId: string
  activePage: WebsitePage | null
  pages?: WebsitePage[]
  site: WebsiteSite
  onSavePage: (data: PageSeoSavePayload) => void
  onSaveSite: (data: SiteSeoSavePayload) => void
}) {
  const [tab, setTab] = useState<'page' | 'site'>('page')
  const [seoTitle, setSeoTitle] = useState(clampSeoTitle(activePage?.seo_title || ''))
  const [seoDesc, setSeoDesc] = useState(clampSeoDescription(activePage?.seo_description || ''))
  const [ogImage, setOgImage] = useState(activePage?.og_image_url || '')
  const [pageSlug, setPageSlug] = useState(activePage?.slug || '')
  const [focusKeyword, setFocusKeyword] = useState(activePage?.focus_keyword || '')
  const [pageKeywords, setPageKeywords] = useState(activePage?.seo_keywords || '')
  const [ogTitle, setOgTitle] = useState(activePage?.og_title || '')
  const [ogDesc, setOgDesc] = useState(activePage?.og_description || '')
  const [canonicalUrl, setCanonicalUrl] = useState(activePage?.canonical_url || '')
  const [noindex, setNoindex] = useState(Boolean(activePage?.noindex))
  const [schemaType, setSchemaType] = useState<PageSchemaType>((activePage?.schema_type as PageSchemaType) || 'auto')
  const [siteTitle, setSiteTitle] = useState(clampSeoTitle((site as { seo_title?: string }).seo_title || ''))
  const [siteDesc, setSiteDesc] = useState(clampSeoDescription((site as { seo_description?: string }).seo_description || ''))
  const [siteKw, setSiteKw] = useState((site as { seo_keywords?: string }).seo_keywords || '')
  const [schemaOrgType, setSchemaOrgType] = useState<SiteSchemaType>((site.schema_org_type as SiteSchemaType) || 'auto')
  const [aiResult, setAiResult] = useState<{
    seo_title: string
    seo_description: string
    focus_keyword: string
  } | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showSocial, setShowSocial] = useState(false)
  const [showSiteAdvanced, setShowSiteAdvanced] = useState(false)
  const aiSEO = useAIGenerateSEO(siteId)
  const uploadMedia = useUploadMedia(siteId)
  const shareImageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSeoTitle(clampSeoTitle(activePage?.seo_title || ''))
    setSeoDesc(clampSeoDescription(activePage?.seo_description || ''))
    setOgImage(activePage?.og_image_url || '')
    setPageSlug(activePage?.slug || '')
    setFocusKeyword(activePage?.focus_keyword || '')
    setPageKeywords(activePage?.seo_keywords || '')
    setOgTitle(activePage?.og_title || '')
    setOgDesc(activePage?.og_description || '')
    setCanonicalUrl(activePage?.canonical_url || '')
    setNoindex(Boolean(activePage?.noindex))
    setSchemaType((activePage?.schema_type as PageSchemaType) || 'auto')
    setAiResult(null)
    setShowSocial(Boolean(activePage?.og_title || activePage?.og_description || activePage?.og_image_url))
  }, [
    activePage?.id,
    activePage?.seo_title,
    activePage?.seo_description,
    activePage?.og_image_url,
    activePage?.slug,
    activePage?.focus_keyword,
    activePage?.seo_keywords,
    activePage?.noindex,
    activePage?.og_title,
    activePage?.og_description,
    activePage?.canonical_url,
    activePage?.schema_type,
  ])

  const siteHost = useMemo(() => {
    const custom = (site as { custom_domain?: string }).custom_domain?.trim()
    if (custom) return custom.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
    const sub = (site as { subdomain?: string }).subdomain?.trim()
    if (sub) return `${sub}.site`
    return `${site.name?.toLowerCase().replace(/\s/g, '') || 'yoursite'}.site`
  }, [site])

  const normalizedSlug = normalizePageSlug(pageSlug)
  const slugConflict =
    activePage && !activePage.is_homepage && pageSlugTaken(normalizedSlug, pages, activePage.id)

  useEffect(() => {
    setSiteTitle(clampSeoTitle((site as { seo_title?: string }).seo_title || ''))
    setSiteDesc(clampSeoDescription((site as { seo_description?: string }).seo_description || ''))
    setSiteKw((site as { seo_keywords?: string }).seo_keywords || '')
    setSchemaOrgType((site.schema_org_type as SiteSchemaType) || 'auto')
  }, [site.id, (site as { seo_title?: string }).seo_title, (site as { seo_description?: string }).seo_description, (site as { seo_keywords?: string }).seo_keywords, site.schema_org_type])

  const handleAIGenerate = async () => {
    if (!activePage) return
    try {
      const r = await aiSEO.mutateAsync({
        page_title: activePage.title,
        page_type: activePage.page_type,
        site_description: (site as { description?: string }).description || site.name,
      })
      setAiResult(r)
      toast.success('SEO generated by AI!')
    } catch {
      toast.error('AI SEO generation failed')
    }
  }

  const applyAI = () => {
    if (!aiResult) return
    setSeoTitle(clampSeoTitle(aiResult.seo_title))
    setSeoDesc(clampSeoDescription(aiResult.seo_description))
    setFocusKeyword(clampFocusKeyword(aiResult.focus_keyword))
    setAiResult(null)
  }

  const handleShareImageUpload = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (JPG, PNG, or WebP)')
      return
    }
    try {
      const saved = await uploadMedia.mutateAsync(file)
      const url = saved.adjusted_url || saved.original_url
      setOgImage(url)
      toast.success('Share image uploaded')
    } catch {
      toast.error('Image upload failed — try a smaller file')
    } finally {
      if (shareImageInputRef.current) shareImageInputRef.current.value = ''
    }
  }

  const pageSeoScore = useMemo(() => {
    if (!activePage) return null
    return computePageSeoScore(activePage, site, {
      seoTitle,
      seoDesc,
      ogImage,
      focusKeyword,
      pageKeywords,
      ogTitle,
      ogDesc,
      noindex,
    })
  }, [activePage, site, seoTitle, seoDesc, ogImage, focusKeyword, pageKeywords, ogTitle, ogDesc, noindex])

  const siteSeoScore = useMemo(
    () => computeSiteSeoScore(site, { siteTitle, siteDesc, siteKw }),
    [site, siteTitle, siteDesc, siteKw],
  )

  const schemaPreview = useMemo(() => {
    if (!activePage) return null
    return describeStructuredData(activePage, site, schemaType, schemaOrgType)
  }, [activePage, site, schemaType, schemaOrgType])

  const siteSchemaPreview = useMemo(
    () => describeStructuredData(null, site, 'auto', schemaOrgType),
    [site, schemaOrgType],
  )

  const pageSchemaHint = PAGE_SCHEMA_OPTIONS.find(o => o.value === schemaType)?.hint
  const siteSchemaHint = SITE_SCHEMA_OPTIONS.find(o => o.value === schemaOrgType)?.hint

  const previewTitle = seoTitle || `${activePage?.title || 'Page'} | ${site.name}`
  const previewUrl = `${siteHost}${activePage?.is_homepage ? '/' : `/${normalizedSlug || activePage?.slug || ''}`}`
  const socialShareTitle = ogTitle.trim() || previewTitle
  const socialShareDesc = ogDesc.trim() || seoDesc || 'Add a share description, or leave blank to reuse the Google summary.'
  const socialShareHost = siteHost.replace(/^www\./i, '')

  const savePage = () => {
    if (!activePage) return
    const payload: PageSeoSavePayload = {
      seo_title: seoTitle,
      seo_description: seoDesc,
      og_image_url: ogImage,
      focus_keyword: focusKeyword,
      seo_keywords: pageKeywords,
      noindex,
      og_title: ogTitle,
      og_description: ogDesc,
      canonical_url: canonicalUrl,
      schema_type: schemaType,
    }
    if (!activePage.is_homepage && normalizedSlug !== activePage.slug) {
      payload.slug = normalizedSlug
    }
    onSavePage(payload)
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-foreground">
            {tab === 'page'
              ? (activePage ? activePage.title : 'Select a page')
              : 'Whole website defaults'}
          </h2>
          <p className="text-xs text-muted-foreground">
            {tab === 'page'
              ? 'Changes go live after you save.'
              : 'Used when a page has no title or summary of its own.'}
          </p>
        </div>
        <div className="flex rounded-lg bg-muted p-0.5">
          {([
            { id: 'page' as const, label: 'This page' },
            { id: 'site' as const, label: 'Whole website' },
          ]).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                tab === t.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'page' && !activePage && (
        <div className="px-6 py-16 text-center text-sm text-muted-foreground">
          Select a page from the list on the left.
        </div>
      )}

      {tab === 'page' && activePage && (
        <>
          <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 sm:p-6">
            {pageSeoScore && (
              <SeoScoreCard
                result={pageSeoScore}
                title="Page score"
                subtitle="Updates as you type — tap to see what to improve"
                defaultOpen={false}
              />
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAIGenerate}
                disabled={aiSEO.isPending}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60',
                  solidButtonFocusClassName,
                )}
              >
                {aiSEO.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Write with AI
              </button>
              <span className="text-[11px] text-muted-foreground">Optional — drafts title, summary & keyword</span>
            </div>

            {aiResult && (
              <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
                <p className="text-xs font-semibold text-primary">AI suggestion</p>
                <p className="mt-1 text-sm font-medium text-foreground">{aiResult.seo_title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{aiResult.seo_description}</p>
                <p className="mt-1 text-xs text-muted-foreground">Keyword: <strong className="text-foreground">{aiResult.focus_keyword}</strong></p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={applyAI} className={cn('rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground', solidButtonFocusClassName)}>
                    Use this
                  </button>
                  <button type="button" onClick={() => setAiResult(null)} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <section>
              <GroupTitle
                title="Google search appearance"
                desc="This is what people see in Google results."
              />
              <div className="space-y-4">
                <div>
                  <FieldLabel count={focusKeyword.length} max={SEO_FOCUS_KEYWORD_MAX}>Focus keyword</FieldLabel>
                  <input
                    value={focusKeyword}
                    onChange={e => setFocusKeyword(clampFocusKeyword(e.target.value))}
                    maxLength={SEO_FOCUS_KEYWORD_MAX}
                    placeholder="e.g. homemade pickles online"
                    className={fieldClass}
                  />
                  <Hint>Main phrase this page should rank for. Not shown to visitors.</Hint>
                </div>
                <div>
                  <FieldLabel count={seoTitle.length} max={SEO_TITLE_MAX} warnAt={50}>Page title</FieldLabel>
                  <input
                    value={seoTitle}
                    onChange={e => setSeoTitle(clampSeoTitle(e.target.value))}
                    maxLength={SEO_TITLE_MAX}
                    placeholder={`e.g. ${activePage.title} | ${site.name}`}
                    className={fieldClass}
                  />
                  <Hint>Aim for under 60 characters so Google doesn’t cut it off.</Hint>
                </div>
                <div>
                  <FieldLabel count={seoDesc.length} max={SEO_DESCRIPTION_MAX} warnAt={140}>Meta description</FieldLabel>
                  <textarea
                    value={seoDesc}
                    onChange={e => setSeoDesc(clampSeoDescription(e.target.value))}
                    maxLength={SEO_DESCRIPTION_MAX}
                    placeholder="e.g. Shop handmade achaar & spice mixes. Fresh batches weekly. Free delivery over ₹499."
                    rows={3}
                    className={cn(fieldClass, 'resize-none')}
                  />
                  <Hint>1–2 sentences (~150 characters) explaining why someone should click.</Hint>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Live Google preview
                </p>
                <div className="break-words text-[17px] font-medium leading-snug text-[#1a0dab] dark:text-info">
                  {previewTitle}
                </div>
                <div className="mt-0.5 truncate text-xs text-[#006621] dark:text-success">{previewUrl}</div>
                <div className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {seoDesc || 'Add a meta description so Google can show a helpful snippet here.'}
                </div>
              </div>
            </section>

            <section className="border-t border-border pt-6">
              <GroupTitle title="Page address" desc="The web link for this page." />
              {activePage.is_homepage ? (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm">
                  <span className="font-medium text-foreground">{siteHost}/</span>
                  <span className="ml-2 text-xs text-muted-foreground">Homepage always uses the root URL</span>
                </div>
              ) : (
                <>
                  <div className="flex overflow-hidden rounded-lg border border-input focus-within:ring-2 focus-within:ring-ring">
                    <span className="shrink-0 border-r border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      {siteHost}/
                    </span>
                    <input
                      value={pageSlug}
                      onChange={e => setPageSlug(e.target.value)}
                      onBlur={() => setPageSlug(normalizePageSlug(pageSlug))}
                      placeholder="about-us"
                      className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none"
                      aria-invalid={slugConflict}
                    />
                  </div>
                  {slugConflict && (
                    <p className="mt-1 text-xs text-destructive">This address is already used by another page.</p>
                  )}
                  <Hint>Lowercase letters, numbers, and hyphens only.</Hint>
                </>
              )}
            </section>

            <section className="border-t border-border pt-6">
              <button
                type="button"
                onClick={() => setShowSocial(v => !v)}
                className="mb-3 flex w-full items-center justify-between text-left"
              >
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Social share (optional)</h3>
                  <p className="text-xs text-muted-foreground">WhatsApp, Facebook, LinkedIn — leave blank to reuse Google text</p>
                </div>
                {showSocial ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {showSocial && (
                <div className="space-y-4">
                  <div>
                    <FieldLabel count={ogTitle.length} max={SEO_TITLE_MAX}>Share title</FieldLabel>
                    <input
                      value={ogTitle}
                      onChange={e => setOgTitle(clampSeoTitle(e.target.value))}
                      maxLength={SEO_TITLE_MAX}
                      placeholder={seoTitle || `e.g. ${activePage.title} — ${site.name}`}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <FieldLabel count={ogDesc.length} max={SEO_DESCRIPTION_MAX}>Share description</FieldLabel>
                    <textarea
                      value={ogDesc}
                      onChange={e => setOgDesc(clampSeoDescription(e.target.value))}
                      maxLength={SEO_DESCRIPTION_MAX}
                      placeholder={seoDesc || 'e.g. Handmade achaar & spice mixes — order online today.'}
                      rows={2}
                      className={cn(fieldClass, 'resize-none')}
                    />
                  </div>
                  <div>
                    <FieldLabel>Share image</FieldLabel>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                      <input
                        value={ogImage}
                        onChange={e => setOgImage(e.target.value)}
                        placeholder="Paste a link, or upload below"
                        className={cn(fieldClass, 'sm:flex-1')}
                      />
                      <input
                        ref={shareImageInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={e => void handleShareImageUpload(e.target.files)}
                      />
                      <button
                        type="button"
                        disabled={uploadMedia.isPending}
                        onClick={() => shareImageInputRef.current?.click()}
                        className={cn(
                          'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-60',
                          solidButtonFocusClassName,
                        )}
                      >
                        {uploadMedia.isPending
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <ImagePlus className="h-3.5 w-3.5" />}
                        {uploadMedia.isPending ? 'Uploading…' : 'Upload image'}
                      </button>
                    </div>
                    <Hint>Upload from your computer, or paste an image link. Wide images (~1200×630) look best when shared.</Hint>
                    {ogImage && (
                      <button
                        type="button"
                        onClick={() => setOgImage('')}
                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                        Remove image
                      </button>
                    )}
                  </div>

                  <div className="max-w-sm overflow-hidden rounded-lg border border-border bg-muted/20">
                    <p className="border-b border-border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Live social preview
                    </p>
                    <div className="bg-[#f0f2f5] dark:bg-muted/40">
                      {ogImage ? (
                        <img
                          src={mediaUrl(ogImage)}
                          alt=""
                          className="h-28 w-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <div className="flex h-20 w-full items-center justify-center bg-muted text-[11px] text-muted-foreground">
                          No share image yet
                        </div>
                      )}
                      <div className="space-y-0.5 border-t border-black/5 bg-card px-2.5 py-2 dark:border-border">
                        <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {socialShareHost}
                        </p>
                        <p className="line-clamp-1 text-xs font-semibold leading-snug text-foreground">
                          {socialShareTitle}
                        </p>
                        <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                          {socialShareDesc}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(v => !v)}
                className="flex w-full items-center justify-between py-1 text-left"
              >
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Advanced</h3>
                  <p className="text-xs text-muted-foreground">Keywords, hide from Google, canonical URL, rich results</p>
                </div>
                {showAdvanced ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {showAdvanced && (
                <div className="mt-4 space-y-4">
                  <div>
                    <FieldLabel count={pageKeywords.length} max={SEO_KEYWORDS_MAX}>Extra keywords</FieldLabel>
                    <input
                      value={pageKeywords}
                      onChange={e => setPageKeywords(clampSeoKeywords(e.target.value))}
                      maxLength={SEO_KEYWORDS_MAX}
                      placeholder="e.g. mango pickle, garlic achaar, spice mix"
                      className={fieldClass}
                    />
                    <Hint>Optional related words, separated by commas. Only needed if this page should use different keywords than the whole website.</Hint>
                  </div>
                  <div>
                    <FieldLabel count={canonicalUrl.length} max={SEO_CANONICAL_MAX}>Canonical URL</FieldLabel>
                    <input
                      value={canonicalUrl}
                      onChange={e => setCanonicalUrl(clampCanonicalUrl(e.target.value))}
                      maxLength={SEO_CANONICAL_MAX}
                      placeholder={`https://${siteHost}${activePage.is_homepage ? '/' : `/${normalizedSlug || activePage.slug}`}`}
                      className={fieldClass}
                    />
                    <Hint>Leave blank in most cases. Fill this only if the same content exists on more than one web address and you want Google to prefer this one.</Hint>
                  </div>
                  <div>
                    <FieldLabel>Page type for Google</FieldLabel>
                    <Select
                      value={schemaType}
                      onChange={v => setSchemaType(v as PageSchemaType)}
                      options={PAGE_SCHEMA_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                      aria-label="Page schema type"
                      className={fieldClass}
                    />
                    <Hint>
                      Helps Google show richer results (product, FAQ, article, etc.). Auto is fine for most pages.
                      {pageSchemaHint ? ` ${pageSchemaHint}` : ''}
                    </Hint>
                  </div>
                  {schemaPreview && (
                    <div className="rounded-lg bg-muted/40 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Google may also use</p>
                      <p className="mt-1 text-xs text-foreground">{schemaPreview.types.join(' · ')}</p>
                    </div>
                  )}
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5">
                    <Checkbox checked={noindex} onCheckedChange={setNoindex} className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-medium text-foreground">Hide this page from Google</span>
                      <span className="block text-[11px] text-muted-foreground">
                        The page stays online for anyone with the link, but it won’t appear in Google search. Useful for thank-you or private pages.
                      </span>
                    </span>
                  </label>
                </div>
              )}
            </section>

          </div>

          <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-6">
            <p className="hidden text-xs text-muted-foreground sm:block">
              {slugConflict ? 'Fix the page address before saving.' : 'Remember to save your changes.'}
            </p>
            <button
              type="button"
              disabled={slugConflict}
              onClick={savePage}
              className={cn(
                'ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60',
                solidButtonFocusClassName,
              )}
            >
              <Save className="h-4 w-4" />
              Save
            </button>
          </div>
        </>
      )}

      {tab === 'site' && (
        <>
          <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 sm:p-6">
            <SeoScoreCard
              result={siteSeoScore}
              title="Website score"
              subtitle="Based on your defaults — tap to see details"
              defaultOpen={false}
            />

            <section>
              <GroupTitle
                title="Default search text"
                desc="Fallback title and summary for pages that don’t have their own."
              />
              <div className="space-y-4">
                <div>
                  <FieldLabel count={siteTitle.length} max={SEO_TITLE_MAX} warnAt={50}>Default title</FieldLabel>
                  <input
                    value={siteTitle}
                    onChange={e => setSiteTitle(clampSeoTitle(e.target.value))}
                    maxLength={SEO_TITLE_MAX}
                    placeholder={`e.g. ${site.name} — Quality products & services`}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <FieldLabel count={siteDesc.length} max={SEO_DESCRIPTION_MAX} warnAt={140}>Default summary</FieldLabel>
                  <textarea
                    value={siteDesc}
                    onChange={e => setSiteDesc(clampSeoDescription(e.target.value))}
                    maxLength={SEO_DESCRIPTION_MAX}
                    placeholder="e.g. Family-run bakery since 1998. Order cakes online or visit our shop on MG Road."
                    rows={3}
                    className={cn(fieldClass, 'resize-none')}
                  />
                </div>
                <div>
                  <FieldLabel>Website keywords (optional)</FieldLabel>
                  <input
                    value={siteKw}
                    onChange={e => setSiteKw(e.target.value)}
                    placeholder="e.g. bakery, birthday cakes, custom cakes Pune"
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Live Google preview
                </p>
                <div className="break-words text-[17px] font-medium leading-snug text-[#1a0dab] dark:text-info">
                  {siteTitle || site.name}
                </div>
                <div className="mt-0.5 truncate text-xs text-[#006621] dark:text-success">{siteHost}</div>
                <div className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {siteDesc || 'Add a default summary for pages without their own text.'}
                </div>
              </div>
            </section>

            <section className="border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setShowSiteAdvanced(v => !v)}
                className="flex w-full items-center justify-between py-1 text-left"
              >
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Advanced — business type</h3>
                  <p className="text-xs text-muted-foreground">Auto is fine for most businesses</p>
                </div>
                {showSiteAdvanced ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {showSiteAdvanced && (
                <div className="mt-4 space-y-3">
                  <div>
                    <FieldLabel>Business type</FieldLabel>
                    <Select
                      value={schemaOrgType}
                      onChange={v => setSchemaOrgType(v as SiteSchemaType)}
                      options={SITE_SCHEMA_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                      aria-label="Site schema type"
                      className={fieldClass}
                    />
                    {siteSchemaHint && <Hint>{siteSchemaHint}</Hint>}
                  </div>
                  <div className="rounded-lg bg-muted/40 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">On every page Google also gets</p>
                    <p className="mt-1 text-xs text-foreground">{siteSchemaPreview.types.join(' · ')}</p>
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="sticky bottom-0 flex justify-end border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-6">
            <button
              type="button"
              onClick={() => onSaveSite({ seo_title: siteTitle, seo_description: siteDesc, seo_keywords: siteKw, schema_org_type: schemaOrgType })}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90',
                solidButtonFocusClassName,
              )}
            >
              <Save className="h-4 w-4" />
              Save
            </button>
          </div>
        </>
      )}
    </div>
  )
}
