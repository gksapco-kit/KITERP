import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  GitBranch, RotateCcw, Save, CheckCircle2, AlertCircle,
  Info, SlidersHorizontal, Plus, Pencil, Trash2, Play,
  ShieldCheck, Lock, Unlock, X,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import {
  WF_PR_FIELDS, WF_PO_FIELDS, WF_INVOICE_FIELDS, type DocType,
} from '@/lib/procurementFieldCatalog'
import { DocTypeFieldList } from '@/components/procurement/FieldStatusEditor'
import { useProcurementFieldConfig } from '@/hooks/useProcurementFieldConfig'
import { vendorApi } from '@/api/vendor'
import type { ApproverRule, ApproverRuleIn } from '@/api/vendor'
import { useTeamMembers, useStores, usePlants, useRoles } from '@/hooks/useVendor'
import { useCompanies } from '@/hooks/useFinance'

// ─────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────

type MatrixDocType = 'PR' | 'PO' | 'INVOICE'
type WfTab = 'WF_PR' | 'WF_PO' | 'WF_INVOICE'
type PageTab = 'visibility' | 'matrix'

const DOC_OPTIONS = [
  { value: 'PR',      label: 'Purchase Requisition (PR)' },
  { value: 'PO',      label: 'Purchase Order (PO)' },
  { value: 'INVOICE', label: 'Vendor Invoice' },
]

const MATERIAL_TYPE_OPTIONS = [
  { value: 'finished',       label: 'Finished Goods' },
  { value: 'raw_material',   label: 'Raw Material' },
  { value: 'semi_finished',  label: 'Semi-Finished' },
  { value: 'trading',        label: 'Trading Goods' },
  { value: 'services',       label: 'Services' },
  { value: 'consumable',     label: 'Consumable' },
  { value: 'asset',          label: 'Asset' },
]

const WF_TABS: { value: WfTab; label: string }[] = [
  { value: 'WF_PR',      label: 'Purchase Requisition (PR)' },
  { value: 'WF_PO',      label: 'Purchase Order (PO)' },
  { value: 'WF_INVOICE', label: 'Vendor Invoice' },
]

const WF_FIELDS: Record<WfTab, typeof WF_PR_FIELDS> = {
  WF_PR:      WF_PR_FIELDS,
  WF_PO:      WF_PO_FIELDS,
  WF_INVOICE: WF_INVOICE_FIELDS,
}

function useApproverDimensionOptions() {
  const { data: companies = [] } = useCompanies()
  const { data: storesData } = useStores({ include_branches: true })
  const { data: plantsData } = usePlants(null)
  const stores = storesData?.stores ?? []

  const companyOptions = useMemo(
    () =>
      companies
        .filter(c => c.is_active !== false)
        .map(c => ({
          value: c.id,
          label: c.code ? `${c.code} — ${c.name}` : c.name,
        })),
    [companies],
  )

  const branchOptions = useMemo(
    () =>
      stores
        .filter(s => s.is_active !== false)
        .map(s => ({
          value: s.id,
          label: s.code ? `${s.code} — ${s.name}` : s.name,
          group: s.unit_type === 'branch' || s.parent_id ? 'Branches' : 'Business units',
        })),
    [stores],
  )

  const plantOptions = useMemo(() => {
    const plants = plantsData?.plants ?? []
    const showStore = stores.length > 1
    return plants
      .filter(p => p.is_active !== false)
      .map(p => {
        const store = stores.find(s => s.id === p.store_id)
        const storeLabel = store
          ? (store.code ? `${store.name} (${store.code})` : store.name)
          : undefined
        return {
          value: p.id,
          label: p.code ? `${p.name} (${p.code})` : p.name,
          hint: showStore ? storeLabel : undefined,
        }
      })
  }, [plantsData, stores])

  return { companyOptions, branchOptions, plantOptions }
}

