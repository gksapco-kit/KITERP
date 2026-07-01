import { useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ResizableTable } from '@/components/table/ResizableTable'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { BusinessUnitSelect } from '@/components/common/BusinessUnitSelect'
import { BranchSelect } from '@/components/common/BranchSelect'
import { BRANCH_LABEL } from '@/lib/businessUnitLabels'
import {
  useDivisions, useCreateDivision, useUpdateDivision, useDeleteDivision,
  useDistributionChannels, useCreateDistributionChannel, useUpdateDistributionChannel, useDeleteDistributionChannel,
  useDeliveryChannels, useCreateDeliveryChannel, useUpdateDeliveryChannel, useDeleteDeliveryChannel,
  useSalesAreas, useCreateSalesArea, useDeleteSalesArea,
} from '@/hooks/useVendor'
import type {
  DivisionRecord, DistributionChannelRecord, DistributionChannelType,
  DeliveryChannelRecord, DeliveryChannelMode,
} from '@/api/vendor'
import {
  Loader2, Plus, Pencil, Trash2, X, Layers, Share2, Truck, Grid3x3, Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type TabId = 'divisions' | 'distribution' | 'delivery' | 'sales-areas'

const TABS: { id: TabId; label: string; icon: typeof Layers; hint: string }[] = [
  { id: 'divisions', label: 'Sales Division', icon: Layers, hint: 'Product-line groupings (Food, Apparel, Services…)' },
  { id: 'distribution', label: 'Distribution Channels', icon: Share2, hint: 'How you sell — Retail, Wholesale, Online, B2B…' },
  { id: 'delivery', label: 'Delivery Channels', icon: Truck, hint: 'How orders are fulfilled — own fleet, courier, pickup…' },
  { id: 'sales-areas', label: 'Sales Areas', icon: Grid3x3, hint: 'Business Unit (or Branch) × Distribution Channel × Sales Division' },
]

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={cn(
      'px-2 py-0.5 text-xs rounded-full font-medium',
      active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
    )}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function DefaultBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium bg-amber-100 text-amber-700">
      <Star className="w-3 h-3 fill-current" /> Default
    </span>
  )
}

export default function SalesAreaSetupPage() {
  const [tab, setTab] = useState<TabId>('divisions')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Grid3x3 className="w-7 h-7 text-indigo-600" />
          Sales Area
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure Sales Divisions, Distribution Channels, and Delivery Channels, then combine them into Sales Areas
          scoped to a Business Unit. Sales Organization reuses your existing Business Units.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-1">
        {TABS.map((t) => {
          const Icon = t.icon
          const isActive = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors',
                isActive
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40',
              )}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'divisions' && <DivisionsTab />}
      {tab === 'distribution' && <DistributionChannelsTab />}
      {tab === 'delivery' && <DeliveryChannelsTab />}
      {tab === 'sales-areas' && <SalesAreasTab />}
    </div>
  )
}

// ── Divisions ────────────────────────────────────────────────────────────────

