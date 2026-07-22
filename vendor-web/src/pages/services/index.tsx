import { useMemo, useState, useRef, useEffect } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import {
  CatalogFilterField,
  CatalogListFiltersPanel,
  PRODUCT_STATUS_FILTER_OPTIONS,
  VISIBILITY_FILTER_OPTIONS,
  type CatalogActiveFilter,
} from '@/components/catalog/CatalogListFilters'
import { SERVICE_MODE_OPTIONS, SERVICE_TYPE_OPTIONS } from './serviceCatalogConstants'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useServices, useDeleteService, useUpdateService, useCategories } from '@/hooks/useVendor'
import { useInlineFieldPatch, INLINE_EDIT_HINT } from '@/hooks/useInlineFieldPatch'
import { useVendorStore } from '@/stores/vendorStore'
import { formatCurrency, mediaUrl } from '@/lib/utils'
import { TableToolbar } from '@/components/table/TableToolbar'
import { TablePagination } from '@/components/table/TablePagination'
import { ResizableTable } from '@/components/table/ResizableTable'
import { InlineEditCell } from '@/components/table/InlineEditCell'
import { processRows, type SortDir } from '@/lib/tableList'
import type { Service } from '@/types'
import {
  Plus, Search, Pencil, Trash2, Loader2, X, Eye,
  Filter, MoreVertical,
  Copy, Share2, Mail, MessageCircle, Clock, MapPin,
  Wrench, Image as ImageIcon, Layers,
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
  const selectedStore = useVendorStore(s => s.selectedStore)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [visibility, setVisibility] = useState('')
  const [category, setCategory] = useState('')
  const [serviceType, setServiceType] = useState('')
  const [serviceMode, setServiceMode] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data: categoryData } = useCategories({ applies_to: 'service', is_active: true })
  const serviceCategories = categoryData?.categories || []

  const { data, isLoading } = useServices({
    page, size: pageSize,
    search: search || undefined,
    status: status || undefined,
    category: category || undefined,
    is_visible: visibility === 'true' ? true : visibility === 'false' ? false : undefined,
    service_type: serviceType || undefined,
    service_mode: serviceMode || undefined,
    store_id: selectedStore?.id || undefined,
  })
  const deleteService = useDeleteService()
  const updateService = useUpdateService()
  const { isSaving, patchField } = useInlineFieldPatch(updateService)

  const activeFilterCount = [status, visibility, category, serviceType, serviceMode].filter(Boolean).length
  const hasActiveQuery = Boolean(search.trim() || activeFilterCount > 0)
  const clearFilters = () => {
    setStatus('')
    setVisibility('')
    setCategory('')
    setServiceType('')
    setServiceMode('')
    setPage(1)
  }

  const activeFilters = useMemo((): CatalogActiveFilter[] => {
    const chips: CatalogActiveFilter[] = []
    if (status) {
      chips.push({
        key: 'status',
        label: `Status: ${PRODUCT_STATUS_FILTER_OPTIONS.find(o => o.value === status)?.label || status}`,
        onRemove: () => { setStatus(''); setPage(1) },
      })
    }
    if (visibility) {
      chips.push({
        key: 'visibility',
        label: VISIBILITY_FILTER_OPTIONS.find(o => o.value === visibility)?.label || 'Visibility',
        onRemove: () => { setVisibility(''); setPage(1) },
      })
    }
    if (category) {
      chips.push({
        key: 'category',
        label: `Category: ${serviceCategories.find((c: { name: string }) => c.name === category)?.name || category}`,
        onRemove: () => { setCategory(''); setPage(1) },
      })
    }
    if (serviceType) {
      chips.push({
        key: 'service_type',
        label: `Type: ${SERVICE_TYPE_OPTIONS.find(o => o.value === serviceType)?.label || serviceType}`,
        onRemove: () => { setServiceType(''); setPage(1) },
      })
    }
    if (serviceMode) {
      chips.push({
        key: 'service_mode',
        label: `Mode: ${SERVICE_MODE_OPTIONS.find(o => o.value === serviceMode)?.label || serviceMode}`,
        onRemove: () => { setServiceMode(''); setPage(1) },
      })
    }
    return chips
  }, [status, visibility, category, serviceType, serviceMode, serviceCategories])

  const displayServices = useMemo(() => {
    if (!data?.items?.length) return []
    return processRows(
      data.items as Service[],
      '',
      () => [],
      sortKey,
      sortDir,
      {
        created_at:      (s) => (s.created_at ? new Date(s.created_at).getTime() : 0),
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
                  aria-label="Search services"
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
            <CatalogListFiltersPanel activeFilters={activeFilters} onClearAll={clearFilters}>
              <CatalogFilterField
                label="Status"
                value={status}
                onChange={(value) => { setStatus(value); setPage(1) }}
                options={PRODUCT_STATUS_FILTER_OPTIONS}
                placeholder="All statuses"
              />
              <CatalogFilterField
                label="Visibility"
                value={visibility}
                onChange={(value) => { setVisibility(value); setPage(1) }}
                options={VISIBILITY_FILTER_OPTIONS}
                placeholder="All visibility"
              />
              <CatalogFilterField
                label="Category"
                value={category}
                onChange={(value) => { setCategory(value); setPage(1) }}
                options={serviceCategories.map((c: { id: string; name: string }) => ({ value: c.name, label: c.name }))}
                placeholder="All categories"
              />
              <CatalogFilterField
                label="Service type"
                value={serviceType}
                onChange={(value) => { setServiceType(value); setPage(1) }}
                options={SERVICE_TYPE_OPTIONS}
                placeholder="All types"
              />
              <CatalogFilterField
                label="Delivery mode"
                value={serviceMode}
                onChange={(value) => { setServiceMode(value); setPage(1) }}
                options={SERVICE_MODE_OPTIONS}
                placeholder="All modes"
              />
            </CatalogListFiltersPanel>
          )}
          {!showFilters && activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {activeFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={filter.onRemove}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  {filter.label}
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              ))}
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-gray-500" onClick={clearFilters}>
                Clear all
              </Button>
            </div>
          )}
          <p className="text-xs text-gray-400 px-1">{INLINE_EDIT_HINT}</p>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-gray-200/80 overflow-hidden">
        <CardContent className="p-0">
          <TableToolbar
            search="" onSearchChange={() => {}} hideSearch
            hint={INLINE_EDIT_HINT}
            sortOptions={[
              { value: 'created_at', label: 'Newest' },
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
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Service</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Type</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Mode</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Price</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Plans</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Duration</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Status</TableColumnLabel></th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"><TableColumnLabel>Actions</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={8} className="px-6 py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                ) : !displayServices.length ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <Wrench className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                      {hasActiveQuery ? (
                        <>
                          <p className="text-sm font-medium text-gray-500 mb-1">No services found</p>
                          <p className="text-xs text-gray-400 mb-4">
                            {search.trim()
                              ? `No results for "${search.trim()}". Try a different search or clear your filters.`
                              : 'No services match your current filters. Try adjusting or clearing them.'}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => { setSearch(''); setSearchInput(''); clearFilters() }}
                          >
                            Clear search & filters
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-gray-500 mb-1">No services yet</p>
                          <p className="text-xs text-gray-400 mb-4">Create your first service to get started</p>
                          <Button size="sm" onClick={() => navigate('/services/new')} className="gap-1.5">
                            <Plus className="w-3.5 h-3.5" /> Add Service
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ) : displayServices.map((service) => {
                  const primaryMedia = service.media?.find((m: any) => m.is_primary) || service.media?.[0]
                  const thumbUrl = primaryMedia ? resolveUrl(primaryMedia.url) : service.image_url ? resolveUrl(service.image_url) : ''
                  const plansCount = service.plans?.length ?? 0
                  const activePlans = service.plans?.filter((p: any) => p.is_active)?.length ?? 0

                  return (
                    <tr key={service.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {thumbUrl ? (
                            <img src={thumbUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 border border-gray-200/80 shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200/80 flex items-center justify-center shrink-0">
                              <ImageIcon className="w-4 h-4 text-gray-300" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <InlineEditCell
                              value={service.name}
                              saving={isSaving(service.id, 'name')}
                              validate={(v) => String(v).trim().length < 2 ? 'Min 2 characters' : null}
                              onSave={(v) => patchField(service.id, 'name', String(v).trim())}
                              className="-mx-1.5"
                              title="Edit service name"
                            >
                              <span className="text-sm font-medium text-gray-900">{service.name}</span>
                            </InlineEditCell>
                            <InlineEditCell
                              value={service.category || ''}
                              saving={isSaving(service.id, 'category')}
                              onSave={(v) => patchField(service.id, 'category', String(v).trim())}
                              title="Edit category"
                            >
                              <span className="text-xs text-gray-400">{service.category || 'Uncategorized'}</span>
                            </InlineEditCell>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <InlineEditCell
                          type="select"
                          value={service.service_type || 'one_time'}
                          options={SERVICE_TYPE_OPTIONS}
                          saving={isSaving(service.id, 'service_type')}
                          onSave={(v) => patchField(service.id, 'service_type', v)}
                          title="Edit service type"
                        >
                          <span className="px-2 py-0.5 text-xs rounded-full font-semibold bg-accent text-primary capitalize">
                            {(service.service_type || 'one_time').replace('_', ' ')}
                          </span>
                        </InlineEditCell>
                      </td>
                      <td className="px-4 py-3">
                        <InlineEditCell
                          type="select"
                          value={service.service_mode || 'in_store'}
                          options={SERVICE_MODE_OPTIONS}
                          saving={isSaving(service.id, 'service_mode')}
                          onSave={(v) => patchField(service.id, 'service_mode', v)}
                          title="Edit delivery mode"
                        >
                          <span className="text-[12px] text-gray-600 capitalize flex items-center gap-1">
                            {service.service_mode === 'home_visit' && <MapPin className="w-3 h-3 text-gray-400" />}
                            {(service.service_mode || 'in_store').replace(/_/g, ' ')}
                          </span>
                        </InlineEditCell>
                      </td>
                      <td className="px-4 py-3">
                        {service.price != null && service.price > 0 ? (
                          <InlineEditCell
                            type="number"
                            value={service.price}
                            min={0}
                            step="0.01"
                            saving={isSaving(service.id, 'price')}
                            validate={(v) => Number(v) < 0 ? 'Price must be 0 or more' : null}
                            onSave={(v) => patchField(service.id, 'price', Number(v))}
                            title="Edit price"
                          >
                            <span className="text-sm font-medium text-gray-900">{formatCurrency(service.price)}</span>
                          </InlineEditCell>
                        ) : service.price_min != null && service.price_max != null ? (
                          <div className="space-y-1">
                            <InlineEditCell
                              type="number"
                              value={service.price_min}
                              min={0}
                              step="0.01"
                              saving={isSaving(service.id, 'price_min')}
                              onSave={(v) => patchField(service.id, 'price_min', Number(v))}
                              title="Edit min price"
                            >
                              <span className="text-xs text-gray-700">{formatCurrency(service.price_min)}</span>
                            </InlineEditCell>
                            <InlineEditCell
                              type="number"
                              value={service.price_max}
                              min={0}
                              step="0.01"
                              saving={isSaving(service.id, 'price_max')}
                              onSave={(v) => patchField(service.id, 'price_max', Number(v))}
                              title="Edit max price"
                            >
                              <span className="text-xs text-gray-700">{formatCurrency(service.price_max)}</span>
                            </InlineEditCell>
                          </div>
                        ) : (
                          <InlineEditCell
                            type="number"
                            value={0}
                            min={0}
                            step="0.01"
                            saving={isSaving(service.id, 'price')}
                            onSave={(v) => patchField(service.id, 'price', Number(v))}
                            title="Set price"
                          >
                            <span className="text-gray-400 text-xs capitalize">{service.price_type || '—'}</span>
                          </InlineEditCell>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <InlineEditCell
                          readOnly
                          readOnlyMessage="Open full editor to manage service plans"
                          title="Plans"
                        >
                          {plansCount > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-primary/70" />
                              <span className="text-xs font-medium text-gray-700">{plansCount}</span>
                              <span className="text-xs text-gray-400">({activePlans} active)</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </InlineEditCell>
                      </td>
                      <td className="px-4 py-3">
                        {service.duration_minutes ? (
                          <InlineEditCell
                            type="number"
                            value={service.duration_minutes}
                            min={0}
                            step="1"
                            saving={isSaving(service.id, 'duration_minutes')}
                            validate={(v) => Number(v) < 0 ? 'Must be 0 or more' : null}
                            parse={(raw) => Math.max(0, Math.round(Number(raw) || 0))}
                            onSave={(v) => patchField(service.id, 'duration_minutes', Number(v))}
                            title="Edit duration (minutes)"
                          >
                            <span className="text-sm text-gray-600 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-gray-400" />{service.duration_minutes} min
                            </span>
                          </InlineEditCell>
                        ) : (
                          <InlineEditCell
                            type="number"
                            value={0}
                            min={0}
                            step="1"
                            saving={isSaving(service.id, 'duration_minutes')}
                            onSave={(v) => patchField(service.id, 'duration_minutes', Number(v) || undefined)}
                            title="Add duration (minutes)"
                          >
                            <span className="text-gray-300 text-xs">—</span>
                          </InlineEditCell>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 min-w-[6.5rem]">
                          <InlineEditCell
                            type="select"
                            value={service.status}
                            options={PRODUCT_STATUS_FILTER_OPTIONS}
                            saving={isSaving(service.id, 'status')}
                            onSave={(v) => patchField(service.id, 'status', v)}
                            title="Edit status"
                          >
                            <span className={`px-2 py-0.5 text-xs rounded-full font-semibold whitespace-nowrap capitalize ${
                              service.status === 'active' ? 'bg-green-100 text-green-700'
                                : service.status === 'archived' ? 'bg-red-50 text-red-600'
                                  : 'bg-gray-100 text-gray-700'
                            }`}>{service.status}</span>
                          </InlineEditCell>
                          <InlineEditCell
                            type="select"
                            value={service.is_visible ? 'true' : 'false'}
                            options={VISIBILITY_FILTER_OPTIONS}
                            saving={isSaving(service.id, 'is_visible')}
                            onSave={(v) => patchField(service.id, 'is_visible', v === 'true')}
                            title="Edit visibility"
                          >
                            <span className={`px-2 py-0.5 text-xs rounded-full font-semibold whitespace-nowrap ${
                              service.is_visible
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-amber-50 text-amber-800 border border-amber-100'
                            }`}>{service.is_visible ? 'Visible' : 'Hidden'}</span>
                          </InlineEditCell>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end items-center">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="View service"
                            onClick={() => navigate(`/services/${service.id}?mode=view`)}>
                            <Eye className="w-4 h-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Full edit"
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

          {data && (
            <TablePagination
              page={page}
              pages={data.pages || 1}
              total={data.total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="services"
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
