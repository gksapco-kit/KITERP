import { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Sparkles, Search, Globe, ChevronRight, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSiteList, useWebsiteTemplates } from '@/hooks/useWebsites'
import type { WebsiteTemplate } from '@/types/websites'
import { getTemplatePreviewPalette } from '@/lib/templateBlockHighlights'
import { WebsiteTemplatePreviewModal, getStorefrontTemplateBrowserPreviewUrl } from '@/components/websites/WebsiteTemplatePreviewModal'
import { openDraftPreviewInBrowser, wrapStorefrontPreviewForVendorBrowser } from '@/lib/storefrontPreviewUrl'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function WebsiteTemplateGalleryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: sites = [], isLoading: sitesLoading } = useSiteList()
  const { data: templates = [], isLoading: templatesLoading } = useWebsiteTemplates()

  const [templateSearch, setTemplateSearch] = useState('')
  const [templateCategory, setTemplateCategory] = useState<string>('all')
  const [applyTemplate, setApplyTemplate] = useState<WebsiteTemplate | null>(null)

  const siteParam = searchParams.get('site')
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)

  useEffect(() => {
    if (sitesLoading || sites.length === 0) return
    const firstId = sites[0].id
    if (siteParam && sites.some(s => s.id === siteParam)) {
      setSelectedSiteId(siteParam)
    } else {
      setSelectedSiteId(firstId)
      if (siteParam !== firstId) {
        setSearchParams({ site: firstId }, { replace: true })
      }
    }
  }, [sitesLoading, sites, siteParam, setSearchParams])

  const onSiteChange = (id: string) => {
    setSelectedSiteId(id)
    setSearchParams(id ? { site: id } : {}, { replace: true })
  }

  const categories = useMemo(() => {
    const c = new Set<string>()
    for (const t of templates) {
      if (t.category) c.add(t.category)
    }
    return ['all', ...Array.from(c).sort((a, b) => a.localeCompare(b))]
  }, [templates])

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase()
    return templates
      .filter(t => (templateCategory === 'all' ? true : t.category === templateCategory))
      .filter(t => {
        if (!q) return true
        const hay = `${t.name || ''} ${t.description || ''}`.toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [templates, templateSearch, templateCategory])

  const selectedSite = sites.find(s => s.id === selectedSiteId) ?? null
  const busy = sitesLoading || templatesLoading

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-accent/70 to-gray-50/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 text-primary font-extrabold text-sm mb-1">
              <Sparkles className="w-4 h-4" />
              Configuration
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Website Templates</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-xl">
            Browse full-site layouts, preview pages and live ERP blocks, then apply to one of your sites. You can also open templates from the builder’s <b>Templates</b> tab.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <Link
                to="/websites"
                className="inline-flex items-center gap-1 text-primary font-semibold hover:underline"
              >
                <Globe className="w-4 h-4" />
                All sites
                <ChevronRight className="w-4 h-4 opacity-60" />
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm p-4 sm:p-5 mb-6 max-h-[90vh] overflow-y-auto">
          <label className="block text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-2">Apply template to</label>
          {sitesLoading && <p className="text-sm text-gray-500">Loading sites…</p>}
          {!sitesLoading && sites.length === 0 && (
            <p className="text-sm text-gray-600">
              You don’t have a website yet.{' '}
              <Link to="/websites" className="text-primary font-semibold hover:underline">Create a site</Link>
              , then return here to apply a template.
            </p>
          )}
          {!sitesLoading && sites.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <select
                className="w-full sm:max-w-md border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedSiteId || ''}
                onChange={e => onSiteChange(e.target.value)}
              >
                {sites.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.is_published ? '· live' : '· draft'}
                  </option>
                ))}
              </select>
              {selectedSiteId && (
                <Button variant="outline" className="shrink-0" asChild>
                  <Link to={`/websites/${selectedSiteId}`}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in builder
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={templateSearch}
              onChange={e => setTemplateSearch(e.target.value)}
              placeholder="Search templates…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setTemplateCategory(cat)}
                className={cn(
                  'text-xs px-2 py-1 rounded-full font-extrabold transition-colors',
                  templateCategory === cat
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>

        {busy && <p className="text-sm text-gray-500 py-8">Loading templates…</p>}
        {!busy && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredTemplates.map((tpl: WebsiteTemplate) => {
              const pageCount = tpl.page_count ?? tpl.pages?.length ?? 0
              const tier = tpl.tier || (pageCount >= 6 ? 'full' : 'lite')
              const palette = getTemplatePreviewPalette(tpl)
              return (
                <div
                  key={tpl.id}
                  className={cn(
                    'text-left border border-gray-100 rounded-2xl overflow-hidden hover:border-primary/30 transition-colors group bg-white',
                    'shadow-[0_1px_0_rgba(0,0,0,0.02)] hover:shadow-[0_8px_24px_rgba(100,195,160,0.15)]',
                  )}
                >
                  <div className="relative">
                    {tpl.thumbnail ? (
                      <img src={tpl.thumbnail} className="w-full h-36 sm:h-40 object-cover" alt={tpl.name} loading="lazy" />
                    ) : (
                      <div className="w-full h-36 sm:h-40 bg-gradient-to-r from-accent to-primary/20" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent pointer-events-none" />
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wide',
                          tier === 'full' ? 'bg-accent text-primary' : 'bg-white/80 text-gray-700',
                        )}>
                          {tier === 'full' ? 'Full site' : 'Lite'}
                        </span>
                        {tpl.id.startsWith('storefront_') && (
                          <span className="text-xs bg-primary/90 text-white rounded-full px-2 py-0.5 font-semibold">
                            Storefront
                          </span>
                        )}
                        {(tpl.id === 'atelier' || tpl.id === 'verde' || tpl.id === 'solace') && (
                          <span className="text-xs bg-amber-600/90 text-white rounded-full px-2 py-0.5 font-semibold">
                            Editorial
                          </span>
                        )}
                        <span className="text-xs bg-white/80 text-gray-700 rounded-full px-2 py-0.5 font-semibold">
                          {pageCount} pg
                        </span>
                      </div>
                      <span className="inline-flex -space-x-1">
                        {palette.slice(0, 5).map((c, i) => (
                          <span key={`${c}-${i}`} className="w-3.5 h-3.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: c }} />
                        ))}
                      </span>
                    </div>
                  </div>
                  <div className="p-3.5">
                    <div className="font-extrabold text-gray-900 group-hover:text-primary transition-colors">{tpl.name}</div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{tpl.description}</p>
                    <div className="flex items-center justify-end gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          openDraftPreviewInBrowser(
                            wrapStorefrontPreviewForVendorBrowser(getStorefrontTemplateBrowserPreviewUrl(tpl.id)),
                          )
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        disabled={!selectedSiteId}
                        onClick={() => {
                          if (!selectedSiteId) {
                            toast.error('Choose a site first.')
                            return
                          }
                          setApplyTemplate(tpl)
                        }}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors',
                          selectedSiteId
                            ? 'bg-primary text-white hover:opacity-90'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed',
                        )}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!busy && filteredTemplates.length === 0 && (
          <p className="text-sm text-gray-500 py-8">No templates match your filters.</p>
        )}
      </div>

      <WebsiteTemplatePreviewModal
        template={applyTemplate}
        siteId={selectedSiteId}
        siteLabel={selectedSite?.name}
        initialApplyArmed
        onClose={() => setApplyTemplate(null)}
        zIndexClass="z-[300]"
      />
    </div>
  )
}
