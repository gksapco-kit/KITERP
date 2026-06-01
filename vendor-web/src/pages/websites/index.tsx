import { useState, useEffect } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import {
  Globe, Plus, ExternalLink, Edit3, Trash2, Eye, EyeOff,
  MoreVertical, Loader2, Layout, FileText, Calendar,
  CheckCircle2, AlertCircle, Sparkles, Rocket, Copy, Check,
  Globe2, Link2,
  Pencil,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSiteList, useCreateSite, useDeleteSite, usePublishSite, useUnpublishSite, useUpdateSite } from '@/hooks/useWebsites'
import { websiteApi } from '@/api/websites'
import type { SiteListItem } from '@/types/websites'
import { cn } from '@/lib/utils'
import { extractApiError } from '@/lib/errorMessages'
import { shouldUseLocalStorefrontUrls } from '@/lib/storefrontPreviewUrl'
import { format } from 'date-fns'

const BUSINESS_PRESETS = [
  {
    id: 'retail',
    label: 'Retail Store',
    icon: '🛍️',
    desc: 'Products, offers, reviews, cart, checkout',
    niche: 'retail ecommerce',
    defaultName: 'My Retail Store',
    sells: 'products',
    prompt: 'Create a polished online retail store with product showcase, offer banner, featured categories, customer reviews, payment methods, FAQ, contact details, cart and checkout sections.',
  },
  {
    id: 'services',
    label: 'Service Business',
    icon: '🧰',
    desc: 'Services, quotes, bookings, leads',
    niche: 'local service business',
    defaultName: 'My Service Business',
    sells: 'services',
    prompt: 'Create a service business website with a strong hero, service cards, instant quote request, booking section, testimonials, process steps, FAQ, contact form and location information.',
  },
  {
    id: 'restaurant',
    label: 'Restaurant / Cafe',
    icon: '🍽️',
    desc: 'Menu, location, booking, offers',
    niche: 'restaurant cafe food business',
    defaultName: 'My Restaurant',
    sells: 'both',
    prompt: 'Create a restaurant or cafe website with menu sections, gallery, offers, booking widget, opening hours, reviews, location map, newsletter and contact details.',
  },
  {
    id: 'fashion',
    label: 'Fashion / Boutique',
    icon: '👗',
    desc: 'Collections, lookbook, offers',
    niche: 'fashion boutique ecommerce',
    defaultName: 'My Boutique',
    sells: 'products',
    prompt: 'Create a premium fashion boutique website with hero collection, featured products, lookbook gallery, trust badges, reviews, recently viewed products, payment methods and newsletter signup.',
  },
  {
    id: 'electronics',
    label: 'Electronics Store',
    icon: '💻',
    desc: 'Catalog, warranty, stock, filters',
    niche: 'electronics ecommerce',
    defaultName: 'Electronics Store',
    sells: 'products',
    prompt: 'Create an electronics store website with product grid, live stock, filters, warranty highlights, offers, reviews, payment methods, FAQ, cart and checkout sections.',
  },
  {
    id: 'salon',
    label: 'Salon / Spa',
    icon: '💇',
    desc: 'Treatments, staff, booking',
    niche: 'salon spa beauty services',
    defaultName: 'My Salon',
    sells: 'services',
    prompt: 'Create a beauty salon or spa website with premium hero, services, pricing, staff/team, booking widget, testimonials, gallery, FAQ, location and contact form.',
  },
  {
    id: 'clinic',
    label: 'Clinic / Healthcare',
    icon: '🩺',
    desc: 'Trust, appointments, services',
    niche: 'clinic healthcare appointments',
    defaultName: 'My Clinic',
    sells: 'services',
    prompt: 'Create a trustworthy clinic website with services, doctor/team section, appointment booking, patient testimonials, FAQs, location map, contact form and clear call-to-action.',
  },
  {
    id: 'consulting',
    label: 'Consultant / Agency',
    icon: '📈',
    desc: 'Leads, portfolio, case studies',
    niche: 'consulting agency professional services',
    defaultName: 'My Agency',
    sells: 'services',
    prompt: 'Create a professional consultant or agency website with hero, service packages, portfolio/case study style sections, testimonials, stats, lead form, FAQ and newsletter.',
  },
]

