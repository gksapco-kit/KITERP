import { useMemo, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useServices, useDeleteService, useCategories } from '@/hooks/useVendor'
import { formatCurrency, mediaUrl } from '@/lib/utils'
import { TableToolbar } from '@/components/table/TableToolbar'
import { ResizableTable } from '@/components/table/ResizableTable'
import { processRows, type SortDir } from '@/lib/tableList'
import type { Service } from '@/types'
import {
  Plus, Search, Pencil, Trash2, Loader2, X,
  ChevronLeft, ChevronRight, Filter, MoreVertical,
  Copy, Share2, Mail, MessageCircle, Clock, MapPin,
  AlertTriangle, Wrench, Image as ImageIcon, Layers,
} from 'lucide-react'
import { toast } from 'sonner'

const resolveUrl = mediaUrl

function shareService(service: Service, action: 'copy' | 'whatsapp' | 'email' | 'native') {
  const priceText = service.price ? ` - ${formatCurrency(service.price)}` : ''
  const text = `Check out ${service.name}${priceText}${service.category ? ` in ${service.category}` : ''}`
  if (action === 'copy') { navigator.clipboard.writeText(text); toast.success('Service info copied!') }
  else if (action === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  else if (action === 'email') window.open(`mailto:?subject=${encodeURIComponent(`Service: ${service.name}`)}&body=${encodeURIComponent(text)}`, '_blank')
  else if (action === 'native') {
    if (navigator.share) navigator.share({ title: service.name, text }).catch(() => {})
    else { navigator.clipboard.writeText(text); toast.success('Service info copied!') }
  }
}

function MoreMenu({ service, onDelete }: {
  service: Service
  onDelete: () => void
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, right: 0, openUp: false })

  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const menuHeight = 320
    const openUp = window.innerHeight - rect.bottom < menuHeight && rect.top > menuHeight
    setPos({
      top: openUp ? rect.top + window.scrollY - 4 : rect.bottom + window.scrollY + 4,
      right: window.innerWidth - rect.right,
      openUp,
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
      setConfirmDelete(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const menu = open ? createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        top: pos.top,
        right: pos.right,
        zIndex: 9999,
        transform: pos.openUp ? 'translateY(-100%)' : undefined,
      }}
      className="w-44 max-h-[min(90vh,24rem)] overflow-y-auto rounded-lg border bg-white py-1 shadow-lg animate-in fade-in-0 zoom-in-95"
    >
      <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        onClick={() => { navigate(`/services/${service.id}`); setOpen(false) }}>
        <Pencil className="w-4 h-4 text-gray-400" /> Edit
      </button>
      <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        onClick={() => { shareService(service, 'copy'); setOpen(false) }}>
        <Copy className="w-4 h-4 text-gray-400" /> Copy Info
      </button>
      <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        onClick={() => { shareService(service, 'whatsapp'); setOpen(false) }}>
        <MessageCircle className="w-4 h-4 text-green-500" /> WhatsApp
      </button>
      <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        onClick={() => { shareService(service, 'email'); setOpen(false) }}>
        <Mail className="w-4 h-4 text-blue-500" /> Email
      </button>
      <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        onClick={() => { shareService(service, 'native'); setOpen(false) }}>
        <Share2 className="w-4 h-4 text-primary/80" /> Share
      </button>
      <div className="border-t my-1" />
      {confirmDelete ? (
        <div className="px-3 py-2 space-y-2">
          <p className="text-xs font-medium text-red-600">Delete this service?</p>
          <div className="flex gap-2">
            <button className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
              onClick={() => { onDelete(); setOpen(false); setConfirmDelete(false) }}>
              Yes, Delete
            </button>
            <button className="btn-cancel flex-1 px-2 py-1.5 text-xs font-medium rounded transition-colors"
              onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          onClick={() => setConfirmDelete(true)}>
          <Trash2 className="w-4 h-4" /> Delete
        </button>
      )}
    </div>,
    document.body,
  ) : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md p-0 text-gray-500 hover:bg-gray-100 transition-colors"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); setConfirmDelete(false) }}
      >
        <MoreVertical className="w-4 h-4 text-gray-500" />
      </button>
      {menu}
    </>
  )
}

