import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronRight, ExternalLink, Globe, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { SEOPanel } from '@/components/websites/SEOPanel'
import { useSite, useSiteList } from '@/hooks/useWebsites'
import { websiteApi } from '@/api/websites'
import type { WebsitePage, WebsiteSite } from '@/types/websites'

const seoSelectClass =
  'w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60'

export default function SEOManagementPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: sites = [], isLoading: sitesLoading } = useSiteList()

  const siteIdParam = searchParams.get('siteId')?.trim() || ''
  const pageIdParam = searchParams.get('pageId')?.trim() || ''

  const [selectedSiteId, setSelectedSiteId] = useState(siteIdParam)
  const { data: site, isLoading: siteLoading } = useSite(selectedSiteId || null)

  const pages = useMemo(() => {
    const list = site?.pages ?? []
    return [...list].sort((a, b) => {
      if (a.is_homepage !== b.is_homepage) return a.is_homepage ? -1 : 1
      return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    })
  }, [site?.pages])

  const [selectedPageId, setSelectedPageId] = useState(pageIdParam)

  useEffect(() => {
    if (!sites.length) return
    if (siteIdParam && sites.some(s => s.id === siteIdParam)) {
      setSelectedSiteId(siteIdParam)
      return
    }
    if (!selectedSiteId) {
      setSelectedSiteId(sites[0].id)
    }
  }, [sites, siteIdParam, selectedSiteId])

  useEffect(() => {
    if (!pages.length) {
      setSelectedPageId('')
      return
    }
    if (pageIdParam && pages.some(p => p.id === pageIdParam)) {
      setSelectedPageId(pageIdParam)
      return
    }
    if (!selectedPageId || !pages.some(p => p.id === selectedPageId)) {
      setSelectedPageId(pages.find(p => p.is_homepage)?.id ?? pages[0].id)
    }
  }, [pages, pageIdParam, selectedPageId])

  useEffect(() => {
    const next = new URLSearchParams()
    if (selectedSiteId) next.set('siteId', selectedSiteId)
    if (selectedPageId) next.set('pageId', selectedPageId)
    setSearchParams(next, { replace: true })
  }, [selectedSiteId, selectedPageId, setSearchParams])

  const activePage = pages.find(p => p.id === selectedPageId) ?? null

  const patchPageInCache = (pageId: string, data: Record<string, string>, updated?: WebsitePage) => {
    queryClient.setQueryData<WebsiteSite>(['websites', selectedSiteId], old => {
      if (!old) return old
      return {
        ...old,
        pages: old.pages.map(p => (p.id === pageId ? { ...p, ...data, ...updated } : p)),
      }
    })
  }

  const patchSiteInCache = (data: Record<string, string>, updated?: WebsiteSite) => {
    queryClient.setQueryData<WebsiteSite>(['websites', selectedSiteId], old =>
      old ? { ...old, ...data, ...updated } : old,
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/websites" className="transition-colors hover:text-foreground">Website Management</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-foreground">SEO Management</span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Search className="h-6 w-6 text-primary" />
          SEO Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Tune how your pages appear in Google and on social media. Set defaults for the whole site or refine each page.
        </p>
      </div>

      {sitesLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading websites…
        </div>
      ) : sites.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
          <Globe className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">No websites yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Create a site in Business Website Builder first, then return here to manage SEO.</p>
          <Button asChild className="mt-4" size="sm">
            <Link to="/websites">Go to Business Website Builder</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Website</label>
              <Select
                value={selectedSiteId}
                onChange={(v) => {
                  setSelectedSiteId(v)
                  setSelectedPageId('')
                }}
                options={sites.map(s => ({ value: s.id, label: s.name }))}
                aria-label="Website"
                className={seoSelectClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Page</label>
              <Select
                value={selectedPageId}
                onChange={setSelectedPageId}
                options={pages.map(p => ({
                  value: p.id,
                  label: `${p.is_homepage ? '🏠 ' : ''}${p.title}${p.slug ? ` (/${p.slug})` : ''}`,
                }))}
                disabled={!pages.length || siteLoading}
                aria-label="Page"
                className={seoSelectClass}
              />
            </div>
          </div>

          {selectedSiteId && (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to={`/websites/${selectedSiteId}`}>
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open in Business Website Builder
                </Link>
              </Button>
              {activePage && (
                <span className="text-xs text-muted-foreground">
                  Editing SEO for <span className="font-medium text-foreground">{activePage.title}</span>
                </span>
              )}
            </div>
          )}

          {siteLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading site…
            </div>
          ) : site && selectedSiteId ? (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
              <SEOPanel
                siteId={selectedSiteId}
                activePage={activePage}
                site={site}
                onSavePage={(data) => {
                  if (!activePage) return
                  websiteApi.updatePage(selectedSiteId, activePage.id, data as never)
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
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
