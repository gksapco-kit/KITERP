import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronRight, ExternalLink, Globe, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { SEOPanel } from '@/components/websites/SEOPanel'
import { SeoScoreBadge } from '@/components/websites/SeoScoreCard'
import { useSite, useSiteList } from '@/hooks/useWebsites'
import { websiteApi } from '@/api/websites'
import {
  computePageSeoScoreFromSaved,
  computeSiteAveragePageScore,
  seoScoreLabelText,
} from '@/lib/seoScore'
import type { WebsitePage, WebsiteSite } from '@/types/websites'

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

const seoSelectClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60'

function defaultPageId(pages: WebsitePage[]): string {
  return pages.find(p => p.is_homepage)?.id ?? pages[0]?.id ?? ''
}

export default function SEOManagementPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: sites = [], isLoading: sitesLoading } = useSiteList()

  const siteIdParam = searchParams.get('siteId')?.trim() || ''
  const pageIdParam = searchParams.get('pageId')?.trim() || ''

  const selectedSiteId = useMemo(() => {
    if (!sites.length) return ''
    if (siteIdParam && sites.some(s => s.id === siteIdParam)) return siteIdParam
    return sites[0].id
  }, [sites, siteIdParam])

  const { data: site, isLoading: siteLoading } = useSite(selectedSiteId || null)

  const pages = useMemo(() => {
    const list = site?.pages ?? []
    return [...list].sort((a, b) => {
      if (a.is_homepage !== b.is_homepage) return a.is_homepage ? -1 : 1
      return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    })
  }, [site?.pages])

  const selectedPageId = useMemo(() => {
    if (!pages.length) return ''
    if (pageIdParam && pages.some(p => p.id === pageIdParam)) return pageIdParam
    return defaultPageId(pages)
  }, [pages, pageIdParam])

  useEffect(() => {
    if (sitesLoading || !sites.length) return

    setSearchParams(prev => {
      const currentSiteId = prev.get('siteId')?.trim() || ''
      const currentPageId = prev.get('pageId')?.trim() || ''

      const validSite = currentSiteId && sites.some(s => s.id === currentSiteId)
      const nextSiteId = validSite ? currentSiteId : sites[0].id

      if (siteLoading || !pages.length) {
        if (validSite) return prev
        const next = new URLSearchParams(prev)
        next.set('siteId', nextSiteId)
        next.delete('pageId')
        return next
      }

      const validPage = currentPageId && pages.some(p => p.id === currentPageId)
      const nextPageId = validPage ? currentPageId : defaultPageId(pages)

      if (nextSiteId === currentSiteId && nextPageId === currentPageId) return prev

      const next = new URLSearchParams(prev)
      next.set('siteId', nextSiteId)
      if (nextPageId) next.set('pageId', nextPageId)
      else next.delete('pageId')
      return next
    }, { replace: true })
  }, [sites, sitesLoading, siteLoading, pages, setSearchParams])

  const updateSiteSelection = (siteId: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('siteId', siteId)
      next.delete('pageId')
      return next
    }, { replace: true })
  }

  const updatePageSelection = (pageId: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      const siteId = prev.get('siteId')?.trim() || selectedSiteId
      if (siteId) next.set('siteId', siteId)
      if (pageId) next.set('pageId', pageId)
      else next.delete('pageId')
      return next
    }, { replace: true })
  }

  const activePage = pages.find(p => p.id === selectedPageId) ?? null

  const siteAverageScore = useMemo(() => {
    if (!site || !pages.length) return 0
    return computeSiteAveragePageScore(pages, site)
  }, [site, pages])

  const patchPageInCache = (pageId: string, data: PageSeoSavePayload, updated?: WebsitePage) => {
    queryClient.setQueryData<WebsiteSite>(['websites', selectedSiteId], old => {
      if (!old) return old
      return {
        ...old,
        pages: old.pages.map(p => (p.id === pageId ? { ...p, ...data, ...updated } : p)),
      }
    })
  }

  const patchSiteInCache = (data: Record<string, string | boolean | undefined>, updated?: WebsiteSite) => {
    queryClient.setQueryData<WebsiteSite>(['websites', selectedSiteId], old =>
      old ? { ...old, ...data, ...updated } : old,
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 p-4 sm:p-6 lg:px-8 lg:py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link to="/websites" className="hover:text-foreground">Website Management</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">SEO</span>
          </div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Search className="h-6 w-6 text-primary" />
            SEO Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edit how your pages look in Google and when shared on social media.
          </p>
        </div>
        {selectedSiteId && (
          <Button asChild variant="outline" size="sm" className="shrink-0 self-start sm:self-center">
            <Link to={`/websites/${selectedSiteId}`}>
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Website Builder
            </Link>
          </Button>
        )}
      </div>

      {sitesLoading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading websites…
        </div>
      ) : sites.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
          <Globe className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">No websites yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Create a site in Business Website Builder first, then manage SEO here.
          </p>
          <Button asChild className="mt-4" size="sm">
            <Link to="/websites">Go to Website Builder</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="grid lg:grid-cols-[260px_minmax(0,1fr)]">
            {/* Page list */}
            <aside className="border-b border-border bg-muted/20 lg:border-b-0 lg:border-r">
              <div className="space-y-3 border-b border-border p-4">
                <label className="text-xs font-semibold text-foreground">Website</label>
                <Select
                  value={selectedSiteId}
                  onChange={updateSiteSelection}
                  options={sites.map(s => ({ value: s.id, label: s.name }))}
                  aria-label="Website"
                  className={seoSelectClass}
                />
                {site && !siteLoading && pages.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Avg score <span className="font-semibold text-foreground">{siteAverageScore}/100</span>
                  </p>
                )}
              </div>

              <div className="px-3 py-2">
                <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Pages
                </p>
                {siteLoading ? (
                  <div className="flex items-center gap-2 px-2 py-8 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                  </div>
                ) : pages.length === 0 ? (
                  <p className="px-2 py-6 text-xs text-muted-foreground">No pages yet.</p>
                ) : (
                  <div className="max-h-[min(32rem,60vh)] space-y-0.5 overflow-y-auto pb-3">
                    {pages.map(p => {
                      const result = site ? computePageSeoScoreFromSaved(p, site) : null
                      const selected = p.id === selectedPageId
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => updatePageSelection(p.id)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                            selected
                              ? 'bg-primary text-primary-foreground'
                              : 'text-foreground hover:bg-muted/70',
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {p.is_homepage ? 'Home' : p.title}
                            </div>
                            <div className={cn(
                              'truncate text-[10px]',
                              selected ? 'text-primary-foreground/75' : 'text-muted-foreground',
                            )}
                            >
                              {p.noindex
                                ? 'Hidden'
                                : result
                                  ? seoScoreLabelText(result.label)
                                  : '—'}
                            </div>
                          </div>
                          {result && (
                            <span className={cn(selected && '[&_span]:bg-primary-foreground/20 [&_span]:text-primary-foreground')}>
                              <SeoScoreBadge score={result.score} noindex={p.noindex} />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </aside>

            {/* Editor */}
            <main className="min-w-0 bg-card">
              {siteLoading && !site ? (
                <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading…
                </div>
              ) : site && selectedSiteId ? (
                <SEOPanel
                  siteId={selectedSiteId}
                  activePage={activePage}
                  pages={pages}
                  site={site}
                  onSavePage={(data: PageSeoSavePayload) => {
                    if (!activePage) return
                    websiteApi.updatePage(selectedSiteId, activePage.id, data)
                      .then(updated => {
                        patchPageInCache(activePage.id, data, updated)
                        toast.success('SEO settings saved!')
                      })
                      .catch(() => toast.error('Save failed'))
                  }}
                  onSaveSite={(data) => {
                    websiteApi.updateSite(selectedSiteId, data as never)
                      .then(updated => {
                        patchSiteInCache(data, updated)
                        toast.success('Site SEO settings saved!')
                      })
                      .catch(() => toast.error('Save failed'))
                  }}
                />
              ) : null}
            </main>
          </div>
        </div>
      )}
    </div>
  )
}