function MaterialTypesMultiSelect({
  values,
  onChange,
  className,
}: {
  values: string[]
  onChange: (next: string[]) => void
  className?: string
}) {
  const selected = new Set(values)
  const remaining = MATERIAL_TYPE_OPTIONS.filter(o => !selected.has(o.value))
  return (
    <div>
      <Select
        value=""
        onChange={v => {
          if (v && !selected.has(v)) onChange([...values, v])
        }}
        options={remaining}
        searchable
        searchPlaceholder="Search type…"
        placeholder={values.length ? 'Add type…' : 'Any'}
        disabled={remaining.length === 0}
        className={className}
      />
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {values.map(v => (
            <span
              key={v}
              className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-1.5 py-0.5 text-[10px] leading-tight"
            >
              {MATERIAL_TYPE_OPTIONS.find(o => o.value === v)?.label ?? v}
              <button
                type="button"
                className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 p-0.5"
                onClick={() => onChange(values.filter(x => x !== v))}
                aria-label={`Remove ${v}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
//  Rule form dialog / inline form
// ─────────────────────────────────────────────────────────────────

const EMPTY_RULE: ApproverRuleIn = {
  doc_type: 'PO',
  company_id: null, branch_id: null, plant_id: null, material_type: null,
  min_amount: null, max_amount: null,
  level: 1,
  approver_id: null, approver_role_id: null,
  lock_chain: false, is_active: true,
}

interface RuleFormProps {
  initial: ApproverRuleIn
  onSave: (data: ApproverRuleIn) => void
  onCancel: () => void
  isSaving: boolean
}

function RuleForm({ initial, onSave, onCancel, isSaving }: RuleFormProps) {
  const [form, setForm] = useState<ApproverRuleIn>(initial)
  const { data: teamData } = useTeamMembers({ size: 200 })
  const members = (teamData?.items ?? []).filter(m => m.is_active)
  const { data: rolesData } = useRoles()
  const { companyOptions, branchOptions, plantOptions } = useApproverDimensionOptions()

  const teamOptions = members.map(m => ({
    value: m.id,
    label: m.user?.full_name
      ? `${m.user.full_name} (${m.role_name})`
      : m.role_name || 'Team member',
  }))

  const roleOptions = (rolesData?.roles ?? [])
    .filter(r => r.is_active)
    .map(r => ({ value: r.id, label: r.name }))

  const set = (patch: Partial<ApproverRuleIn>) => setForm(prev => ({ ...prev, ...patch }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const hasUser = !!form.approver_id
    const hasRole = !!form.approver_role_id
    if (hasUser === hasRole) {
      toast.error('Exactly one of Approver or Role must be set')
      return
    }
    onSave(form)
  }

  const inputCls = 'h-8 text-xs px-2.5 mt-0.5'
  const labelCls = 'text-[11px] leading-tight text-gray-500 dark:text-gray-400'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Doc type */}
        <div>
          <Label className={labelCls}>Document Type <span className="text-rose-500">*</span></Label>
          <Select
            value={form.doc_type}
            onChange={v => set({ doc_type: v as MatrixDocType })}
            options={DOC_OPTIONS}
            className={inputCls}
          />
        </div>
        {/* Level */}
        <div>
          <Label className={labelCls}>Level <span className="text-rose-500">*</span></Label>
          <Input
            type="number" min={1} max={10}
            value={form.level}
            onChange={e => set({ level: parseInt(e.target.value) || 1 })}
            className={inputCls}
          />
        </div>
        {/* Material type */}
        <div>
          <Label className={labelCls}>Material Type <span className="text-gray-400">(any if blank)</span></Label>
          <Select
            value={form.material_type ?? ''}
            onChange={v => set({ material_type: v || null })}
            options={selectOptionsWithBlank('Any', MATERIAL_TYPE_OPTIONS)}
            searchable
            searchPlaceholder="Search type…"
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label className={labelCls}>Company <span className="text-gray-400">(any if blank)</span></Label>
          <Select
            value={form.company_id ?? ''}
            onChange={v => set({ company_id: v || null })}
            options={selectOptionsWithBlank('Any', companyOptions)}
            searchable
            searchPlaceholder="Search company…"
            className={inputCls}
          />
        </div>
        <div>
          <Label className={labelCls}>Branch <span className="text-gray-400">(any if blank)</span></Label>
          <Select
            value={form.branch_id ?? ''}
            onChange={v => set({ branch_id: v || null })}
            options={selectOptionsWithBlank('Any', branchOptions)}
            searchable
            searchPlaceholder="Search branch…"
            className={inputCls}
          />
        </div>
        <div>
          <Label className={labelCls}>Plant <span className="text-gray-400">(any if blank)</span></Label>
          <Select
            value={form.plant_id ?? ''}
            onChange={v => set({ plant_id: v || null })}
            options={selectOptionsWithBlank('Any', plantOptions)}
            searchable
            searchPlaceholder="Search plant…"
            className={inputCls}
          />
        </div>
      </div>

      {/* Amount band */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className={labelCls}>Min Amount <span className="text-gray-400">(inclusive, blank = 0)</span></Label>
          <Input
            type="number" min={0} step="0.01"
            placeholder="0.00"
            value={form.min_amount ?? ''}
            onChange={e => set({ min_amount: e.target.value ? parseFloat(e.target.value) : null })}
            className={inputCls}
          />
        </div>
        <div>
          <Label className={labelCls}>Max Amount <span className="text-gray-400">(exclusive, blank = unlimited)</span></Label>
          <Input
            type="number" min={0} step="0.01"
            placeholder="Unlimited"
            value={form.max_amount ?? ''}
            onChange={e => set({ max_amount: e.target.value ? parseFloat(e.target.value) : null })}
            className={inputCls}
          />
        </div>
      </div>

      {/* Approver — user or role (mutually exclusive) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className={labelCls}>Approver (named user)</Label>
          <Select
            value={form.approver_id ?? ''}
            onChange={v => set({ approver_id: v || null, approver_role_id: v ? null : form.approver_role_id })}
            options={selectOptionsWithBlank('None', teamOptions)}
            searchable
            searchPlaceholder="Search team member…"
            disabled={!!form.approver_role_id}
            className={inputCls}
          />
        </div>
        <div>
          <Label className={labelCls}>Approver Role <span className="text-gray-400">(expands to all role holders)</span></Label>
          <Select
            value={form.approver_role_id ?? ''}
            onChange={v => set({ approver_role_id: v || null, approver_id: v ? null : form.approver_id })}
            options={selectOptionsWithBlank('None', roleOptions)}
            searchable
            searchPlaceholder="Search role…"
            disabled={!!form.approver_id}
            className={inputCls}
          />
        </div>
      </div>

      {/* Options */}
      <div className="flex items-center gap-6 pt-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.lock_chain}
            onChange={e => set({ lock_chain: e.target.checked })}
            className="rounded"
          />
          <span className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" /> Lock chain (no manual overrides)
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={e => set({ is_active: e.target.checked })}
            className="rounded"
          />
          <span className="text-xs text-gray-700 dark:text-gray-300">Active</span>
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t dark:border-gray-700">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save rule'}
        </Button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────
//  Approver Matrix panel
// ─────────────────────────────────────────────────────────────────

function ApproverMatrixPanel() {
  const qc = useQueryClient()
  const [docFilter, setDocFilter] = useState<MatrixDocType | ''>('')
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewResult, setPreviewResult] = useState<{
    matched: boolean; lock_chain: boolean;
    steps: Array<{ level: number; approver_name: string; source_rule_id: string }>
  } | null>(null)
  const [previewForm, setPreviewForm] = useState({
    doc_type: 'PO' as MatrixDocType,
    company_id: '', branch_id: '', plant_id: '',
    material_types: [] as string[], amount: '',
  })

  const { companyOptions, branchOptions, plantOptions } = useApproverDimensionOptions()

  const { data, isLoading } = useQuery({
    queryKey: ['approverRules', docFilter],
    queryFn: () => vendorApi.listApproverRules(docFilter || undefined),
  })

  const createMut = useMutation({
    mutationFn: (d: ApproverRuleIn) => vendorApi.createApproverRule(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approverRules'] })
      setEditingId(null)
      toast.success('Rule created')
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      toast.error(e?.response?.data?.detail ?? 'Could not create rule'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApproverRuleIn }) =>
      vendorApi.updateApproverRule(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approverRules'] })
      setEditingId(null)
      toast.success('Rule updated')
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      toast.error(e?.response?.data?.detail ?? 'Could not update rule'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => vendorApi.deleteApproverRule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approverRules'] })
      toast.success('Rule deleted')
    },
  })

  const previewMut = useMutation({
    mutationFn: () => vendorApi.previewApproverResolution({
      doc_type: previewForm.doc_type,
      company_id: previewForm.company_id || null,
      branch_id:  previewForm.branch_id  || null,
      plant_id:   previewForm.plant_id   || null,
      material_types: previewForm.material_types,
      amount: previewForm.amount ? parseFloat(previewForm.amount) : 0,
    }),
    onSuccess: (res) => setPreviewResult(res),
    onError: () => toast.error('Preview failed'),
  })

  const rules: ApproverRule[] = data?.rules ?? []
  const editingRule = editingId && editingId !== 'new'
    ? rules.find(r => r.id === editingId)
    : null

  const docLabel: Record<MatrixDocType, string> = {
    PR: 'PR', PO: 'PO', INVOICE: 'Invoice',
  }

  const cellCls = 'px-3 py-2 text-xs text-gray-700 dark:text-gray-300'
  const headCls = 'px-3 py-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-left bg-gray-50 dark:bg-gray-800/50'

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="flex items-start gap-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-3 text-sm text-indigo-800 dark:text-indigo-300">
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <strong>Approver Matrix</strong> auto-populates the approval chain when a document is submitted.
          Rules are matched by <em>document type + company + branch + plant + material type + amount band</em>.
          The most specific matching rule group wins. <strong>NULL on any dimension = wildcard (any value)</strong>.
          Multiple rows with the same dimensions form one chain, ordered by <em>Level</em>.
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Select
            value={docFilter}
            onChange={v => setDocFilter(v as MatrixDocType | '')}
            options={selectOptionsWithBlank('All document types', DOC_OPTIONS)}
            className="h-8 text-xs w-52"
          />
          <span className="text-xs text-gray-500">{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            className="gap-1.5"
            onClick={() => setPreviewOpen(p => !p)}
          >
            <Play className="w-3.5 h-3.5" />
            {previewOpen ? 'Close preview' : 'Preview resolution'}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setEditingId('new')}>
            <Plus className="w-4 h-4" /> Add rule
          </Button>
        </div>
      </div>

      {/* Preview panel */}
      {previewOpen && (
        <div className="border dark:border-gray-700 rounded-xl p-4 space-y-3 bg-gray-50 dark:bg-gray-800/40">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            Preview — which approvers would be assigned for these dimensions?
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <div>
              <Label className="text-[11px] text-gray-500">Doc type</Label>
              <Select
                value={previewForm.doc_type}
                onChange={v => setPreviewForm(p => ({ ...p, doc_type: v as MatrixDocType }))}
                options={DOC_OPTIONS}
                className="h-7 text-xs mt-0.5"
              />
            </div>
            <div>
              <Label className="text-[11px] text-gray-500">Company</Label>
              <Select
                value={previewForm.company_id}
                onChange={v => setPreviewForm(p => ({ ...p, company_id: v }))}
                options={selectOptionsWithBlank('Any', companyOptions)}
                searchable
                searchPlaceholder="Search company…"
                className="h-7 text-xs mt-0.5"
              />
            </div>
            <div>
              <Label className="text-[11px] text-gray-500">Branch</Label>
              <Select
                value={previewForm.branch_id}
                onChange={v => setPreviewForm(p => ({ ...p, branch_id: v }))}
                options={selectOptionsWithBlank('Any', branchOptions)}
                searchable
                searchPlaceholder="Search branch…"
                className="h-7 text-xs mt-0.5"
              />
            </div>
            <div>
              <Label className="text-[11px] text-gray-500">Plant</Label>
              <Select
                value={previewForm.plant_id}
                onChange={v => setPreviewForm(p => ({ ...p, plant_id: v }))}
                options={selectOptionsWithBlank('Any', plantOptions)}
                searchable
                searchPlaceholder="Search plant…"
                className="h-7 text-xs mt-0.5"
              />
            </div>
            <div>
              <Label className="text-[11px] text-gray-500">Material types</Label>
              <MaterialTypesMultiSelect
                values={previewForm.material_types}
                onChange={material_types => setPreviewForm(p => ({ ...p, material_types }))}
                className="h-7 text-xs mt-0.5"
              />
            </div>
            <div>
              <Label className="text-[11px] text-gray-500">Amount</Label>
              <Input type="number" value={previewForm.amount} onChange={e => setPreviewForm(p => ({ ...p, amount: e.target.value }))} className="h-7 text-xs mt-0.5" placeholder="0.00" />
            </div>
          </div>
          <Button size="sm" onClick={() => previewMut.mutate()} disabled={previewMut.isPending} className="gap-1.5">
            <Play className="w-3.5 h-3.5" />
            {previewMut.isPending ? 'Running…' : 'Run preview'}
          </Button>
          {previewResult && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${previewResult.matched ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 text-amber-800 dark:text-amber-300'}`}>
              {previewResult.matched ? (
                <>
                  <p className="font-semibold mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Matrix matched — {previewResult.steps.length} approver step{previewResult.steps.length !== 1 ? 's' : ''}
                    {previewResult.lock_chain && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded-full">
                        <Lock className="w-3 h-3" /> Chain locked
                      </span>
                    )}
                  </p>
                  <ol className="list-decimal list-inside space-y-0.5 text-xs">
                    {previewResult.steps.map(s => (
                      <li key={s.level}>Level {s.level} — <strong>{s.approver_name}</strong></li>
                    ))}
                  </ol>
                </>
              ) : (
                <p className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  No matrix rule matched — document will use manually assigned approvers or route as not-required.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Inline add/edit form */}
      {editingId === 'new' && (
        <div className="border dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800/40 space-y-3">
          <p className="text-sm font-semibold">New rule</p>
          <RuleForm
            initial={EMPTY_RULE}
            onSave={d => createMut.mutate(d)}
            onCancel={() => setEditingId(null)}
            isSaving={createMut.isPending}
          />
        </div>
      )}

      {/* Rules table */}
      {isLoading ? (
        <p className="text-sm text-gray-500 py-6 text-center">Loading rules…</p>
      ) : rules.length === 0 ? (
        <div className="rounded-xl border border-dashed dark:border-gray-700 py-12 text-center">
          <ShieldCheck className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No approver rules yet.</p>
          <p className="text-xs text-gray-400 mt-1">Click <strong>Add rule</strong> to define who approves what.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
            <thead>
              <tr>
                <th className={headCls}>Type</th>
                <th className={headCls}>Company</th>
                <th className={headCls}>Branch</th>
                <th className={headCls}>Plant</th>
                <th className={headCls}>Material</th>
                <th className={headCls}>Amount band</th>
                <th className={headCls}>Lvl</th>
                <th className={headCls}>Approver / Role</th>
                <th className={headCls}>Options</th>
                <th className={`${headCls} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {rules.map(rule => (
                <>
                  {editingId === rule.id ? (
                    <tr key={`${rule.id}-edit`}>
                      <td colSpan={10} className="px-4 py-4 bg-gray-50 dark:bg-gray-800/40">
                        <RuleForm
                          initial={{
                            doc_type:         rule.doc_type as MatrixDocType,
                            company_id:       rule.company_id,
                            branch_id:        rule.branch_id,
                            plant_id:         rule.plant_id,
                            material_type:    rule.material_type,
                            min_amount:       rule.min_amount,
                            max_amount:       rule.max_amount,
                            level:            rule.level,
                            approver_id:      rule.approver_id,
                            approver_role_id: rule.approver_role_id,
                            lock_chain:       rule.lock_chain,
                            is_active:        rule.is_active,
                          }}
                          onSave={d => updateMut.mutate({ id: rule.id, data: d })}
                          onCancel={() => setEditingId(null)}
                          isSaving={updateMut.isPending}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={rule.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${!rule.is_active ? 'opacity-50' : ''}`}
                    >
                      <td className={cellCls}>
                        <span className="font-mono text-[11px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                          {docLabel[rule.doc_type as MatrixDocType]}
                        </span>
                      </td>
                      <td className={cellCls}>{rule.company_name ?? <span className="text-gray-400">any</span>}</td>
                      <td className={cellCls}>{rule.branch_name  ?? <span className="text-gray-400">any</span>}</td>
                      <td className={cellCls}>{rule.plant_name   ?? <span className="text-gray-400">any</span>}</td>
                      <td className={cellCls}>{rule.material_type ?? <span className="text-gray-400">any</span>}</td>
                      <td className={cellCls}>
                        {rule.min_amount == null && rule.max_amount == null
                          ? <span className="text-gray-400">any</span>
                          : `${rule.min_amount ?? 0} – ${rule.max_amount ?? '∞'}`
                        }
                      </td>
                      <td className={`${cellCls} font-semibold text-center`}>{rule.level}</td>
                      <td className={cellCls}>
                        {rule.approver_name
                          ? <span className="font-medium">{rule.approver_name}</span>
                          : rule.approver_role_name
                          ? <span className="text-indigo-600 dark:text-indigo-400 font-medium">Role: {rule.approver_role_name}</span>
                          : <span className="text-gray-400">—</span>
                        }
                      </td>
                      <td className={cellCls}>
                        <div className="flex items-center gap-2">
                          {rule.lock_chain && (
                            <span title="Chain locked" className="text-rose-500">
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {!rule.is_active && (
                            <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded">inactive</span>
                          )}
                        </div>
                      </td>
                      <td className={`${cellCls} text-right`}>
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setEditingId(rule.id)}
                            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Delete this rule?')) deleteMut.mutate(rule.id)
                            }}
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
//  Page
// ─────────────────────────────────────────────────────────────────

export default function ApprovalWorkflowPage() {
  const navigate = useNavigate()
  const [pageTab, setPageTab] = useState<PageTab>('visibility')
  const [wfTab, setWfTab] = useState<WfTab>('WF_PR')
  const { getStatus, setStatus, save, resetDocType, resetAll, dirty, saved, overrideCount } =
    useProcurementFieldConfig()

  const wfDocTypes: DocType[] = ['WF_PR', 'WF_PO', 'WF_INVOICE']
  const anyOverride = wfDocTypes.some(d => overrideCount(d) > 0)

  return (
    <div className="space-y-6 pb-24">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-primary" />
            Approval Workflow
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configure approval field visibility and auto-assign approvers based on document dimensions.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" className="gap-2" onClick={() => navigate('/procurement/configure')}>
            <SlidersHorizontal className="w-4 h-4" />
            Field Configuration
          </Button>
          {pageTab === 'visibility' && (
            <>
              {anyOverride && (
                <button
                  type="button"
                  onClick={() => wfDocTypes.forEach(d => resetDocType(d))}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-lg hover:border-red-300 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset all
                </button>
              )}
              <Button onClick={save} disabled={!dirty} className="gap-2">
                {saved ? (
                  <><CheckCircle2 className="w-4 h-4" /> Saved</>
                ) : (
                  <><Save className="w-4 h-4" /> Save changes</>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Page-level tabs */}
      <Tabs value={pageTab} onValueChange={v => setPageTab(v as PageTab)}>
        <TabsList className="mb-6">
          <TabsTrigger value="visibility" className="gap-2">
            <SlidersHorizontal className="w-4 h-4" /> Field Visibility
          </TabsTrigger>
          <TabsTrigger value="matrix" className="gap-2">
            <ShieldCheck className="w-4 h-4" /> Approver Matrix
          </TabsTrigger>
        </TabsList>

        {/* ── Field Visibility tab ───────────────────────────────── */}
        <TabsContent value="visibility">
          {/* Info banner */}
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-800 dark:text-blue-300 mb-4">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <strong>Approval field status</strong> controls which approver-related fields appear on each
              document type.{' '}
              <span className="text-rose-600 dark:text-rose-400 font-medium">Mandatory</span> — required
              before submitting.{' '}
              <span className="text-blue-600 dark:text-blue-400 font-medium">Optional</span> — shown but
              not required.{' '}
              <span className="text-gray-500 font-medium">Suppress</span> — hidden entirely.
            </div>
          </div>

          {dirty && (
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2.5 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              You have unsaved changes. Click <strong className="mx-1">Save changes</strong> to apply them.
            </div>
          )}

          <Tabs value={wfTab} onValueChange={v => setWfTab(v as WfTab)}>
            <TabsList className="mb-4">
              {WF_TABS.map(t => (
                <TabsTrigger key={t.value} value={t.value} className="gap-2">
                  {t.label}
                  {overrideCount(t.value) > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-primary/10 text-primary font-semibold">
                      {overrideCount(t.value)}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            {WF_TABS.map(t => (
              <TabsContent key={t.value} value={t.value}>
                <DocTypeFieldList
                  docType={t.value}
                  fields={WF_FIELDS[t.value]}
                  getStatus={getStatus}
                  setStatus={setStatus}
                  resetDocType={resetDocType}
                  overrideCount={overrideCount}
                />
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        {/* ── Approver Matrix tab ────────────────────────────────── */}
        <TabsContent value="matrix">
          <ApproverMatrixPanel />
        </TabsContent>
      </Tabs>

      {/* Floating save bar (field visibility only) */}
      {pageTab === 'visibility' && dirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 dark:bg-gray-800 text-white px-5 py-3 rounded-2xl shadow-2xl ring-1 ring-white/10">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm">Unsaved changes</span>
          <Button size="sm" onClick={save} className="bg-white text-gray-900 hover:bg-gray-100 font-semibold gap-1.5">
            <Save className="w-3.5 h-3.5" /> Save
          </Button>
        </div>
      )}
    </div>
  )
}
