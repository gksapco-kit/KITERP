import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronRight, ExternalLink, Globe, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SEOPanel } from '@/components/websites/SEOPanel'
import { useSite, useSiteList } from '@/hooks/useWebsites'
import { websiteApi } from '@/api/websites'
import type { WebsitePage, WebsiteSite } from '@/types/websites'

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
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Link to="/business-front" className="hover:text-gray-600">Website Management</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-gray-600 font-medium">SEO Management</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Search className="h-6 w-6 text-primary" />
          SEO Management
        </h1>
        <p className="text-sm text-gray-500">
          Tune how your pages appear in Google and on social media. Set defaults for the whole site or refine each page.
        </p>
      </div>

      {sitesLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading websites…
        </div>
      ) : sites.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
          <Globe className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-700">No websites yet</p>
          <p className="mt-1 text-xs text-gray-500">Create a site in Website Builder first, then return here to manage SEO.</p>
          <Button asChild className="mt-4" size="sm">
            <Link to="/websites">Go to Website Builder</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Website</label>
              <select
                value={selectedSiteId}
                onChange={e => {
                  setSelectedSiteId(e.target.value)
                  setSelectedPageId('')
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Page</label>
              <select
                value={selectedPageId}
                onChange={e => setSelectedPageId(e.target.value)}
                disabled={!pages.length || siteLoading}
                className={cn(
                  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
                  (!pages.length || siteLoading) && 'opacity-60',
                )}
              >
                {pages.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.is_homepage ? '🏠 ' : ''}{p.title}{p.slug ? ` (/${p.slug})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedSiteId && (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to={`/websites/${selectedSiteId}`}>
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open in Website Builder
                </Link>
              </Button>
              {activePage && (
                <span className="text-xs text-gray-400">
                  Editing SEO for <span className="font-medium text-gray-600">{activePage.title}</span>
                </span>
              )}
            </div>
          )}

          {siteLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-500 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading site…
            </div>
          ) : site && selectedSiteId ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
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