const SELLING_MODES = [
  { id: 'products', label: 'Products', desc: 'Catalog, cart, checkout, product filters' },
  { id: 'services', label: 'Services', desc: 'Service cards, bookings, quote requests' },
  { id: 'both', label: 'Both', desc: 'Products and services on the same website' },
]

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     icon: AlertCircle,  color: 'text-amber-600 bg-amber-50 border-amber-200' },
  published: { label: 'Published', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  archived:  { label: 'Archived',  icon: EyeOff,       color: 'text-gray-500 bg-gray-50 border-gray-200' },
}

function CreateSiteModal({
 onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const createSite = useCreateSite()
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [businessType, setBusinessType] = useState(BUSINESS_PRESETS[0].id)
  const [sellingMode, setSellingMode] = useState(BUSINESS_PRESETS[0].sells)

  const selectedBusiness = BUSINESS_PRESETS.find(t => t.id === businessType) || BUSINESS_PRESETS[0]

  const handleGuidedCreate = async () => {
    const siteName = name.trim() || selectedBusiness.defaultName
    const siteDesc = desc.trim() || `${selectedBusiness.label} website for ${sellingMode === 'both' ? 'products and services' : sellingMode}.`
    try {
      const site = await createSite.mutateAsync({ name: siteName, description: siteDesc, style_config: {} } as any)
      toast.success('Website created. Building ready-made pages…')
      onClose()
      navigate(`/websites/${site.id}`)

      try {
        const selling = SELLING_MODES.find(s => s.id === sellingMode)
        const gen = await websiteApi.aiGenerateSite(site.id, {
          business_description: [
            selectedBusiness.prompt,
            `Business name: ${siteName}.`,
            `Selling mode: ${selling?.label || sellingMode} - ${selling?.desc || ''}.`,
            'Make it easy for a non-designer store owner: include clear section titles, practical CTAs, ready-to-edit copy, SEO-friendly pages, contact/lead capture, and commerce blocks where relevant.',
          ].join(' '),
          niche: selectedBusiness.niche,
          tone: 'professional',
          include_pricing: true,
          include_blog: businessType === 'consulting' || businessType === 'clinic',
        })
        await websiteApi.aiApplyGeneratedSite(site.id, gen)
        await queryClient.invalidateQueries({ queryKey: ['websites', site.id] })
        await queryClient.invalidateQueries({ queryKey: ['websites'] })
        toast.success(`Ready-made website generated — ${gen.pages?.length ?? 0} page(s). Review text, connect products/services, then publish.`)
      } catch (e) {
        let msg = 'Ready-made setup failed. A blank site was created; you can still open the builder.'
        if (isAxiosError(e)) {
          const d = e.response?.data as { detail?: unknown } | undefined
          if (d?.detail != null) msg = Array.isArray(d.detail) ? d.detail.map(x => typeof x === 'object' && x && 'msg' in x ? String((x as { msg: string }).msg) : String(x)).join('; ') : String(d.detail)
          else msg = e.message || msg
        }
        toast.error(msg)
        await queryClient.invalidateQueries({ queryKey: ['websites', site.id] })
      }
    } catch (e) { toast.error(extractApiError(e, 'Failed to create site')) }
  }

  const isLoading = createSite.isPending

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-info px-6 py-5 text-white flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Create Website</h2>
            <p className="text-primary-foreground/85 text-sm mt-1">Use a ready-made store setup first. Advanced editing stays available after creation.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/25 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">1. Choose your business type</label>
                <div className="grid grid-cols-2 gap-2">
                  {BUSINESS_PRESETS.map(t => (
                    <button key={t.id} type="button" onClick={() => { setBusinessType(t.id); setSellingMode(t.sells) }}
                      className={cn('p-3 rounded-xl border-2 text-left transition-all',
                        businessType === t.id ? 'border-primary bg-accent' : 'border-gray-200 hover:border-primary/40 hover:bg-gray-50')}>
                      <div className="text-xl mb-1">{t.icon}</div>
                      <div className="text-xs font-medium text-gray-800">{t.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5 leading-tight">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">2. What do you sell?</label>
                  <div className="space-y-2">
                    {SELLING_MODES.map(s => (
                      <button key={s.id} type="button" onClick={() => setSellingMode(s.id)}
                        className={cn('w-full p-3 rounded-xl border-2 text-left transition-all',
                          sellingMode === s.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50')}>
                        <div className="text-xs font-medium text-gray-800">{s.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">3. Site name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder={selectedBusiness.defaultName}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                onKeyDown={e => e.key === 'Enter' && handleGuidedCreate()} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Extra details (optional)</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Example: We are a premium bakery in Bangalore selling cakes, cookies, and party orders..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
              <div className="text-xs font-bold text-gray-700 mb-2">Your ready-made setup includes</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600">
                {['Homepage copy', 'Products/services sections', 'Contact or lead form', 'SEO starter content', 'Mobile-friendly layout', 'Reviews / trust blocks', 'Cart or booking blocks', 'Publish checklist'].map(item => (
                  <div key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button variant="cancel" onClick={onClose}>Cancel</Button>
              <Button onClick={handleGuidedCreate} disabled={isLoading} className="bg-primary hover:bg-primary/90 text-white">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Rocket className="w-4 h-4 mr-2" />}
                Build Ready-Made Website
              </Button>
            </div>
          </div>
      </div>
    </div>
  )
}

function SiteCard({ site }: { site: SiteListItem }) {
  const navigate = useNavigate()
  const deleteSite = useDeleteSite()
  const publishSite = usePublishSite(site.id)
  const unpublishSite = useUnpublishSite(site.id)
  const updateSite = useUpdateSite(site.id)
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [settingLink, setSettingLink] = useState(false)
  const [subdomainInput, setSubdomainInput] = useState(
    site.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  )

  const testUrl = site.custom_domain
    ? `https://${site.custom_domain}`
    : site.subdomain
    ? (shouldUseLocalStorefrontUrls()
        ? `${window.location.protocol}//${window.location.hostname}:3002/store/${site.subdomain}`
        : `https://${site.subdomain}.kiterp.com`)
    : null

  const handleCopy = async () => {
    if (!testUrl) return
    await navigator.clipboard.writeText(testUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleGetLink = async () => {
    const slug = subdomainInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
    if (!slug) return
    try {
      await updateSite.mutateAsync({ subdomain: slug } as any)
      const url = shouldUseLocalStorefrontUrls()
        ? `${window.location.protocol}//${window.location.hostname}:3002/store/${slug}`
        : `https://${slug}.kiterp.com`
      toast.success(`Test link ready: ${url}`)
      setSettingLink(false)
    } catch {
      toast.error('Subdomain unavailable — try a different name')
    }
  }

  const statusCfg = STATUS_CONFIG[site.status] || STATUS_CONFIG.draft
  const StatusIcon = statusCfg.icon

  const handleDelete = async () => {
    if (!confirm(`Delete "${site.name}"? This cannot be undone.`)) return
    try {
      await deleteSite.mutateAsync(site.id)
      toast.success('Site deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleTogglePublish = async () => {
    try {
      if (site.is_published) {
        await unpublishSite.mutateAsync()
        toast.success('Site unpublished')
      } else {
        await publishSite.mutateAsync()
        toast.success('Site published!')
      }
    } catch {
      toast.error('Failed to update status')
    }
    setMenuOpen(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden group max-h-[90vh] overflow-y-auto">
      {/* Thumbnail */}
      <div
        className="relative h-40 bg-gradient-to-br from-accent via-info/10 to-primary/15 cursor-pointer overflow-hidden"
        onClick={() => navigate(`/websites/${site.id}`)}
      >
        {site.favicon_url ? (
          <img src={site.favicon_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center">
              <Globe className="w-8 h-8 text-primary/80" />
            </div>
            <div className="flex gap-1">
              {[...Array(site.page_count || 1)].slice(0, 4).map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-primary/35 opacity-60" />
              ))}
            </div>
          </div>
        )}
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white font-semibold text-sm flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full">
            <Edit3 className="w-4 h-4" /> Open Builder
          </span>
        </div>
        {/* Status badge */}
        <div className={cn('absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium', statusCfg.color)}>
          <StatusIcon className="w-3 h-3" />
          {statusCfg.label}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-gray-900 truncate text-base">{site.name}</h3>
            {site.description && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{site.description}</p>
            )}
            {testUrl ? (
              <div className="flex items-center gap-1 mt-1.5">
                <a
                  href={testUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:text-primary flex items-center gap-1 min-w-0 flex-1 truncate"
                >
                  <Globe2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">{testUrl.replace('https://', '')}</span>
                </a>
                <button
                  onClick={handleCopy}
                  title="Copy test link"
                  className="p-1 rounded-md text-gray-400 hover:text-primary hover:bg-accent transition-colors shrink-0"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
                <a
                  href={testUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
                  title="Open store"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ) : settingLink ? (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    value={subdomainInput}
                    onChange={e => setSubdomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    placeholder="my-store"
                    className="flex-1 min-w-0 px-2.5 py-1.5 border border-primary/40 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    onKeyDown={e => e.key === 'Enter' && handleGetLink()}
                    autoFocus
                  />
                  <button
                    onClick={handleGetLink}
                    disabled={updateSite.isPending}
                    className="px-2.5 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-medium rounded-lg disabled:opacity-60 transition-colors"
                  >
                    {updateSite.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Set'}
                  </button>
                  <button onClick={() => setSettingLink(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                    <span className="text-xs">✕</span>
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  {shouldUseLocalStorefrontUrls()
                    ? `${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3002/store/${subdomainInput || '…'}`
                    : `${subdomainInput || '…'}.kiterp.com`}
                </p>
              </div>
            ) : (
              <button
                onClick={() => setSettingLink(true)}
                className="flex items-center gap-1 mt-1.5 text-xs text-gray-400 hover:text-primary transition-colors"
              >
                <Link2 className="w-3 h-3" /> Get test link
              </button>
            )}
          </div>

          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-30 bg-white border border-gray-200 rounded-xl shadow-xl w-44 py-1 overflow-hidden max-h-[90vh] overflow-y-auto">
                  <button
                    onClick={() => { navigate(`/websites/${site.id}`); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-accent"
                  >
                    <Edit3 className="w-4 h-4 text-gray-400" /> Open Builder
                  </button>
                  {testUrl && (
                    <button
                      onClick={() => { window.open(testUrl, '_blank'); setMenuOpen(false) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-accent"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-400" /> View Store
                    </button>
                  )}
                  <button
                    onClick={handleTogglePublish}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-accent"
                  >
                    {site.is_published
                      ? <><EyeOff className="w-4 h-4 text-gray-400" /> Unpublish</>
                      : <><Eye className="w-4 h-4 text-gray-400" /> Publish</>
                    }
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {site.page_count} page{site.page_count !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {format(new Date(site.updated_at), 'MMM d, yyyy')}
          </span>
        </div>

        {/* CTA */}
        <Button
          className="w-full mt-3 bg-primary hover:bg-primary/90 text-white text-sm"
          onClick={() => navigate(`/websites/${site.id}`)}
        >
          <Edit3 className="w-3.5 h-3.5 mr-2" /> Open Builder
        </Button>
      </div>
    </div>
  )
}

export default function WebsitesPage() {
  const { data: sites = [], isLoading } = useSiteList()
  const [createOpen, setCreateOpen] = useState(false)
  const [openingTemplateEditor, setOpeningTemplateEditor] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const createSite = useCreateSite()

  const openTemplateEditorSandbox = async (templateName: string) => {
    if (openingTemplateEditor) return
    setOpeningTemplateEditor(true)
    try {
      // Reuse an existing template-sandbox site instead of creating a new one every time.
      const existing = (sites as SiteListItem[]).find(
        s => s.description?.startsWith('Sandbox:') && !s.is_published,
      )
      let siteId: string
      if (existing) {
        siteId = existing.id
      } else {
        const created = await createSite.mutateAsync({
          name: `Template edit — ${new Date().toISOString().slice(0, 10)}`,
          description: 'Sandbox: pick a template in the builder',
          style_config: {},
        } as any)
        siteId = created.id
      }
      try {
        const blank = await websiteApi.ensureBlankSite(siteId)
        queryClient.setQueryData(['websites', blank.id], blank)
      } catch {
        toast.error('Could not clear the template sandbox. Try again.')
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['websites'], exact: true })
      navigate(
        `/websites/${siteId}?templateMode=true&expectBlank=1&templateName=${encodeURIComponent(templateName)}`,
      )
    } catch (e) {
      toast.error(extractApiError(e, 'Could not open template editor'))
    } finally {
      setOpeningTemplateEditor(false)
    }
  }

  // Auto-open builder when arriving from template browser with ?openTemplate=<id>
  useEffect(() => {
    const templateId = searchParams.get('openTemplate')
    const templateName = searchParams.get('templateName') ?? templateId ?? 'Template'
    if (!templateId) return
    setSearchParams({}, { replace: true })
    ;(async () => {
      try {
        // Reuse an existing template-sandbox site instead of creating a new one each time.
        const existing = (sites as SiteListItem[]).find(
          s => s.description?.startsWith('Sandbox for template:') && !s.is_published,
        )
        let siteId: string
        if (existing) {
          siteId = existing.id
        } else {
          const created = await createSite.mutateAsync({
            name: `${templateName} — Template Edit`,
            description: `Sandbox for template: ${templateId}`,
            style_config: {},
          } as any)
          siteId = created.id
        }
        try {
          const blank = await websiteApi.ensureBlankSite(siteId)
          queryClient.setQueryData(['websites', blank.id], blank)
        } catch {
          toast.error('Could not clear the template sandbox. Try opening again.')
        }
        await queryClient.invalidateQueries({ queryKey: ['websites'], exact: true })
        navigate(
          `/websites/${siteId}?templateMode=true&expectBlank=1&templateName=${encodeURIComponent(templateName)}`,
        )
      } catch {
        toast.error('Could not open template for editing. Make sure you are logged in.')
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" /> Website Builder
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Start from a ready-made store website, then fine-tune with the advanced builder
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={openingTemplateEditor}
            onClick={() => { void openTemplateEditorSandbox('Template library') }}
            className="border-primary/30 text-primary hover:bg-accent hover:border-primary/60"
          >
            {openingTemplateEditor
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Opening…</>
              : <><Pencil className="w-4 h-4 mr-2" /> Edit Template</>}
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-primary hover:bg-primary/90 text-white shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" /> New Website
          </Button>
        </div>
      </div>

      {/* Feature highlights */}
      {sites.length === 0 && !isLoading && (
        <div className="bg-gradient-to-br from-accent via-info/10 to-primary/10 border border-primary/20 rounded-2xl p-8 text-center">
          <div className="w-20 h-20 bg-white rounded-3xl shadow-md flex items-center justify-center mx-auto mb-4">
            <Globe className="w-10 h-10 text-primary/80" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Build Your First Store Website</h2>
          <p className="text-gray-600 text-sm max-w-md mx-auto mb-6">
            Choose your business type and we will create the pages, sections, copy, commerce blocks, and starter SEO for you.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 text-left">
            {[
              { icon: Rocket, label: 'Guided Setup', desc: 'Business type → ready-made store website' },
              { icon: Layout, label: 'Ready Sections', desc: 'Products, services, reviews, contact, checkout' },
              { icon: Sparkles, label: 'AI Copy', desc: 'Homepage, SEO, FAQs, and CTAs generated' },
              { icon: Globe, label: 'Go Live', desc: 'Mobile-ready pages with publish checklist' },
            ].map(f => (
              <div key={f.label} className="bg-white rounded-xl p-4 shadow-sm border border-white max-h-[90vh] overflow-y-auto">
                <f.icon className="w-5 h-5 text-primary mb-2" />
                <div className="text-sm font-semibold text-gray-800">{f.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{f.desc}</div>
              </div>
            ))}
          </div>

          <Button
            onClick={() => setCreateOpen(true)}
            size="lg"
            className="bg-primary hover:bg-primary/90 text-white shadow-lg"
          >
            <Rocket className="w-4 h-4 mr-2" /> Start Guided Setup
          </Button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary/80" />
        </div>
      )}

      {/* Sites grid */}
      {!isLoading && sites.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{sites.length} website{sites.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {/* Add new card */}
            <button
              onClick={() => setCreateOpen(true)}
              className="border-2 border-dashed border-primary/30 rounded-2xl h-64 flex flex-col items-center justify-center gap-3 text-primary/80 hover:border-primary/60 hover:bg-accent transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Plus className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold">Add New Website</div>
            </button>

            {sites.map(site => (
              <SiteCard key={site.id} site={site} />
            ))}
          </div>
        </>
      )}

      {createOpen && <CreateSiteModal onClose={() => setCreateOpen(false)} />}
    </div>
  )
}