function DivisionsTab() {
  const { data, isLoading } = useDivisions()
  const divisions = data?.divisions ?? []
  const createMut = useCreateDivision()
  const updateMut = useUpdateDivision()
  const deleteMut = useDeleteDivision()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<DivisionRecord | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isDefault, setIsDefault] = useState(false)

  const resetForm = () => {
    setShowForm(false); setEditing(null)
    setCode(''); setName(''); setDescription(''); setIsDefault(false)
  }
  useEscapeToClose(resetForm, showForm)

  const openCreate = () => { resetForm(); setShowForm(true) }
  const openEdit = (d: DivisionRecord) => {
    setEditing(d); setCode(d.code); setName(d.name); setDescription(d.description || ''); setIsDefault(d.is_default)
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !name.trim()) return
    const payload = { code: code.trim(), name: name.trim(), description: description.trim() || undefined, is_default: isDefault }
    if (editing) updateMut.mutate({ id: editing.id, data: payload }, { onSuccess: resetForm })
    else createMut.mutate(payload, { onSuccess: resetForm })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Add Sales Division</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
          ) : (
            <ResizableTable tableId="sd-divisions" defaultWidths={[110, 240, 260, 100, 120]}>
              <thead>
                <tr className="border-b bg-gray-50/80 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3"><TableColumnLabel>Code</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Name</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Description</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Status</TableColumnLabel></th>
                  <th className="px-4 py-3 text-right"><TableColumnLabel>Actions</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {divisions.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">No sales divisions yet.</td></tr>
                ) : divisions.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">{d.code}</td>
                    <td className="px-4 py-3 text-sm font-medium">{d.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{d.description || '—'}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-1.5">{d.is_default ? <DefaultBadge /> : <StatusPill active={d.is_active} />}</div></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(d)}><Pencil className="w-4 h-4" /></Button>
                        <Button
                          variant="ghost" size="sm" className="text-red-500"
                          onClick={() => { if (confirm(`Delete sales division "${d.name}"?`)) deleteMut.mutate(d.id) }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </ResizableTable>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={resetForm}>
          <div className="w-full max-w-md bg-card border border-border text-foreground rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Sales Division' : 'New Sales Division'}</h2>
              <button type="button" aria-label="Close" onClick={resetForm} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Code *</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="FOOD" required maxLength={20} />
                </div>
                <div className="space-y-1.5 flex flex-col justify-end">
                  <label className="flex items-center gap-2 text-sm h-10">
                    <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Set as default
                  </label>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Food & Beverage" required />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional notes" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                  {(createMut.isPending || updateMut.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {editing ? 'Save Changes' : 'Create Sales Division'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Distribution Channels ─────────────────────────────────────────────────────

const DISTRIBUTION_CHANNEL_TYPES: { value: DistributionChannelType; label: string }[] = [
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'online', label: 'Online' },
  { value: 'pos', label: 'POS' },
  { value: 'b2b', label: 'B2B' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'other', label: 'Other' },
]

function DistributionChannelsTab() {
  const { data, isLoading } = useDistributionChannels()
  const channels = data?.distribution_channels ?? []
  const createMut = useCreateDistributionChannel()
  const updateMut = useUpdateDistributionChannel()
  const deleteMut = useDeleteDistributionChannel()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<DistributionChannelRecord | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [channelType, setChannelType] = useState<DistributionChannelType>('retail')
  const [description, setDescription] = useState('')
  const [isDefault, setIsDefault] = useState(false)

  const resetForm = () => {
    setShowForm(false); setEditing(null)
    setCode(''); setName(''); setChannelType('retail'); setDescription(''); setIsDefault(false)
  }
  useEscapeToClose(resetForm, showForm)

  const openCreate = () => { resetForm(); setShowForm(true) }
  const openEdit = (c: DistributionChannelRecord) => {
    setEditing(c); setCode(c.code); setName(c.name); setChannelType(c.channel_type)
    setDescription(c.description || ''); setIsDefault(c.is_default)
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !name.trim()) return
    const payload = { code: code.trim(), name: name.trim(), channel_type: channelType, description: description.trim() || undefined, is_default: isDefault }
    if (editing) updateMut.mutate({ id: editing.id, data: payload }, { onSuccess: resetForm })
    else createMut.mutate(payload, { onSuccess: resetForm })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Add Distribution Channel</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
          ) : (
            <ResizableTable tableId="sd-distribution-channels" defaultWidths={[110, 220, 140, 220, 100, 120]}>
              <thead>
                <tr className="border-b bg-gray-50/80 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3"><TableColumnLabel>Code</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Name</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Type</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Description</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Status</TableColumnLabel></th>
                  <th className="px-4 py-3 text-right"><TableColumnLabel>Actions</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {channels.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">No distribution channels yet.</td></tr>
                ) : channels.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">{c.code}</td>
                    <td className="px-4 py-3 text-sm font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">{c.channel_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{c.description || '—'}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-1.5">{c.is_default ? <DefaultBadge /> : <StatusPill active={c.is_active} />}</div></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                        <Button
                          variant="ghost" size="sm" className="text-red-500"
                          onClick={() => { if (confirm(`Delete distribution channel "${c.name}"?`)) deleteMut.mutate(c.id) }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </ResizableTable>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={resetForm}>
          <div className="w-full max-w-md bg-card border border-border text-foreground rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Distribution Channel' : 'New Distribution Channel'}</h2>
              <button type="button" aria-label="Close" onClick={resetForm} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Code *</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="RET" required maxLength={20} />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={channelType} onChange={(v) => setChannelType(v as DistributionChannelType)} options={DISTRIBUTION_CHANNEL_TYPES} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Retail Stores" required />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional notes" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Set as default
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                  {(createMut.isPending || updateMut.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {editing ? 'Save Changes' : 'Create Channel'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Delivery Channels ──────────────────────────────────────────────────────────

const DELIVERY_CHANNEL_MODES: { value: DeliveryChannelMode; label: string }[] = [
  { value: 'own_fleet', label: 'Own Fleet' },
  { value: 'courier', label: 'Courier' },
  { value: 'pickup', label: 'Customer Pickup' },
  { value: 'third_party', label: 'Third-Party Logistics' },
  { value: 'postal', label: 'Postal' },
  { value: 'other', label: 'Other' },
]

function DeliveryChannelsTab() {
  const { data, isLoading } = useDeliveryChannels()
  const channels = data?.delivery_channels ?? []
  const createMut = useCreateDeliveryChannel()
  const updateMut = useUpdateDeliveryChannel()
  const deleteMut = useDeleteDeliveryChannel()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<DeliveryChannelRecord | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [mode, setMode] = useState<DeliveryChannelMode>('own_fleet')
  const [leadTimeDays, setLeadTimeDays] = useState<string>('')
  const [baseCharge, setBaseCharge] = useState<string>('0')
  const [description, setDescription] = useState('')
  const [isDefault, setIsDefault] = useState(false)

  const resetForm = () => {
    setShowForm(false); setEditing(null)
    setCode(''); setName(''); setMode('own_fleet'); setLeadTimeDays(''); setBaseCharge('0')
    setDescription(''); setIsDefault(false)
  }
  useEscapeToClose(resetForm, showForm)

  const openCreate = () => { resetForm(); setShowForm(true) }
  const openEdit = (c: DeliveryChannelRecord) => {
    setEditing(c); setCode(c.code); setName(c.name); setMode(c.mode)
    setLeadTimeDays(c.lead_time_days != null ? String(c.lead_time_days) : '')
    setBaseCharge(String(c.base_charge ?? 0))
    setDescription(c.description || ''); setIsDefault(c.is_default)
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !name.trim()) return
    const payload = {
      code: code.trim(),
      name: name.trim(),
      mode,
      description: description.trim() || undefined,
      lead_time_days: leadTimeDays.trim() ? Number(leadTimeDays) : undefined,
      base_charge: baseCharge.trim() ? Number(baseCharge) : 0,
      is_default: isDefault,
    }
    if (editing) updateMut.mutate({ id: editing.id, data: payload }, { onSuccess: resetForm })
    else createMut.mutate(payload, { onSuccess: resetForm })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Add Delivery Channel</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
          ) : (
            <ResizableTable tableId="sd-delivery-channels" defaultWidths={[100, 200, 150, 100, 110, 90, 120]}>
              <thead>
                <tr className="border-b bg-gray-50/80 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3"><TableColumnLabel>Code</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Name</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Mode</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Lead time</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Base charge</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Status</TableColumnLabel></th>
                  <th className="px-4 py-3 text-right"><TableColumnLabel>Actions</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {channels.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No delivery channels yet.</td></tr>
                ) : channels.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">{c.code}</td>
                    <td className="px-4 py-3 text-sm font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">{c.mode.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{c.lead_time_days != null ? `${c.lead_time_days}d` : '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{c.base_charge ? `₹${c.base_charge}` : '—'}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-1.5">{c.is_default ? <DefaultBadge /> : <StatusPill active={c.is_active} />}</div></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                        <Button
                          variant="ghost" size="sm" className="text-red-500"
                          onClick={() => { if (confirm(`Delete delivery channel "${c.name}"?`)) deleteMut.mutate(c.id) }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </ResizableTable>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={resetForm}>
          <div className="w-full max-w-md bg-card border border-border text-foreground rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Delivery Channel' : 'New Delivery Channel'}</h2>
              <button type="button" aria-label="Close" onClick={resetForm} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Code *</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="STD" required maxLength={20} />
                </div>
                <div className="space-y-1.5">
                  <Label>Mode</Label>
                  <Select value={mode} onChange={(v) => setMode(v as DeliveryChannelMode)} options={DELIVERY_CHANNEL_MODES} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Delivery" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Lead time (days)</Label>
                  <Input type="number" min="0" value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} placeholder="e.g. 2" />
                </div>
                <div className="space-y-1.5">
                  <Label>Base charge</Label>
                  <Input type="number" min="0" step="0.01" value={baseCharge} onChange={(e) => setBaseCharge(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional notes" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Set as default
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                  {(createMut.isPending || updateMut.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {editing ? 'Save Changes' : 'Create Channel'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sales Areas ────────────────────────────────────────────────────────────────

function formatBusinessUnitLabel(a: { business_unit_code?: string | null; business_unit_name?: string | null }) {
  if (!a.business_unit_name) return '—'
  return a.business_unit_code ? `${a.business_unit_code} — ${a.business_unit_name}` : a.business_unit_name
}

function formatBranchLabel(a: { unit_type?: string; branch_id?: string | null; branch_code?: string | null; branch_name?: string | null }) {
  if (a.unit_type === 'branch' || a.branch_id) {
    if (!a.branch_name) return null
    return a.branch_code ? `${a.branch_code} — ${a.branch_name}` : a.branch_name
  }
  return null
}

function SalesAreaTruncCell({
  children,
  title,
  className,
}: {
  children: React.ReactNode
  title?: string
  className?: string
}) {
  return (
    <td className={cn('px-3 py-2 align-middle', className)}>
      <div className="truncate text-sm" title={title}>{children}</div>
    </td>
  )
}

function SalesAreasTab() {
  const { data, isLoading } = useSalesAreas()
  const areas = data?.sales_areas ?? []
  const { data: divisionsData } = useDivisions()
  const { data: dcData } = useDistributionChannels()
  const divisions = divisionsData?.divisions ?? []
  const distributionChannels = dcData?.distribution_channels ?? []

  const createMut = useCreateSalesArea()
  const deleteMut = useDeleteSalesArea()

  const [showForm, setShowForm] = useState(false)
  const [businessUnitId, setBusinessUnitId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [distributionChannelId, setDistributionChannelId] = useState('')
  const [divisionId, setDivisionId] = useState('')
  const [isDefault, setIsDefault] = useState(false)

  const resetForm = () => {
    setShowForm(false)
    setBusinessUnitId(''); setBranchId(''); setDistributionChannelId(''); setDivisionId(''); setIsDefault(false)
  }
  useEscapeToClose(resetForm, showForm)

  const handleBusinessUnitChange = (id: string) => {
    setBusinessUnitId(id)
    setBranchId('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!businessUnitId || !distributionChannelId || !divisionId) return
    createMut.mutate(
      {
        business_unit_id: businessUnitId,
        branch_id: branchId || undefined,
        distribution_channel_id: distributionChannelId,
        division_id: divisionId,
        is_default: isDefault,
      },
      { onSuccess: resetForm },
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Add Sales Area</Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
          ) : (
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[14%]" />
                <col className="w-[15%]" />
                <col className="w-[13%]" />
                <col className="w-[18%]" />
                <col className="w-[11%]" />
                <col className="w-[5%]" />
              </colgroup>
              <thead>
                <tr className="border-b bg-gray-50/80 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2"><TableColumnLabel>Business Unit</TableColumnLabel></th>
                  <th className="px-3 py-2"><TableColumnLabel>{BRANCH_LABEL}</TableColumnLabel></th>
                  <th className="px-3 py-2"><TableColumnLabel>Dist. Channel</TableColumnLabel></th>
                  <th className="px-3 py-2"><TableColumnLabel>Division</TableColumnLabel></th>
                  <th className="px-3 py-2"><TableColumnLabel>Code</TableColumnLabel></th>
                  <th className="px-3 py-2"><TableColumnLabel>Status</TableColumnLabel></th>
                  <th className="px-3 py-2 text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {areas.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-12 text-center text-sm text-gray-400">
                    No sales areas yet. Combine a Business Unit (optionally a Branch), Distribution Channel, and Sales Division above.
                  </td></tr>
                ) : areas.map((a) => {
                  const buLabel = formatBusinessUnitLabel(a)
                  const branchLabel = formatBranchLabel(a)
                  return (
                    <tr key={a.id} className="hover:bg-gray-50/80">
                      <SalesAreaTruncCell title={buLabel} className="font-medium text-foreground">
                        {buLabel}
                      </SalesAreaTruncCell>
                      <td className="px-3 py-2 align-middle">
                        {branchLabel ? (
                          <span
                            className="inline-flex max-w-full items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700 truncate"
                            title={branchLabel}
                          >
                            {branchLabel}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">All branches</span>
                        )}
                      </td>
                      <SalesAreaTruncCell title={a.distribution_channel_name || undefined}>
                        {a.distribution_channel_name || '—'}
                      </SalesAreaTruncCell>
                      <SalesAreaTruncCell title={a.division_name || undefined}>
                        {a.division_name || '—'}
                      </SalesAreaTruncCell>
                      <SalesAreaTruncCell title={a.code || undefined} className="font-mono text-gray-500">
                        {a.code || '—'}
                      </SalesAreaTruncCell>
                      <td className="px-3 py-2 align-middle">
                        <div className="flex items-center">{a.is_default ? <DefaultBadge /> : <StatusPill active={a.is_active} />}</div>
                      </td>
                      <td className="px-2 py-2 text-right align-middle">
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-red-500 shrink-0"
                          aria-label="Delete sales area"
                          onClick={() => { if (confirm('Delete this sales area?')) deleteMut.mutate(a.id) }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={resetForm}>
          <div className="w-full max-w-md bg-card border border-border text-foreground rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">New Sales Area</h2>
              <button type="button" aria-label="Close" onClick={resetForm} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label>Business Unit (Sales Organization) *</Label>
                <BusinessUnitSelect value={businessUnitId} onChange={handleBusinessUnitChange} />
              </div>
              <div className="space-y-1.5">
                <Label>{BRANCH_LABEL} (optional)</Label>
                <BranchSelect
                  businessUnitId={businessUnitId}
                  value={branchId}
                  onChange={setBranchId}
                  allowAll
                />
                <p className="text-xs text-muted-foreground">
                  Leave as all branches to scope the sales area to the business unit. Pick a branch for branch-level sales areas.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Distribution Channel *</Label>
                <Select
                  value={distributionChannelId}
                  onChange={setDistributionChannelId}
                  options={distributionChannels.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
                  placeholder="Select a distribution channel…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sales Division *</Label>
                <Select
                  value={divisionId}
                  onChange={setDivisionId}
                  options={divisions.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
                  placeholder="Select a sales division…"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Set as default
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit" disabled={createMut.isPending || !businessUnitId || !distributionChannelId || !divisionId}>
                  {createMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Create Sales Area
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
