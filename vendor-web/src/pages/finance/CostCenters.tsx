import { useState, useMemo } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Link } from 'react-router-dom'
import {
  useCompanies,
  useCostCenters, useCreateCostCenter, useUpdateCostCenter, useDeleteCostCenter,
} from '@/hooks/useFinance'
import type { CostCenter } from '@/types/finance'
import {
  Building2, Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  Search, X, Layers, Tag, MoreVertical, Check, Loader2, ExternalLink,
  Clock, Info, Hash, Calendar, ShieldCheck, FileText,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Constants ─────────────────────────────────────────────────────────────────

const CC_GROUPS = [
  'Operations',
  'Sales & Marketing',
  'Finance & Accounting',
  'Human Resources',
  'Information Technology',
  'Manufacturing',
  'Procurement',
  'Research & Development',
  'Administration',
  'Customer Support',
  'Logistics',
  'Other',
]

const GROUP_COLORS: Record<string, string> = {
  'Operations':               'bg-blue-100 text-blue-700 border-blue-200',
  'Sales & Marketing':        'bg-green-100 text-green-700 border-green-200',
  'Finance & Accounting':     'bg-primary/10 text-primary border-primary/30',
  'Human Resources':          'bg-pink-100 text-pink-700 border-pink-200',
  'Information Technology':   'bg-cyan-100 text-cyan-700 border-cyan-200',
  'Manufacturing':            'bg-amber-100 text-amber-700 border-amber-200',
  'Procurement':              'bg-orange-100 text-orange-700 border-orange-200',
  'Research & Development':   'bg-teal-100 text-teal-700 border-teal-200',
  'Administration':           'bg-slate-100 text-slate-700 border-slate-200',
  'Customer Support':         'bg-rose-100 text-rose-700 border-rose-200',
  'Logistics':                'bg-lime-100 text-lime-700 border-lime-200',
  'Other':                    'bg-gray-100 text-gray-600 border-gray-200',
}

const groupBadge = (g?: string) =>
  g ? (GROUP_COLORS[g] ?? 'bg-gray-100 text-gray-600 border-gray-200') : 'bg-gray-100 text-gray-400 border-gray-200'

function fmtDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CCForm {
  company_id: string
  code: string
  name: string
  description: string
  cc_group: string
}

const EMPTY_FORM: CCForm = {
  company_id: '', code: '', name: '', description: '', cc_group: '',
}

type DialogTab = 'details' | 'info'

// ── Main component ─────────────────────────────────────────────────────────────

export default function CostCenters() {
  const { data: companies = [], isLoading: coLoading } = useCompanies()

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // Resolve the currently displayed company (default first if none selected)
  const activeCompanyId = selectedCompanyId
    || companies.find(c => c.is_default)?.id
    || companies[0]?.id
    || ''

  const { data: allCC = [], isLoading: ccLoading } = useCostCenters(activeCompanyId || undefined)
  const createCC = useCreateCostCenter()
  const updateCC = useUpdateCostCenter()
  const deleteCC = useDeleteCostCenter()

  // ── Dialog state ──
  const [ccDialog, setCcDialog] = useState<{ open: boolean; editing?: CostCenter }>({ open: false })
  useEscapeToClose(() => setCcDialog({ open: false }), ccDialog.open)
  const [ccForm, setCcForm] = useState<CCForm>(EMPTY_FORM)
  const [dialogTab, setDialogTab] = useState<DialogTab>('details')
  const [actionMenu, setActionMenu] = useState<string | null>(null)

  // ── Derived data ──
  const filtered = useMemo(() => {
    let list = allCC.filter(cc => cc.is_active)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(cc =>
        cc.name.toLowerCase().includes(q) ||
        cc.code.toLowerCase().includes(q) ||
        (cc.description || '').toLowerCase().includes(q) ||
        (cc.cc_group || '').toLowerCase().includes(q)
      )
    }
    if (filterGroup) list = list.filter(cc => cc.cc_group === filterGroup)
    return list
  }, [allCC, search, filterGroup])

  const usedGroups = useMemo(() =>
    [...new Set(allCC.filter(cc => cc.is_active && cc.cc_group).map(cc => cc.cc_group!))]
  , [allCC])

  const grouped = useMemo(() => {
    const groups: Record<string, CostCenter[]> = {}
    filtered.forEach(cc => {
      const g = cc.cc_group || 'Ungrouped'
      if (!groups[g]) groups[g] = []
      groups[g].push(cc)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  // ── Handlers ──

  function openNewCC() {
    setCcForm({ ...EMPTY_FORM })
    setDialogTab('details')
    setCcDialog({ open: true })
  }

  function openEditCC(cc: CostCenter) {
    setCcForm({
      company_id: cc.company_id,
      code: cc.code,
      name: cc.name,
      description: cc.description || '',
      cc_group: cc.cc_group || '',
    })
    setDialogTab('details')
    setCcDialog({ open: true, editing: cc })
    setActionMenu(null)
  }

  async function saveCC() {
    if (!ccForm.code.trim() || !ccForm.name.trim()) {
      toast.error('Cost Center Code and Name are required')
      return
    }
    const payload: Record<string, unknown> = {
      code: ccForm.code.trim().toUpperCase(),
      name: ccForm.name.trim(),
      description: ccForm.description.trim() || null,
      cc_group: ccForm.cc_group || null,
      parent_id: null,
    }
    // company_id is optional — backend auto-resolves to default company if omitted
    if (ccForm.company_id) payload.company_id = ccForm.company_id

    try {
      if (ccDialog.editing) {
        await updateCC.mutateAsync({ id: ccDialog.editing.id, data: payload })
        toast.success('Cost center updated')
      } else {
        await createCC.mutateAsync(payload)
        toast.success('Cost center created')
      }
      setCcDialog({ open: false })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err?.response?.data?.detail || 'Failed to save cost center')
    }
  }

  async function deleteOne(cc: CostCenter) {
    if (!confirm(`Deactivate cost center "${cc.name}"?`)) return
    try {
      await deleteCC.mutateAsync(cc.id)
      toast.success('Cost center deactivated')
    } catch {
      toast.error('Failed to deactivate')
    }
    setActionMenu(null)
  }

  const isSaving = createCC.isPending || updateCC.isPending

  // ── Render ──

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" />
            Cost Centers
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage Cost Centers Grouped By Department And Assigned To Business Units
          </p>
        </div>
        <button
          onClick={openNewCC}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> New Cost Center
        </button>
      </div>

      {/* Business units strip */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-gray-400" />
            Business Units
            <span className="text-xs font-normal text-gray-400 ml-1">({companies.length})</span>
          </h2>
          <Link
            to="/stores"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> Manage in Business Units
          </Link>
        </div>
        {coLoading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCompanyId('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                !selectedCompanyId
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40'
              }`}
            >
              All Companies
            </button>
            {companies.map(co => (
              <button
                key={co.id}
                onClick={() => setSelectedCompanyId(co.id === activeCompanyId && selectedCompanyId ? '' : co.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  co.id === activeCompanyId && selectedCompanyId
                    ? 'bg-primary/10 text-primary border-primary/40'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="font-mono font-bold">{co.code}</span>
                <span>{co.name}</span>
                {co.is_default && (
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-1 rounded">Default</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active company context */}
      {activeCompanyId && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Showing cost centers for:</span>
          <span className="font-semibold text-gray-800">
            {companies.find(c => c.id === activeCompanyId)?.name || 'All'}
          </span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">{allCC.filter(c => c.is_active).length} active</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search cost centers…"
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {search && (
            <button type="button" aria-label="Close" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-700" />
            </button>
          )}
        </div>

        <select
          value={filterGroup}
          onChange={e => setFilterGroup(e.target.value)}
          className="h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Groups</option>
          {usedGroups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        {(search || filterGroup) && (
          <button type="button" aria-label="Close"
            onClick={() => { setSearch(''); setFilterGroup('') }}
            className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1"
          >
                <X className="w-3 h-3" /> Clear filters
          </button>
        )}
      </div>

      {/* Loading */}
      {ccLoading && (
        <div className="flex items-center gap-2 py-10 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading cost centers…</span>
        </div>
      )}

      {/* Empty state */}
      {!ccLoading && filtered.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-14 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Layers className="w-6 h-6 text-primary/60" />
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">
            {search || filterGroup ? 'No cost centers match your filter' : 'No cost centers yet'}
          </p>
          {!search && !filterGroup && (
            <button onClick={openNewCC} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90">
              <Plus className="w-4 h-4" /> Create first cost center
            </button>
          )}
        </div>
      )}

      {/* Grouped cards */}
      <div className="space-y-4">
        {grouped.map(([groupName, items]) => {
          const isCollapsed = collapsed[groupName]
          const badgeCls = groupBadge(groupName === 'Ungrouped' ? undefined : groupName)
          return (
            <div key={groupName} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Group header */}
              <button
                type="button"
                onClick={() => setCollapsed(c => ({ ...c, [groupName]: !isCollapsed }))}
                className="w-full flex items-center gap-3 px-5 py-3 bg-gray-50/60 border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                {isCollapsed
                  ? <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                <Tag className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="font-semibold text-sm text-gray-700 flex-1 text-left">{groupName}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${badgeCls}`}>
                  {items.length} center{items.length !== 1 ? 's' : ''}
                </span>
              </button>

              {/* Rows */}
              {!isCollapsed && (
                <div className="divide-y divide-gray-100">
                  {items.map(cc => (
                    <CCRow
                      key={cc.id}
                      cc={cc}
                      allCC={allCC}
                      actionMenu={actionMenu}
                      onSetMenu={setActionMenu}
                      onEdit={openEditCC}
                      onDelete={deleteOne}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Cost Center dialog ── */}
      {ccDialog.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setCcDialog({ open: false })}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="font-semibold text-gray-900 text-base">
                  {ccDialog.editing ? 'Edit Cost Center' : 'New Cost Center'}
                </h2>
                {ccDialog.editing && (
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">{ccDialog.editing.code}</p>
                )}
              </div>
              <button type="button" aria-label="Close" onClick={() => setCcDialog({ open: false })} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-6 shrink-0">
              {([
                { id: 'details', label: 'Details', icon: FileText },
                { id: 'info', label: 'Info & History', icon: Clock },
              ] as { id: DialogTab; label: string; icon: React.ComponentType<{ className?: string }> }[]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDialogTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    dialogTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Body — scrollable */}
            <div className="overflow-y-auto flex-1">

              {/* ── Details tab ── */}
              {dialogTab === 'details' && (
                <div className="px-6 py-5 space-y-5">

                  {/* Cost Center Code + Group — side by side */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">
                        Cost Center Code <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          value={ccForm.code}
                          onChange={e => setCcForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                          maxLength={20}
                          placeholder="e.g. OPS-01"
                          className="w-full h-10 pl-8 pr-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">
                        Department Group
                      </label>
                      <select
                        value={ccForm.cc_group}
                        onChange={e => setCcForm(f => ({ ...f, cc_group: e.target.value }))}
                        className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">— No group —</option>
                        {CC_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">
                      Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={ccForm.name}
                      onChange={e => setCcForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Operations — North Region"
                      className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">
                      Description
                    </label>
                    <textarea
                      value={ccForm.description}
                      onChange={e => setCcForm(f => ({ ...f, description: e.target.value }))}
                      rows={3}
                      placeholder="Optional — purpose, scope, or responsible team…"
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>

                  {/* Business unit — optional */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                      Business Unit
                      <span className="text-xs font-normal text-gray-400 normal-case tracking-normal">(optional)</span>
                    </label>
                    <select
                      value={ccForm.company_id}
                      onChange={e => setCcForm(f => ({ ...f, company_id: e.target.value }))}
                      className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">— Auto (uses default company) —</option>
                      {companies.map(co => (
                        <option key={co.id} value={co.id}>{co.code} — {co.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      Leave blank to automatically use the default business unit.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Info & History tab ── */}
              {dialogTab === 'info' && ccDialog.editing && (
                <div className="px-6 py-5 space-y-5">

                  {/* Key fields */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        icon: Hash,
                        label: 'Cost Center Code',
                        value: ccDialog.editing.code,
                        mono: true,
                      },
                      {
                        icon: ShieldCheck,
                        label: 'Status',
                        value: ccDialog.editing.is_active ? 'Active' : 'Inactive',
                        cls: ccDialog.editing.is_active
                          ? 'text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-xs font-medium'
                          : 'text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full text-xs font-medium',
                      },
                      {
                        icon: Building2,
                        label: 'Business unit',
                        value: companies.find(c => c.id === ccDialog.editing!.company_id)
                          ? `${companies.find(c => c.id === ccDialog.editing!.company_id)!.code} — ${companies.find(c => c.id === ccDialog.editing!.company_id)!.name}`
                          : ccDialog.editing.company_id.slice(0, 8) + '…',
                      },
                      {
                        icon: Tag,
                        label: 'Department Group',
                        value: ccDialog.editing.cc_group || '—',
                      },
                    ].map(({ icon: Icon, label, value, mono, cls }) => (
                      <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                          <Icon className="w-3 h-3" />
                          {label}
                        </div>
                        {cls
                          ? <span className={cls}>{value}</span>
                          : <p className={`text-sm font-medium text-gray-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
                        }
                      </div>
                    ))}
                  </div>

                  {/* ID */}
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                      <Info className="w-3 h-3" /> System ID
                    </div>
                    <p className="font-mono text-xs text-gray-500 break-all">{ccDialog.editing.id}</p>
                  </div>

                  {/* Timestamps */}
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Activity Log
                    </h3>
                    <div className="space-y-0 relative">
                      <div className="absolute left-[11px] top-3 bottom-3 w-px bg-gray-200" />
                      {[
                        {
                          label: 'Created',
                          date: ccDialog.editing.created_at,
                          icon: Calendar,
                          color: 'bg-primary/15 text-primary',
                        },
                        {
                          label: 'Last Modified',
                          date: (ccDialog.editing as CostCenter & { updated_at?: string }).updated_at,
                          icon: Pencil,
                          color: 'bg-amber-100 text-amber-600',
                        },
                      ].map(({ label, date, icon: Icon, color }) => (
                        <div key={label} className="flex items-start gap-3 py-2.5 pl-1">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${color} relative z-10`}>
                            <Icon className="w-2.5 h-2.5" />
                          </span>
                          <div>
                            <p className="text-xs font-medium text-gray-700">{label}</p>
                            <p className="text-xs text-gray-400">{fmtDate(date)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Description (read-only) */}
                  {ccDialog.editing.description && (
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                        <FileText className="w-3 h-3" /> Description
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{ccDialog.editing.description}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Info tab when creating new */}
              {dialogTab === 'info' && !ccDialog.editing && (
                <div className="px-6 py-10 text-center text-gray-400">
                  <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">History will be available after the cost center is created.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl shrink-0">
              <button
                onClick={() => setCcDialog({ open: false })}
                className="btn-cancel px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveCC}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-5 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium transition-colors"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {ccDialog.editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ── Row component ──────────────────────────────────────────────────────────────

function CCRow({
  cc, allCC, actionMenu, onSetMenu, onEdit, onDelete,
}: {
  cc: CostCenter
  allCC: CostCenter[]
  actionMenu: string | null
  onSetMenu: (id: string | null) => void
  onEdit: (cc: CostCenter) => void
  onDelete: (cc: CostCenter) => void
}) {
  const badgeCls = groupBadge(cc.cc_group)

  return (
    <div className="group flex items-center gap-4 px-5 py-3 hover:bg-gray-50/50 transition-colors">
      {/* Code pill */}
      <div className="w-28 shrink-0">
        <span className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded-lg">
          {cc.code}
        </span>
      </div>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{cc.name}</p>
        {cc.description && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{cc.description}</p>
        )}
        {cc.parent_id && (
          <p className="text-xs text-gray-400 mt-0.5">
            ↳ Under: {allCC.find(c => c.id === cc.parent_id)?.name || cc.parent_id.slice(0, 8)}
          </p>
        )}
      </div>

      {/* Group badge */}
      <div className="shrink-0 w-44">
        {cc.cc_group ? (
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${badgeCls}`}>
            <Tag className="w-2.5 h-2.5" />
            {cc.cc_group}
          </span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </div>

      {/* Actions */}
      <div className="relative shrink-0 flex items-center gap-1">
        <button
          type="button"
          onClick={() => onEdit(cc)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onSetMenu(actionMenu === cc.id ? null : cc.id)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {actionMenu === cc.id && (
          <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-xl shadow-xl w-36 py-1 text-sm">
            <button
              onClick={() => onEdit(cc)}
              className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-50 text-gray-700"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              onClick={() => onDelete(cc)}
              className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-red-50 text-red-600"
            >
              <Trash2 className="w-3.5 h-3.5" /> Deactivate
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
