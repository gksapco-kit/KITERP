import { useState, useMemo } from 'react'
import {
  Plus, Search, Wrench, Clock, MapPin, Edit2, Trash2,
  ChevronLeft, ChevronRight, EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useServices, useCreateService, useUpdateService, useDeleteService } from '@/hooks/useServices'
import type { ServiceCreate, ServiceUpdate, Service } from '@/api/service.api'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'

const UOM_OPTIONS = [
  { value: 'fixed', label: 'Fixed Price' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'event', label: 'Per Event' },
  { value: 'task', label: 'Per Task' },
  { value: 'milestone', label: 'Per Milestone' },
  { value: 'per_km', label: 'Per KM' },
  { value: 'per_unit', label: 'Per Unit' },
]

const MODE_OPTIONS = [
  { value: 'in_store', label: 'In-Store' },
  { value: 'home_visit', label: 'Home Visit' },
  { value: 'both', label: 'Both (In-Store + Home Visit)' },
  { value: 'online', label: 'Online' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

const GST_RATES = [0, 5, 12, 18, 28]

const DEFAULT_SERVICE: ServiceCreate = {
  name: '', description: '', short_description: '', category: '',
  tags: [], price_type: 'fixed', price: undefined, currency: 'INR',
  is_taxable: true, tax_rate: 18, sac_code: '', uom: 'fixed',
  service_mode: 'in_store', duration_minutes: 60, buffer_minutes: 0,
  requires_booking: true, max_bookings_per_slot: 1,
  advance_booking_days: 30, cancellation_policy: '',
  status: 'draft', is_featured: false, is_visible: true,
}

export default function Services() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ServiceCreate>(DEFAULT_SERVICE)
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data, isLoading } = useServices({ page, size: 15, search: search || undefined, status: statusFilter || undefined })
  const createService = useCreateService()
  const updateService = useUpdateService()
  const deleteService = useDeleteService()

  const openCreate = () => { setEditingId(null); setForm(DEFAULT_SERVICE); setShowForm(true) }
  const openEdit = (s: Service) => {
    setEditingId(s.id)
    setForm({
      name: s.name, description: s.description || '', short_description: s.short_description || '',
      category: s.category || '', tags: s.tags, price_type: s.price_type, price: s.price,
      price_min: s.price_min, price_max: s.price_max, currency: s.currency,
      is_taxable: s.is_taxable, tax_rate: s.tax_rate, sac_code: s.sac_code || '',
      uom: s.uom, service_mode: s.service_mode, duration_minutes: s.duration_minutes,
      buffer_minutes: s.buffer_minutes, requires_booking: s.requires_booking,
      max_bookings_per_slot: s.max_bookings_per_slot, advance_booking_days: s.advance_booking_days,
      cancellation_policy: s.cancellation_policy || '', status: s.status,
      is_featured: s.is_featured, is_visible: s.is_visible, image_url: s.image_url,
    })
    setShowForm(true)
  }

  const handleSave = () => {
    if (!form.name || !form.price) return
    if (editingId) {
      updateService.mutate({ id: editingId, data: form as ServiceUpdate }, { onSuccess: () => setShowForm(false) })
    } else {
      createService.mutate(form, { onSuccess: () => setShowForm(false) })
    }
  }

  const handleDelete = (id: string) => {
    if (confirm('Delete this service?')) deleteService.mutate(id)
  }

  const isSaving = createService.isPending || updateService.isPending

  const displayServices = useMemo(() => {
    const items = data?.items || []
    return processRows(
      items,
      '',
      () => [],
      sortKey,
      sortDir,
      {
        name: (s) => s.name,
        category: (s) => s.category || '',
        price: (s) => s.price ?? 0,
        service_mode: (s) => s.service_mode,
        duration_minutes: (s) => s.duration_minutes ?? 0,
        status: (s) => s.status,
      },
    )
  }, [data?.items, sortKey, sortDir])

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setShowForm(false)}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
          <h1 className="text-xl font-bold text-gray-900">{editingId ? 'Edit Service' : 'Add Service'}</h1>
        </div>
        <div className="bg-white rounded-xl border p-6 space-y-6 max-w-3xl">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">Service Name *</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">Short Description</label>
                <Input value={form.short_description || ''} onChange={(e) => setForm({ ...form, short_description: e.target.value })} className="mt-1" maxLength={500} />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">Full Description</label>
                <textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-24 resize-none" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Category</label>
                <Input value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1" placeholder="e.g. Plumbing, Salon" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <select value={form.status || 'draft'} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Pricing & Billing</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Unit of Measurement</label>
                <select value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {UOM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Price ({'\u20B9'}) *</label>
                <Input type="number" min={0} step={0.01} value={form.price ?? ''} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || undefined })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Duration (minutes)</label>
                <Input type="number" min={0} value={form.duration_minutes ?? ''} onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || undefined })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Service Mode</label>
                <select value={form.service_mode} onChange={(e) => setForm({ ...form, service_mode: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Tax */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Tax Details</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_taxable} onChange={(e) => setForm({ ...form, is_taxable: e.target.checked })} className="rounded" />
                <label className="text-sm text-gray-700">Taxable</label>
              </div>
              {form.is_taxable && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700">GST Rate (%)</label>
                    <select value={form.tax_rate ?? 18} onChange={(e) => setForm({ ...form, tax_rate: parseFloat(e.target.value) })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                      {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">SAC Code</label>
                    <Input value={form.sac_code || ''} onChange={(e) => setForm({ ...form, sac_code: e.target.value })} className="mt-1" placeholder="e.g. 998712" maxLength={8} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Visibility */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_visible} onChange={(e) => setForm({ ...form, is_visible: e.target.checked })} className="rounded" /> Visible to customers
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} className="rounded" /> Featured
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.requires_booking} onChange={(e) => setForm({ ...form, requires_booking: e.target.checked })} className="rounded" /> Requires booking
            </label>
          </div>

          {/* Save */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.price || isSaving}>
              {isSaving ? 'Saving…' : editingId ? 'Update Service' : 'Create Service'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          <p className="text-gray-500 mt-1">Manage your service offerings</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Add Service</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search services…" className="pl-10" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Status</option>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading services…</div>
        ) : data && data.items.length > 0 ? (
          <>
            <TableToolbar
              search=""
              onSearchChange={() => {}}
              hideSearch
              hint="Sorting applies to the current page."
              sortOptions={[
                { value: 'name', label: 'Service' },
                { value: 'category', label: 'Category' },
                { value: 'price', label: 'Price' },
                { value: 'service_mode', label: 'Mode' },
                { value: 'duration_minutes', label: 'Duration' },
                { value: 'status', label: 'Status' },
              ]}
              sortKey={sortKey}
              sortDir={sortDir}
              onSortKeyChange={setSortKey}
              onSortDirChange={setSortDir}
              className="rounded-none border-x-0 border-t-0"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">Service</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Mode</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayServices.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Wrench className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{s.name}</p>
                            {!s.is_visible && <span className="text-xs text-gray-400 flex items-center gap-1"><EyeOff className="w-3 h-3" /> Hidden</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{s.category || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{'\u20B9'}{s.price?.toLocaleString() ?? '—'}</span>
                        {s.uom !== 'fixed' && <span className="text-xs text-gray-400 ml-1">/ {s.uom}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs">
                          <MapPin className="w-3 h-3" />
                          {MODE_OPTIONS.find((m) => m.value === s.service_mode)?.label || s.service_mode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {s.duration_minutes ? <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.duration_minutes}m</span> : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                          s.status === 'active' ? 'bg-green-50 text-green-700' :
                          s.status === 'archived' ? 'bg-gray-100 text-gray-500' :
                          'bg-amber-50 text-amber-700'
                        }`}>{s.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-gray-100" title="Edit">
                            <Edit2 className="w-4 h-4 text-gray-500" />
                          </button>
                          <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded hover:bg-red-50" title="Delete">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <span className="text-sm text-gray-500">Page {page} of {data.pages} ({data.total} services)</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                  <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <Wrench className="w-12 h-12 text-gray-300 mx-auto" />
            <h3 className="text-lg font-medium text-gray-900 mt-4">No services yet</h3>
            <p className="text-gray-500 mt-1">Create your first service to get started.</p>
            <Button onClick={openCreate} className="mt-4 gap-2"><Plus className="w-4 h-4" /> Add Service</Button>
          </div>
        )}
      </div>
    </div>
  )
}