export default function Services() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Debounce search input → API call
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data: categoryData } = useCategories({ applies_to: 'service', is_active: true })
  const serviceCategories = categoryData?.categories || []

  const { data, isLoading } = useServices({
    page, size: 10,
    search: search || undefined,
    status: status || undefined,
    category: category || undefined,
  })
  const deleteService = useDeleteService()

  const activeFilterCount = [status, category].filter(Boolean).length
  const clearFilters = () => { setStatus(''); setCategory(''); setPage(1) }

  const displayServices = useMemo(() => {
    if (!data?.items?.length) return []
    return processRows(
      data.items as Service[],
      '',
      () => [],
      sortKey,
      sortDir,
      {
        name:             (s) => s.name,
        service_type:     (s) => s.service_type,
        service_mode:     (s) => s.service_mode || '',
        price:            (s) => s.price ?? s.price_min ?? 0,
        duration_minutes: (s) => s.duration_minutes ?? 0,
        status:           (s) => s.status,
      },
    )
  }, [data?.items, sortKey, sortDir])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} total services</p>
        </div>
        <Button onClick={() => navigate('/services/new')} className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" />Add Service
        </Button>
      </div>

      {/* Search + Filters */}
      <Card className="border-gray-200/80">
        <CardContent className="pt-5 pb-4 space-y-3">
          <div className="flex gap-2">
            <div className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search services…"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  className="pl-10 pr-8"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <Button type="button" variant="outline" className="gap-2" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4" />Filters
              {activeFilterCount > 0 && <span className="ml-1 px-1.5 py-0.5 text-xs leading-none font-bold bg-primary text-white rounded-full">{activeFilterCount}</span>}
            </Button>
          </div>
          {showFilters && (
            <div className="flex flex-wrap items-end gap-3 pt-3 border-t">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Status</label>
                <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
                  className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/60 transition-shadow">
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Category</label>
                <select value={category} onChange={e => { setCategory(e.target.value); setPage(1) }}
                  className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/60 transition-shadow">
                  <option value="">All Categories</option>
                  {serviceCategories.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" className="h-9 text-gray-500 gap-1" onClick={clearFilters}>
                  <X className="w-3.5 h-3.5" />Clear
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-gray-200/80 overflow-hidden">
        <CardContent className="p-0">
          <TableToolbar
            search="" onSearchChange={() => {}} hideSearch
            hint="Sorting applies to the current page."
            sortOptions={[
              { value: 'name', label: 'Service' },
              { value: 'service_type', label: 'Type' },
              { value: 'service_mode', label: 'Mode' },
              { value: 'price', label: 'Price' },
              { value: 'duration_minutes', label: 'Duration' },
              { value: 'status', label: 'Status' },
            ]}
            sortKey={sortKey} sortDir={sortDir}
            onSortKeyChange={setSortKey} onSortDirChange={setSortDir}
          />
          <div className="overflow-x-auto">
            <ResizableTable tableId="services" defaultWidths={[240, 90, 90, 90, 70, 90, 80, 80]}>
              <thead>
                <tr className="border-b bg-gray-50/80">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Service</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Mode</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Price</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Plans</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Duration</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={8} className="px-6 py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                ) : !data?.items?.length ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <Wrench className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-500 mb-1">No services yet</p>
                      <p className="text-xs text-gray-400 mb-4">Create your first service to get started</p>
                      <Button size="sm" onClick={() => navigate('/services/new')} className="gap-1.5">
                        <Plus className="w-3.5 h-3.5" /> Add Service
                      </Button>
                    </td>
                  </tr>
                ) : displayServices.map((service) => {
                  const primaryMedia = service.media?.find((m: any) => m.is_primary) || service.media?.[0]
                  const thumbUrl = primaryMedia ? resolveUrl(primaryMedia.url) : service.image_url ? resolveUrl(service.image_url) : ''
                  const plansCount = service.plans?.length ?? 0
                  const activePlans = service.plans?.filter((p: any) => p.is_active)?.length ?? 0

                  return (
                    <tr key={service.id}
                      className="hover:bg-gray-50/80 cursor-pointer transition-colors group"
                      onClick={() => navigate(`/services/${service.id}?mode=view`)}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {thumbUrl ? (
                            <img src={thumbUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 border border-gray-200/80" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200/80 flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-gray-300" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 group-hover:text-primary transition-colors truncate">{service.name}</p>
                            <p className="text-xs text-gray-400 truncate">{service.category || 'Uncategorized'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 text-xs rounded-full font-semibold bg-accent text-primary capitalize">
                          {(service.service_type || 'one_time').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-gray-600 capitalize flex items-center gap-1">
                          {service.service_mode === 'home_visit' && <MapPin className="w-3 h-3 text-gray-400" />}
                          {(service.service_mode || 'in_store').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {service.price ? formatCurrency(service.price) :
                         (service.price_min && service.price_max) ? `${formatCurrency(service.price_min)}–${formatCurrency(service.price_max)}` :
                         <span className="text-gray-400 text-xs capitalize">{service.price_type || '—'}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {plansCount > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-primary/70" />
                            <span className="text-xs font-medium text-gray-700">{plansCount}</span>
                            <span className="text-xs text-gray-400">({activePlans} active)</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {service.duration_minutes
                          ? <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-gray-400" />{service.duration_minutes} min</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                          service.status === 'active'   ? 'bg-green-100 text-green-700' :
                          service.status === 'archived' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'
                        }`}>{service.status}</span>
                      </td>
                      <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end items-center">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Edit"
                            onClick={() => navigate(`/services/${service.id}`)}>
                            <Pencil className="w-4 h-4 text-gray-500" />
                          </Button>
                          <MoreMenu service={service} onDelete={() => deleteService.mutate(service.id)} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </ResizableTable>
          </div>

          {data && data.pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50/50">
              <span className="text-[13px] text-gray-500">
                Page {data.page} of {data.pages} <span className="text-gray-400">({data.total} services)</span>
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
