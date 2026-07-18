import { useState, useMemo, useEffect } from 'react'
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
import { Input } from '@/components/ui/input'
import { askConfirm } from '@/components/common/ConfirmProvider'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'

// ── Constants ─────────────────────────────────────────────────────────────────

const fieldSelect =
  'h-9 px-3 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background'
const fieldInput =
  'border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background'

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
  'Operations':               'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  'Sales & Marketing':        'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800',
  'Finance & Accounting':     'bg-primary/10 text-primary border-primary/30 dark:bg-primary/15 dark:border-primary/40',
  'Human Resources':          'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950/50 dark:text-pink-300 dark:border-pink-800',
  'Information Technology':   'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800',
  'Manufacturing':            'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  'Procurement':              'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800',
  'Research & Development':   'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800',
  'Administration':           'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-600',
  'Customer Support':         'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
  'Logistics':                'bg-lime-100 text-lime-700 border-lime-200 dark:bg-lime-950/50 dark:text-lime-300 dark:border-lime-800',
  'Other':                    'bg-muted text-muted-foreground border-border',
}

const groupBadge = (g?: string) =>
  g ? (GROUP_COLORS[g] ?? 'bg-muted text-muted-foreground border-border') : 'bg-muted/60 text-muted-foreground border-border'

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
  const [ccForm, setCcForm] = useState<CCForm>(EMPTY_FORM)
  const [dialogTab, setDialogTab] = useState<DialogTab>('details')
  const [actionMenu, setActionMenu] = useState<string | null>(null)

  useEffect(() => {
    if (!actionMenu) return
    const close = () => setActionMenu(null)
    document.addEventListener('click', close)
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [actionMenu])

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
    if (!(await askConfirm(`Deactivate cost center "${cc.name}"?`))) return
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
    <div className="mx-auto max-w-6xl space-y-3 p-3 md:p-4">

      {/* Page header — title already shown in the top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          Grouped by department and assigned to business units
        </p>
        <button
          type="button"
          onClick={openNewCC}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> New Cost Center
        </button>
      </div>

      {/* Business units strip */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            Business Units
            <span className="text-xs font-normal text-muted-foreground ml-1">({companies.length})</span>
          </h2>
          <Link
            to="/stores"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> Manage in Business Units
          </Link>
        </div>
        {coLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCompanyId('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                !selectedCompanyId
                  ? 'bg-primary text-white border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
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
                    : 'bg-background text-muted-foreground border-border hover:border-border hover:text-foreground'
                }`}
              >
                <span className="font-mono font-bold">{co.code}</span>
                <span>{co.name}</span>
                {co.is_default && (
                  <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 px-1 rounded">Default</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active company context */}
      {activeCompanyId && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Showing cost centers for:</span>
          <span className="font-semibold text-foreground">
            {companies.find(c => c.id === activeCompanyId)?.name || 'All'}
          </span>
          <span className="text-muted-foreground/60">·</span>
          <span className="text-muted-foreground">{allCC.filter(c => c.is_active).length} active</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-[1]" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search cost centers…"
            className="pl-9 pr-8 bg-background"
          />
          {search && (
            <button type="button" aria-label="Close" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 z-[1]">
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        <select
          value={filterGroup}
          onChange={e => setFilterGroup(e.target.value)}
          className={fieldSelect}
        >
          <option value="">All Groups</option>
          {usedGroups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        {(search || filterGroup) && (
          <button type="button" aria-label="Close"
            onClick={() => { setSearch(''); setFilterGroup('') }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
                <X className="w-3 h-3" /> Clear filters
          </button>
        )}
      </div>

      {/* Loading */}
      {ccLoading && (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading cost centers…</span>
        </div>
      )}

      {/* Empty state */}
      {!ccLoading && filtered.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-border py-14 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Layers className="w-6 h-6 text-primary/60" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">
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
            <div key={groupName} className="bg-card rounded-xl border border-border">
              {/* Group header */}
              <button
                type="button"
                onClick={() => setCollapsed(c => ({ ...c, [groupName]: !isCollapsed }))}
                className="w-full flex items-center gap-3 px-5 py-3 bg-muted/30 border-b border-border hover:bg-muted/50 transition-colors"
              >
                {isCollapsed
                  ? <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-semibold text-sm text-foreground flex-1 text-left">{groupName}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${badgeCls}`}>
                  {items.length} center{items.length !== 1 ? 's' : ''}
                </span>
              </button>

              {/* Rows */}
              {!isCollapsed && (
                <div className="divide-y divide-border">
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
        <ModalOverlay onClose={() => setCcDialog({ open: false })} className="z-[100] bg-black/60 p-3">
          <ModalPanel className="max-w-lg max-h-[calc(100dvh-1.5rem)] !rounded-lg overflow-hidden">
            <ModalHeader
              title={
                <div className="min-w-0">
                  <h2 className="text-base font-semibold leading-none text-foreground">
                    {ccDialog.editing ? 'Edit Cost Center' : 'New Cost Center'}
                  </h2>
                  {ccDialog.editing && (
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{ccDialog.editing.code}</p>
                  )}
                </div>
              }
              onClose={() => setCcDialog({ open: false })}
              className="border-0 px-4 py-2.5"
            />

            {/* Tabs */}
            <div className="flex shrink-0 gap-1 px-4">
              {([
                { id: 'details', label: 'Details', icon: FileText },
                { id: 'info', label: 'Info & History', icon: Clock },
              ] as { id: DialogTab; label: string; icon: React.ComponentType<{ className?: string }> }[]).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDialogTab(tab.id)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    dialogTab === tab.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            <ModalBody className="overflow-y-auto px-0 pt-1">

              {/* ── Details tab ── */}
              {dialogTab === 'details' && (
                <div className="px-6 py-5 space-y-5">

                  {/* Cost Center Code + Group — side by side */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wide">
                        Cost Center Code <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                          value={ccForm.code}
                          onChange={e => setCcForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                          maxLength={20}
                          placeholder="e.g. OPS-01"
                          className={`w-full h-10 pl-8 pr-3 text-sm rounded-lg font-mono ${fieldInput}`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wide">
                        Department Group
                      </label>
                      <select
                        value={ccForm.cc_group}
                        onChange={e => setCcForm(f => ({ ...f, cc_group: e.target.value }))}
                        className={`w-full h-10 px-3 text-sm rounded-lg ${fieldSelect}`}
                      >
                        <option value="">— No group —</option>
                        {CC_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wide">
                      Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={ccForm.name}
                      onChange={e => setCcForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Operations — North Region"
                      className={`w-full h-10 px-3 text-sm rounded-lg ${fieldInput}`}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wide">
                      Description
                    </label>
                    <textarea
                      value={ccForm.description}
                      onChange={e => setCcForm(f => ({ ...f, description: e.target.value }))}
                      rows={3}
                      placeholder="Optional — purpose, scope, or responsible team…"
                      className={`w-full px-3 py-2.5 text-sm rounded-lg resize-none ${fieldInput}`}
                    />
                  </div>

                  {/* Business unit — optional */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                      Business Unit
                      <span className="text-xs font-normal text-muted-foreground normal-case tracking-normal">(optional)</span>
                    </label>
                    <select
                      value={ccForm.company_id}
                      onChange={e => setCcForm(f => ({ ...f, company_id: e.target.value }))}
                      className={`w-full h-10 px-3 text-sm rounded-lg ${fieldSelect}`}
                    >
                      <option value="">— Auto (uses default company) —</option>
                      {companies.map(co => (
                        <option key={co.id} value={co.id}>{co.code} — {co.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
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
                          ? 'text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800 px-2 py-0.5 rounded-full text-xs font-medium'
                          : 'text-red-600 bg-red-50 border border-red-200 dark:text-red-300 dark:bg-red-950/40 dark:border-red-800 px-2 py-0.5 rounded-full text-xs font-medium',
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
                      <div key={label} className="bg-muted/40 rounded-xl p-3 border border-border">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                          <Icon className="w-3 h-3" />
                          {label}
                        </div>
                        {cls
                          ? <span className={cls}>{value}</span>
                          : <p className={`text-sm font-medium text-foreground ${mono ? 'font-mono' : ''}`}>{value}</p>
                        }
                      </div>
                    ))}
                  </div>

                  {/* ID */}
                  <div className="bg-muted/40 rounded-xl p-3 border border-border">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                      <Info className="w-3 h-3" /> System ID
                    </div>
                    <p className="font-mono text-xs text-muted-foreground break-all">{ccDialog.editing.id}</p>
                  </div>

                  {/* Timestamps */}
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Activity Log
                    </h3>
                    <div className="space-y-0 relative">
                      <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border" />
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
                          color: 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300',
                        },
                      ].map(({ label, date, icon: Icon, color }) => (
                        <div key={label} className="flex items-start gap-3 py-2.5 pl-1">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${color} relative z-10`}>
                            <Icon className="w-2.5 h-2.5" />
                          </span>
                          <div>
                            <p className="text-xs font-medium text-foreground">{label}</p>
                            <p className="text-xs text-muted-foreground">{fmtDate(date)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Description (read-only) */}
                  {ccDialog.editing.description && (
                    <div className="bg-muted/40 rounded-xl p-3 border border-border">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                        <FileText className="w-3 h-3" /> Description
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{ccDialog.editing.description}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Info tab when creating new */}
              {dialogTab === 'info' && !ccDialog.editing && (
                <div className="px-6 py-10 text-center text-muted-foreground">
                  <Clock className="mx-auto mb-3 h-10 w-10 opacity-30" />
                  <p className="text-sm">History will be available after the cost center is created.</p>
                </div>
              )}
            </ModalBody>

            <ModalFooter className="border-0 px-4 py-2.5">
              <button
                type="button"
                onClick={() => setCcDialog({ open: false })}
                className="btn-cancel h-8 rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCC}
                disabled={isSaving}
                className="btn-focus-solid flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {ccDialog.editing ? 'Update' : 'Create'}
              </button>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
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
    <div className="group flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
      {/* Code pill */}
      <div className="w-28 shrink-0">
        <span className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded-lg">
          {cc.code}
        </span>
      </div>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{cc.name}</p>
        {cc.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{cc.description}</p>
        )}
        {cc.parent_id && (
          <p className="text-xs text-muted-foreground mt-0.5">
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
          <span className="text-xs text-muted-foreground/50">—</span>
        )}
      </div>

      {/* Actions */}
      <div className="relative shrink-0 flex items-center gap-1">
        <button
          type="button"
          onClick={() => onEdit(cc)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onSetMenu(actionMenu === cc.id ? null : cc.id)
          }}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="More options"
          aria-expanded={actionMenu === cc.id}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {actionMenu === cc.id && (
          <div
            className="absolute right-0 top-8 z-50 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl w-36 py-1 text-sm"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onEdit(cc)}
              className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted text-foreground"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(cc)}
              className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-red-500/10 text-red-600 dark:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" /> Deactivate
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
