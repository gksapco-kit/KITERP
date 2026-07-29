import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertTriangle, ArrowLeft, ChevronDown, ChevronUp,
  Globe, Plus, Search, Shield, Trash2, Users, X as XIcon,
} from 'lucide-react'
import { pharmaApi } from '@/api/pharma'
import { vendorApi } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useHasPermission } from '@/hooks/usePermissions'
import { PharmaPageHeader } from './pharmaShared'
import { cn } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

const APPROVAL_POLICY_ROWS: { countKey: string; label: string; action: string }[] = [
  { countKey: 'min_approvers_release',     label: 'Batch release',          action: 'batch_release' },
  { countKey: 'min_approvers_bpr_complete',label: 'BPR complete',           action: 'bpr_complete'  },
  { countKey: 'min_approvers_capa_close',  label: 'CAPA close',             action: 'capa_close'    },
  { countKey: 'min_approvers_cc_approve',  label: 'Change-control approve', action: 'cc_approve'    },
]

const PHARMA_ACTIONS = [
  'batch_release', 'bpr_complete', 'capa_close', 'cc_approve',
  'deviation_close', 'oos_close', 'mbr_approve', 'qc_result_approve',
]

const ACTION_LABELS: Record<string, string> = {
  batch_release:    'Batch release',
  bpr_complete:     'BPR complete',
  capa_close:       'CAPA close',
  cc_approve:       'Change-control approve',
  deviation_close:  'Deviation close',
  oos_close:        'OOS close',
  mbr_approve:      'MBR approve',
  qc_result_approve:'QC result approve',
}

const SIGNER_TYPES = ['user', 'role', 'permission', 'signer_group'] as const

const REGION_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'us',   label: 'US (DSCSA)' },
  { value: 'eu',   label: 'EU (FMD)' },
]

// ── Types ─────────────────────────────────────────────────────────────────────

type ApprovalRule = {
  id: string
  action: string
  product_id: string | null
  product_group_id: string | null
  plant_id: string | null
  store_id: string | null
  region: string | null
  required_approvers: number
  sequential: boolean
  forbid_initiator: boolean
  overrides_default: boolean
  is_default: boolean
  is_active: boolean
  valid_from: string | null
  valid_to: string | null
  priority: number
  notes: string | null
  steps: ApprovalStep[]
}

type ApprovalStep = {
  id?: string
  level: number
  signer_type: string
  vendor_user_id: string | null
  role_slug: string | null
  permission: string | null
  signer_group_id: string | null
  meaning: string
  min_signatures: number
  is_mandatory: boolean
}

type SignerGroup = {
  id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
  member_count: number
  members: { id: string; vendor_user_id: string }[]
}

type OrgRegion = {
  id: string
  store_id: string | null
  plant_id: string | null
  track_trace_region: string
}

type ScopeMatrixRow = {
  store_id: string | null
  store_name: string | null
  plant_id: string | null
  plant_name: string | null
  region: string | null
  actions: Record<string, {
    rule_id: string
    required_approvers: number
    sequential: boolean
    forbid_initiator: boolean
    overrides_default: boolean
    is_default: boolean
  }>
}

type ComboOption = { id: string; label: string }

// ── Small utilities ───────────────────────────────────────────────────────────

const emptyStep = (): ApprovalStep => ({
  level: 1,
  signer_type: 'permission',
  vendor_user_id: null,
  role_slug: null,
  permission: 'pharma.release',
  signer_group_id: null,
  meaning: 'approver',
  min_signatures: 1,
  is_mandatory: true,
})

const emptyRule = (): Partial<ApprovalRule> => ({
  action: 'batch_release',
  region: null,
  required_approvers: 2,
  sequential: false,
  forbid_initiator: true,
  overrides_default: false,
  is_default: false,
  is_active: true,
  steps: [],
})

function approverModeLabel(count: number) {
  if (count <= 0) return 'N/A'
  if (count >= 2) return `dual-sign (${count}×)`
  return 'single'
}

function scopeSummary(rule: ApprovalRule) {
  const parts: string[] = []
  if (rule.product_id)       parts.push('product')
  if (rule.product_group_id) parts.push('group')
  if (rule.plant_id)         parts.push('plant')
  if (rule.store_id)         parts.push('store')
  if (rule.region)           parts.push(`region:${rule.region}`)
  if (rule.is_default) return 'Default (all)'
  return parts.length ? parts.join(' + ') : 'All'
}

function regionBadge(v: string) {
  if (v === 'eu')
    return <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">EU (FMD)</span>
  if (v === 'us')
    return <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">US (DSCSA)</span>
  return <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">None</span>
}

// ── Layout primitives ─────────────────────────────────────────────────────────

/** Collapsible settings section — flat card, no rail, no number. */
function SettingsSection({
  title,
  description,
  status,
  disabled = false,
  defaultOpen = true,
  children,
}: {
  title: string
  description?: string
  status?: ReactNode
  disabled?: boolean
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={cn('rounded-xl border bg-card', disabled && 'opacity-60')}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-3 px-4 py-3 text-left',
          disabled ? 'cursor-not-allowed' : 'hover:bg-muted/30',
        )}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{title}</span>
          {description && (
            <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {status}
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {open && !disabled && (
        <div className="border-t border-border/50 divide-y divide-border/40">
          {children}
        </div>
      )}
    </section>
  )
}

/** Horizontal settings row: label + description left, control node right. */
function SettingRow({
  label,
  description,
  control,
  disabled,
  className,
}: {
  label: string
  description?: string
  control: ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-6 px-4 py-3', disabled && 'pointer-events-none opacity-50', className)}>
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

/** Thin sub-heading inside a SettingsSection. */
function SectionSubhead({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 pb-1 pt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {children}
      </p>
    </div>
  )
}

// ── Scope combo: dropdown + manual UUID fallback ──────────────────────────────

const MANUAL_SENTINEL = '__manual__'

function ScopeCombo({
  label,
  value,
  options,
  loading,
  onChange,
}: {
  label: string
  value: string | null
  options: ComboOption[]
  loading: boolean
  onChange: (v: string | null) => void
}) {
  const isKnown = !value || options.some((o) => o.id === value)
  const [showManual, setShowManual] = useState(!isKnown)
  const [manualVal, setManualVal] = useState(!isKnown ? (value || '') : '')

  const selectVal = showManual ? MANUAL_SENTINEL : (value || '')

  const handleSelect = (v: string) => {
    if (v === MANUAL_SENTINEL) {
      setShowManual(true)
      onChange(manualVal || null)
    } else if (v === '') {
      setShowManual(false)
      setManualVal('')
      onChange(null)
    } else {
      setShowManual(false)
      setManualVal('')
      onChange(v)
    }
  }

  return (
    <div className="space-y-1">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <select
        className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
        value={selectVal}
        onChange={(e) => handleSelect(e.target.value)}
        disabled={loading}
      >
        <option value="">— any (no filter) —</option>
        {loading
          ? <option disabled>Loading…</option>
          : options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)
        }
        <option value={MANUAL_SENTINEL}>✏ Enter UUID manually…</option>
      </select>
      {showManual && (
        <input
          type="text"
          placeholder="Paste UUID"
          autoFocus
          className="h-8 w-full rounded border border-primary bg-background px-2 text-xs font-mono ring-1 ring-primary/30"
          value={manualVal}
          onChange={(e) => { setManualVal(e.target.value); onChange(e.target.value || null) }}
        />
      )}
    </div>
  )
}

// ── Rule drawer ───────────────────────────────────────────────────────────────

function RuleDrawer({
  initial,
  signerGroups,
  onSave,
  onClose,
}: {
  initial: Partial<ApprovalRule>
  signerGroups: SignerGroup[]
  onSave: (rule: Partial<ApprovalRule>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<Partial<ApprovalRule>>({ ...initial })
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState<ComboOption[]>([])
  const [groups, setGroups] = useState<ComboOption[]>([])
  const [plants, setPlants] = useState<ComboOption[]>([])
  const [stores, setStores] = useState<ComboOption[]>([])
  const [scopeLoading, setScopeLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      vendorApi.listProducts({ size: 200, product_type: 'physical', pharma_managed: true })
        .then((r) => (r.items || []).map((p: any) => ({
          id: p.id,
          label: `${p.name}${p.material_code ? ` [${p.material_code}]` : ''}`,
        }))).catch(() => [] as ComboOption[]),
      vendorApi.listProductGroupFlatOptions()
        .then((r) => (r.options || []).map((g: any) => ({
          id: g.id,
          label: `${'·'.repeat(g.level)} ${g.label || g.name}`,
        }))).catch(() => [] as ComboOption[]),
      vendorApi.listPlants()
        .then((r) => (r.plants || []).map((p: any) => ({
          id: p.id, label: `${p.name} (${p.code})`,
        }))).catch(() => [] as ComboOption[]),
      vendorApi.listStores()
        .then((r) => (r.stores || []).map((s: any) => ({
          id: s.id,
          label: `[${s.unit_type === 'branch' ? 'Branch' : 'BU'}] ${s.name}`,
        }))).catch(() => [] as ComboOption[]),
    ]).then(([p, g, pl, st]) => {
      setProducts(p); setGroups(g); setPlants(pl); setStores(st)
      setScopeLoading(false)
    })
  }, [])

  const patch = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }))
  const addStep = () =>
    setForm((f) => ({ ...f, steps: [...(f.steps || []), emptyStep()] }))
  const removeStep = (i: number) =>
    setForm((f) => ({ ...f, steps: (f.steps || []).filter((_, idx) => idx !== i) }))
  const patchStep = (i: number, k: string, v: unknown) =>
    setForm((f) => {
      const steps = [...(f.steps || [])]
      steps[i] = { ...steps[i], [k]: v } as ApprovalStep
      return { ...f, steps }
    })

  const save = async () => {
    setSaving(true)
    try { await onSave(form); onClose() }
    catch (e: any) { toast.error(e?.response?.data?.detail || 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40">
      <div className="h-full w-full max-w-lg overflow-y-auto bg-background p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {initial.id ? 'Edit approval rule' : 'New approval rule'}
          </h2>
          <button onClick={onClose} className="text-xl text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="space-y-5 text-sm">

          {/* Action */}
          <label className="block">
            <span className="mb-1 block font-medium">Action</span>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2"
              value={form.action || 'batch_release'}
              onChange={(e) => patch('action', e.target.value)}
            >
              {PHARMA_ACTIONS.map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
              ))}
            </select>
          </label>

          {/* Scope */}
          <fieldset className="rounded-md border border-border/60 p-4">
            <legend className="px-1 text-xs font-medium text-muted-foreground">
              Scope — leave blank to match any value
            </legend>
            <div className="mt-3 space-y-3">
              <ScopeCombo label="Product"            value={form.product_id ?? null}       options={products} loading={scopeLoading} onChange={(v) => patch('product_id', v)} />
              <ScopeCombo label="Product group"      value={form.product_group_id ?? null} options={groups}   loading={scopeLoading} onChange={(v) => patch('product_group_id', v)} />
              <ScopeCombo label="Plant"              value={form.plant_id ?? null}          options={plants}   loading={scopeLoading} onChange={(v) => patch('plant_id', v)} />
              <ScopeCombo label="Store / BU / Branch" value={form.store_id ?? null}        options={stores}   loading={scopeLoading} onChange={(v) => patch('store_id', v)} />
              <div className="space-y-1">
                <span className="block text-xs text-muted-foreground">Region (track &amp; trace)</span>
                <select
                  className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                  value={form.region ?? ''}
                  onChange={(e) => patch('region', e.target.value || null)}
                >
                  <option value="">— any region —</option>
                  {REGION_OPTIONS.filter((o) => o.value !== 'none').map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                  <option value="none">None (no T&amp;T region)</option>
                </select>
              </div>
            </div>
          </fieldset>

          {/* Approvers + priority */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block font-medium">Required approvers</span>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2"
                value={form.required_approvers ?? 2}
                onChange={(e) => patch('required_approvers', Number(e.target.value))}
              >
                <option value={0}>N/A</option>
                {[1,2,3,4,5,6,7,8,9,10].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block font-medium">Priority</span>
              <input
                type="number" min={0}
                className="h-9 w-full rounded border border-input bg-background px-2"
                value={form.priority ?? 100}
                onChange={(e) => patch('priority', Number(e.target.value))}
              />
            </label>
          </div>

          {/* Flags */}
          <div className="rounded-md border border-border/60 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Options</p>
            <div className="space-y-1">
              {[
                { key: 'sequential',        label: 'Sequential signing',        desc: 'Levels must be completed in order' },
                { key: 'forbid_initiator',  label: 'Initiator may not sign',    desc: 'Segregation of duties' },
                { key: 'overrides_default', label: 'Overrides default floor',   desc: 'Only this rule is used (no merge with default)' },
                { key: 'is_default',        label: 'This is the default rule',  desc: 'Applies when no scope matches' },
                { key: 'is_active',         label: 'Active',                    desc: '' },
              ].map(({ key, label, desc }) => (
                <label key={key} className="flex cursor-pointer items-start justify-between gap-3 rounded px-2 py-1.5 hover:bg-muted/50">
                  <span>
                    <span className="block text-xs font-medium">{label}</span>
                    {desc && <span className="block text-[10px] text-muted-foreground">{desc}</span>}
                  </span>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    checked={!!(form as any)[key]}
                    onChange={(e) => patch(key, e.target.checked)}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Validity dates */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Valid from</span>
              <input type="date" className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                value={form.valid_from || ''} onChange={(e) => patch('valid_from', e.target.value || null)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Valid to</span>
              <input type="date" className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                value={form.valid_to || ''} onChange={(e) => patch('valid_to', e.target.value || null)} />
            </label>
          </div>

          {/* Notes */}
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">Notes</span>
            <textarea rows={2} className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
              value={form.notes || ''} onChange={(e) => patch('notes', e.target.value || null)} />
          </label>

          {/* Signer steps */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="font-medium">Signer steps</p>
                <p className="text-[10px] text-muted-foreground">Level 1 = reviewer / author slot; level 2+ = approvers</p>
              </div>
              <button onClick={addStep}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/10">
                <Plus className="h-3 w-3" /> Add step
              </button>
            </div>
            <div className="space-y-3">
              {(form.steps || []).map((step, i) => (
                <div key={i} className="rounded-md border border-border/60 bg-muted/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Level {step.level}</span>
                    <button onClick={() => removeStep(i)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-0.5 block text-[10px] text-muted-foreground">Level</span>
                      <input type="number" min={1}
                        className="h-7 w-full rounded border border-input bg-background px-1.5 text-xs"
                        value={step.level} onChange={(e) => patchStep(i, 'level', Number(e.target.value))} />
                    </label>
                    <label className="block">
                      <span className="mb-0.5 block text-[10px] text-muted-foreground">Signer type</span>
                      <select className="h-7 w-full rounded border border-input bg-background px-1 text-xs"
                        value={step.signer_type} onChange={(e) => patchStep(i, 'signer_type', e.target.value)}>
                        {SIGNER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>

                    {step.signer_type === 'user' && (
                      <label className="col-span-2 block">
                        <span className="mb-0.5 block text-[10px] text-muted-foreground">Vendor user ID</span>
                        <input type="text" className="h-7 w-full rounded border border-input bg-background px-1.5 text-xs font-mono"
                          value={step.vendor_user_id || ''} onChange={(e) => patchStep(i, 'vendor_user_id', e.target.value || null)} />
                      </label>
                    )}
                    {step.signer_type === 'role' && (
                      <label className="col-span-2 block">
                        <span className="mb-0.5 block text-[10px] text-muted-foreground">Role slug</span>
                        <input type="text" className="h-7 w-full rounded border border-input bg-background px-1.5 text-xs"
                          value={step.role_slug || ''} onChange={(e) => patchStep(i, 'role_slug', e.target.value || null)} />
                      </label>
                    )}
                    {step.signer_type === 'permission' && (
                      <label className="col-span-2 block">
                        <span className="mb-0.5 block text-[10px] text-muted-foreground">Permission string</span>
                        <input type="text" className="h-7 w-full rounded border border-input bg-background px-1.5 text-xs"
                          value={step.permission || ''} onChange={(e) => patchStep(i, 'permission', e.target.value || null)} />
                      </label>
                    )}
                    {step.signer_type === 'signer_group' && (
                      <label className="col-span-2 block">
                        <span className="mb-0.5 block text-[10px] text-muted-foreground">Signer group</span>
                        <select className="h-7 w-full rounded border border-input bg-background px-1 text-xs"
                          value={step.signer_group_id || ''} onChange={(e) => patchStep(i, 'signer_group_id', e.target.value || null)}>
                          <option value="">— select group —</option>
                          {signerGroups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.code})</option>)}
                        </select>
                      </label>
                    )}

                    <label className="block">
                      <span className="mb-0.5 block text-[10px] text-muted-foreground">Meaning</span>
                      <select className="h-7 w-full rounded border border-input bg-background px-1 text-xs"
                        value={step.meaning} onChange={(e) => patchStep(i, 'meaning', e.target.value)}>
                        <option value="author">author</option>
                        <option value="reviewer">reviewer</option>
                        <option value="approver">approver</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-0.5 block text-[10px] text-muted-foreground">Min signatures</span>
                      <input type="number" min={1}
                        className="h-7 w-full rounded border border-input bg-background px-1.5 text-xs"
                        value={step.min_signatures} onChange={(e) => patchStep(i, 'min_signatures', Number(e.target.value))} />
                    </label>
                    <label className="col-span-2 flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted/50">
                      <input type="checkbox" className="h-3.5 w-3.5 accent-primary"
                        checked={step.is_mandatory} onChange={(e) => patchStep(i, 'is_mandatory', e.target.checked)} />
                      Mandatory step
                    </label>
                  </div>
                </div>
              ))}
              {!(form.steps?.length) && (
                <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  No named steps — any user holding the required permission may sign.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save rule'}
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}

// ── Step ⑤: Signer groups ─────────────────────────────────────────────────────

function SignerGroupsCard({
  canManage,
  groups,
  onRefresh,
}: {
  canManage: boolean
  groups: SignerGroup[]
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [addingMember, setAddingMember] = useState<string | null>(null)
  const [memberInput, setMemberInput] = useState('')

  const createGroup = async () => {
    if (!newCode || !newName) return
    try {
      await pharmaApi.createSignerGroup({ code: newCode, name: newName })
      setNewCode(''); setNewName(''); setCreating(false)
      onRefresh(); toast.success('Signer group created')
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Create failed') }
  }

  const addMember = async (groupId: string) => {
    if (!memberInput.trim()) return
    try {
      await pharmaApi.addSignerGroupMember(groupId, memberInput.trim())
      setMemberInput(''); setAddingMember(null)
      onRefresh(); toast.success('Member added')
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Add failed') }
  }

  const removeMember = async (groupId: string, userId: string) => {
    try {
      await pharmaApi.removeSignerGroupMember(groupId, userId)
      onRefresh(); toast.success('Member removed')
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Remove failed') }
  }

  return (
    <div className="space-y-3">
      {/* Create new form */}
      {canManage && (
        creating ? (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">New signer panel</p>
            <div className="mb-2 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-0.5 block text-[10px] text-muted-foreground">Code (e.g. QA-BOARD)</span>
                <input type="text" placeholder="QA-BOARD"
                  className="h-8 w-full rounded border border-input bg-background px-2 text-xs font-mono uppercase"
                  value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[10px] text-muted-foreground">Display name</span>
                <input type="text" placeholder="QA Review Board"
                  className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                  value={newName} onChange={(e) => setNewName(e.target.value)} />
              </label>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={createGroup} disabled={!newCode || !newName}>Create panel</Button>
              <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setNewCode(''); setNewName('') }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="h-7" onClick={() => setCreating(true)}>
            <Plus className="mr-1 h-3 w-3" /> Create new
          </Button>
        )
      )}

      {/* Groups table */}
      {groups.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 py-5 text-center">
          <p className="text-xs text-muted-foreground">No signer panels yet.</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Create a panel and reference it in a rule's named signer steps.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border/50">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/40 bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Members</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {groups.map((g) => (
                <>
                  <tr key={g.id} className="bg-background hover:bg-muted/20">
                    <td className="px-3 py-2.5">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                        {g.code}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium">{g.name}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-3 w-3" /> {g.member_count}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        className="text-primary hover:underline"
                        onClick={() => setExpanded(expanded === g.id ? null : g.id)}
                      >
                        {expanded === g.id ? 'Hide' : 'Members'}
                      </button>
                    </td>
                  </tr>
                  {expanded === g.id && (
                    <tr key={`${g.id}-exp`} className="bg-muted/20">
                      <td colSpan={4} className="px-4 py-3">
                        <ul className="mb-2 space-y-1">
                          {g.members.length === 0 && (
                            <li className="text-xs text-muted-foreground">No members yet.</li>
                          )}
                          {g.members.map((m) => (
                            <li key={m.id} className="flex items-center justify-between text-xs">
                              <span className="font-mono text-[11px] text-muted-foreground">{m.vendor_user_id}</span>
                              {canManage && (
                                <button onClick={() => removeMember(g.id, m.vendor_user_id)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                        {canManage && (
                          addingMember === g.id ? (
                            <div className="flex gap-2">
                              <input type="text" placeholder="VendorUser UUID"
                                className="h-7 flex-1 rounded border border-input bg-background px-2 text-xs font-mono"
                                value={memberInput} onChange={(e) => setMemberInput(e.target.value)} />
                              <Button size="sm" onClick={() => addMember(g.id)}>Add</Button>
                              <Button size="sm" variant="ghost" onClick={() => { setAddingMember(null); setMemberInput('') }}>✕</Button>
                            </div>
                          ) : (
                            <button className="text-xs font-medium text-primary hover:underline"
                              onClick={() => setAddingMember(g.id)}>
                              + Add member
                            </button>
                          )
                        )}
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

// ── Step ⑦: Verify policy ─────────────────────────────────────────────────────

function VerifyPolicyPanel() {
  const [action, setAction] = useState('batch_release')
  const [products, setProducts] = useState<ComboOption[]>([])
  const [plants, setPlants] = useState<ComboOption[]>([])
  const [stores, setStores] = useState<ComboOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [productId, setProductId] = useState<string | null>(null)
  const [plantId, setPlantId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    Promise.all([
      vendorApi.listProducts({ size: 200, product_type: 'physical', pharma_managed: true }).then((r) =>
        (r.items || []).map((p: any) => ({ id: p.id, label: `${p.name}${p.material_code ? ` [${p.material_code}]` : ''}` }))
      ).catch(() => [] as ComboOption[]),
      vendorApi.listPlants().then((r) =>
        (r.plants || []).map((p: any) => ({ id: p.id, label: `${p.name} (${p.code})` }))
      ).catch(() => [] as ComboOption[]),
      vendorApi.listStores().then((r) =>
        (r.stores || []).map((s: any) => ({ id: s.id, label: `[${s.unit_type === 'branch' ? 'Branch' : 'BU'}] ${s.name}` }))
      ).catch(() => [] as ComboOption[]),
    ]).then(([p, pl, st]) => { setProducts(p); setPlants(pl); setStores(st); setLoadingOptions(false) })
  }, [])

  const resolve = async () => {
    setResolving(true)
    setResult(null)
    try {
      const data = await pharmaApi.resolveApprovalPolicy({
        action,
        ...(productId ? { product_id: productId } : {}),
        ...(plantId   ? { plant_id:   plantId   } : {}),
        ...(storeId   ? { store_id:   storeId   } : {}),
      })
      setResult(data)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Resolve failed')
    } finally {
      setResolving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium">Action</span>
          <select className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
            value={action} onChange={(e) => { setAction(e.target.value); setResult(null) }}>
            {PHARMA_ACTIONS.map((a) => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
          </select>
        </label>
        <ScopeCombo label="Product (optional)" value={productId} options={products}
          loading={loadingOptions} onChange={(v) => { setProductId(v); setResult(null) }} />
        <ScopeCombo label="Plant (optional)"   value={plantId}   options={plants}
          loading={loadingOptions} onChange={(v) => { setPlantId(v);   setResult(null) }} />
        <ScopeCombo label="Store / BU / Branch (optional)" value={storeId} options={stores}
          loading={loadingOptions} onChange={(v) => { setStoreId(v);   setResult(null) }} />
      </div>

      <Button size="sm" onClick={resolve} disabled={resolving}>
        <Search className="mr-1.5 h-3.5 w-3.5" />
        {resolving ? 'Resolving…' : 'Resolve effective policy'}
      </Button>

      {result && (
        <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className={cn(
              'rounded px-2 py-0.5 text-xs font-semibold',
              result.required_approvers >= 2 ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground',
            )}>
              {approverModeLabel(result.required_approvers)}
            </span>
            {result.sequential && (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">sequential</span>
            )}
            {result.forbid_initiator && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">no self-sign</span>
            )}
            <span className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium',
              result.source === 'rules' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground',
            )}>
              {result.source === 'rules' ? `${result.rule_ids?.length || 0} rule(s) merged` : 'legacy settings'}
            </span>
          </div>

          {result.steps?.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Named signer steps</p>
              <div className="space-y-1">
                {result.steps.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">L{s.level}</span>
                    <span>{s.signer_type}:{s.target}</span>
                    <span className="text-muted-foreground">· {s.meaning} · min {s.min_signatures}</span>
                    {!s.is_mandatory && <span className="text-muted-foreground">(optional)</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!result.steps?.length) && (
            <p className="text-xs text-muted-foreground">
              No named signer steps — any user with the required permission may sign.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Scope Matrix Section ──────────────────────────────────────────────────────

function scopeLabel(row: ScopeMatrixRow): string {
  const bu  = row.store_name  ?? (row.store_id  ? row.store_id.slice(0, 8) + '…'  : 'All BU')
  const plt = row.plant_name  ?? (row.plant_id  ? row.plant_id.slice(0, 8) + '…'  : 'All plants')
  const rgn = row.region === 'us' ? 'US (DSCSA)' : row.region === 'eu' ? 'EU (FMD)' : 'Any region'
  return `${bu}  ·  ${plt}  ·  ${rgn}`
}

function ScopeMatrixSection({
  canManage,
  onEditRule,
  onAddRule,
}: {
  canManage: boolean
  onEditRule: (rule: Partial<ApprovalRule>) => void
  onAddRule: (preset: Partial<ApprovalRule>) => void
}) {
  const [rows, setRows] = useState<ScopeMatrixRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    pharmaApi.getScopeMatrix()
      .then((d) => setRows(d || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const rowKey = (r: ScopeMatrixRow) =>
    `${r.store_id ?? '_'}|${r.plant_id ?? '_'}|${r.region ?? '_'}`

  if (loading) {
    return <p className="px-4 py-4 text-xs text-muted-foreground">Loading…</p>
  }

  return (
    <div>
      {/* Column header */}
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Scope (BU · Plant · Region)</span>
        <span className="text-right">Actions</span>
        {canManage && <span />}
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/40">
        {rows.length === 0 ? (
          <div className="px-4 py-4 text-sm text-muted-foreground">
            No scope rules yet.{' '}
            {canManage && (
              <button className="text-primary hover:underline" onClick={() => onAddRule({ is_default: false })}>
                Add first rule
              </button>
            )}
          </div>
        ) : (
          rows.map((row) => {
            const actionEntries = Object.entries(row.actions)
            const maxApprovers = actionEntries.length
              ? Math.max(...actionEntries.map(([, a]) => a.required_approvers))
              : 0

            return (
              <div
                key={rowKey(row)}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3"
              >
                {/* Scope description */}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{scopeLabel(row)}</p>
                  {actionEntries.length > 0 && maxApprovers >= 2 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      dual-sign · {actionEntries.length} action{actionEntries.length !== 1 ? 's' : ''}
                    </p>
                  )}
                  {actionEntries.length > 0 && maxApprovers < 2 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      single · {actionEntries.length} action{actionEntries.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Action count pill */}
                <span className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                  actionEntries.length > 0
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-muted/50 text-muted-foreground/60',
                )}>
                  {actionEntries.length}/{PHARMA_ACTIONS.length}
                </span>

                {/* Edit button */}
                {canManage && (
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() =>
                      onAddRule({
                        store_id: row.store_id ?? undefined,
                        plant_id: row.plant_id ?? undefined,
                        region: row.region,
                        is_default: false,
                      } as Partial<ApprovalRule>)
                    }
                  >
                    + Add rule
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Footer: add new combo */}
      {canManage && rows.length > 0 && (
        <div className="border-t border-border/40 px-4 py-2.5">
          <button
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            onClick={() => onAddRule({ is_default: false })}
          >
            <Plus className="h-3 w-3" />
            Add scope combination
          </button>
        </div>
      )}
    </div>
  )
}


// ── Main page ─────────────────────────────────────────────────────────────────

export default function PharmaSettingsEsignPage() {
  const canManage = useHasPermission('pharma.manage')
  const [cfg, setCfg] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [rules, setRules] = useState<ApprovalRule[]>([])
  const [signerGroups, setSignerGroups] = useState<SignerGroup[]>([])
  const [drawerRule, setDrawerRule] = useState<Partial<ApprovalRule> | null>(null)

  // Org regions state — owned here so step ⑥ can read cfg
  const [orgRegions, setOrgRegions] = useState<OrgRegion[]>([])
  const [orgStores, setOrgStores] = useState<{ id: string; name: string; unit_type: string }[]>([])
  const [orgPlants, setOrgPlants] = useState<{ id: string; name: string; code: string }[]>([])
  const [addingRegion, setAddingRegion] = useState(false)
  const [newRegionScope, setNewRegionScope] = useState<'store' | 'plant'>('store')
  const [newRegionId, setNewRegionId] = useState('')
  const [newRegionValue, setNewRegionValue] = useState('eu')

  const load = async () => {
    setLoading(true)
    try {
      const [settings, ruleList, groups, regions] = await Promise.all([
        pharmaApi.getSettings(),
        pharmaApi.listApprovalRules({ is_active: true }),
        pharmaApi.listSignerGroups(),
        pharmaApi.listOrgRegions(),
      ])
      setCfg(settings || {})
      setRules(ruleList || [])
      setSignerGroups(groups || [])
      setOrgRegions(regions || [])
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    vendorApi.listStores().then((r) =>
      setOrgStores((r.stores || []).map((s: any) => ({ id: s.id, name: s.name, unit_type: s.unit_type })))
    ).catch(() => {})
    vendorApi.listPlants().then((r) =>
      setOrgPlants((r.plants || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code })))
    ).catch(() => {})
  }, [])

  // Settings helpers
  const patchEsign = async (key: string, value: boolean) => {
    try {
      setCfg(await pharmaApi.patchSettings({ [key]: value }))
      toast.success('Setting updated')
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Update failed') }
  }

  const patchApproverCount = async (key: string, count: number) => {
    const syncMap: Record<string, string> = {
      min_approvers_release:      'dual_sign_release',
      min_approvers_bpr_complete: 'dual_sign_bpr_complete',
      min_approvers_capa_close:   'dual_sign_capa_close',
      min_approvers_cc_approve:   'dual_sign_cc_approve',
    }
    const patch: Record<string, unknown> = { [key]: count }
    if (syncMap[key]) patch[syncMap[key]] = count >= 2
    try {
      setCfg(await pharmaApi.patchSettings(patch))
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Update failed') }
  }

  // Rule helpers
  const saveRule = async (form: Partial<ApprovalRule>) => {
    if (form.id) {
      await pharmaApi.updateApprovalRule(form.id, form as Record<string, unknown>)
      toast.success('Rule updated')
    } else {
      await pharmaApi.createApprovalRule(form as Record<string, unknown>)
      toast.success('Rule created')
    }
    await load()
  }

  const deactivateRule = async (id: string) => {
    try {
      await pharmaApi.deactivateApprovalRule(id)
      setRules((r) => r.filter((x) => x.id !== id))
      toast.success('Rule deactivated')
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Deactivate failed') }
  }

  // Org region helpers
  const orgNameFor = (row: OrgRegion) => {
    if (row.store_id) {
      const s = orgStores.find((x) => x.id === row.store_id)
      if (s) return `${s.unit_type === 'branch' ? 'Branch' : 'BU'}: ${s.name}`
      return `Store: ${row.store_id.slice(0, 8)}…`
    }
    if (row.plant_id) {
      const p = orgPlants.find((x) => x.id === row.plant_id)
      if (p) return `Plant: ${p.name} (${p.code})`
      return `Plant: ${row.plant_id.slice(0, 8)}…`
    }
    return '—'
  }

  const saveOrgRegion = async () => {
    if (!newRegionId) { toast.error('Select a BU/Branch or Plant first'); return }
    try {
      await pharmaApi.upsertOrgRegion({
        store_id: newRegionScope === 'store' ? newRegionId : null,
        plant_id: newRegionScope === 'plant' ? newRegionId : null,
        track_trace_region: newRegionValue,
      })
      setAddingRegion(false); setNewRegionId('')
      setOrgRegions(await pharmaApi.listOrgRegions())
      toast.success('Region override saved')
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Save failed') }
  }

  const removeOrgRegion = async (id: string) => {
    try {
      await pharmaApi.deleteOrgRegion(id)
      setOrgRegions((prev) => prev.filter((r) => r.id !== id))
      toast.success('Override removed')
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Remove failed') }
  }

  const [verifyOpen, setVerifyOpen] = useState(false)
  const [creatingRule, setCreatingRule] = useState(false)
  const [newRule, setNewRule] = useState<Partial<ApprovalRule>>(emptyRule())
  const [ruleScopes, setRuleScopes] = useState<{ products: ComboOption[]; plants: ComboOption[]; stores: ComboOption[] }>({
    products: [], plants: [], stores: [],
  })
  const [ruleScopesLoading, setRuleScopesLoading] = useState(false)
  const scopedOverridesRef = useRef<HTMLDivElement>(null)

  const openRuleCreate = () => {
    setNewRule(emptyRule())
    setCreatingRule(true)
    if (ruleScopes.products.length === 0) {
      setRuleScopesLoading(true)
      Promise.all([
        vendorApi.listProducts({ size: 200, product_type: 'physical', pharma_managed: true })
          .then((r) => (r.items || []).map((p: any) => ({ id: p.id, label: `${p.name}${p.material_code ? ` [${p.material_code}]` : ''}` })))
          .catch(() => [] as ComboOption[]),
        vendorApi.listPlants()
          .then((r) => (r.plants || []).map((p: any) => ({ id: p.id, label: `${p.name} (${p.code})` })))
          .catch(() => [] as ComboOption[]),
        vendorApi.listStores()
          .then((r) => (r.stores || []).map((s: any) => ({ id: s.id, label: `[${s.unit_type === 'branch' ? 'Branch' : 'BU'}] ${s.name}` })))
          .catch(() => [] as ComboOption[]),
      ]).then(([products, plants, stores]) => {
        setRuleScopes({ products, plants, stores })
        setRuleScopesLoading(false)
      })
    }
    setTimeout(() => scopedOverridesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const saveNewRule = async () => {
    try {
      await pharmaApi.createApprovalRule(newRule as Record<string, unknown>)
      toast.success('Rule created')
      setCreatingRule(false)
      await load()
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Create failed') }
  }

  const patchNewRule = (k: string, v: unknown) => setNewRule((r) => ({ ...r, [k]: v }))

  const esignOn      = !!cfg.esign_required
  const sectionsOff  = !esignOn
  const defaultRules = rules.filter((r) => r.is_default)
  const scopedRules  = rules.filter((r) => !r.is_default)

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">

      {/* ── Header ── */}
      <div className="mb-6">
        <Link to="/pharma/settings"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Foundations
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PharmaPageHeader
            title="E-sign & approval policy"
            subtitle="Part 11-style e-signature settings. All sections below are enforced only when E-sign is enabled."
          />
          <div className="flex shrink-0 items-center gap-3 pt-1">
            {/* Master switch */}
            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm">
              <span className={cn('text-xs font-semibold', esignOn ? 'text-emerald-600' : 'text-muted-foreground')}>
                E-sign {esignOn ? 'ON' : 'OFF'}
              </span>
              <Switch
                checked={esignOn}
                disabled={!canManage || loading}
                onCheckedChange={(v) => patchEsign('esign_required', v)}
              />
            </div>
            {/* Verify sheet trigger */}
            <Button size="sm" variant="outline" onClick={() => setVerifyOpen(true)}>
              <Shield className="mr-1.5 h-3.5 w-3.5" />
              Verify policy
            </Button>
          </div>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {/* E-sign OFF banner */}
      {!esignOn && !loading && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          E-sign is OFF — all sections below are visible but not enforced. Any user can approve any action without a password.
        </div>
      )}

      {/* ══ Section 1: Enforcement ══ */}
      <SettingsSection
        title="Enforcement"
        description="Who may sign and what must be true before a signature is accepted."
        disabled={sectionsOff}
        status={
          <span className={cn(
            'rounded-full px-2.5 py-0.5 text-[10px] font-semibold',
            cfg.release_training_required ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground',
          )}>
            {cfg.release_training_required ? 'Competency gate on' : 'Open signing'}
          </span>
        }
      >
        {/* Competency gate */}
        <SettingRow
          label="Release training / competency gate"
          description="Blocks non-admin users from signing a batch release unless they appear on the qualified list."
          disabled={!canManage}
          control={
            <Switch
              checked={!!cfg.release_training_required}
              disabled={!canManage}
              onCheckedChange={(v) => patchEsign('release_training_required', v)}
            />
          }
        />
        {cfg.release_training_required && (
          <div className="flex items-center justify-between px-4 py-2.5 text-xs">
            <span className="text-muted-foreground">
              {(cfg.release_qualified_ids || []).length} user(s) on qualified list
              <span className="ml-1 text-[10px]">· owners &amp; admins always pass</span>
            </span>
            {canManage && (
              <Button size="sm" variant="outline" className="h-7"
                onClick={() =>
                  pharmaApi.qualifyMeForRelease()
                    .then((next) => { setCfg(next); toast.success('You are now qualified') })
                    .catch((e: any) => toast.error(e?.response?.data?.detail || 'Failed'))
                }>
                Qualify me
              </Button>
            )}
          </div>
        )}

        {/* BPR prerequisite */}
        <SettingRow
          label="Completed BPR required before FG release"
          description="Blocks the release decision on a production batch unless a completed Batch Production Record exists for it."
          disabled={!canManage}
          control={
            <Switch
              checked={!!cfg.bpr_required_before_release}
              disabled={!canManage}
              onCheckedChange={(v) => patchEsign('bpr_required_before_release', v)}
            />
          }
        />
      </SettingsSection>

      {/* ══ Section 2: Policy by BU / Plant / Region ══ */}
      <SettingsSection
        title="Approval policy by scope"
        description="Set approver rules per Business Unit, Plant and Region."
        disabled={sectionsOff}
        status={
          <span className="text-[10px] text-muted-foreground">BU · Plant · Region</span>
        }
      >
        <ScopeMatrixSection
          canManage={canManage}
          onEditRule={(rule) => setDrawerRule(rule)}
          onAddRule={(preset) => {
            setNewRule({ ...emptyRule(), ...preset })
            setCreatingRule(true)
            setTimeout(() => scopedOverridesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
          }}
        />
      </SettingsSection>

      {/* ══ Section 3: Approvers & signers ══ */}
      <SettingsSection
        title="Approvers & signers"
        description="Minimum approver counts per action, scoped overrides, and named signer panels."
        disabled={sectionsOff}
        status={
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] text-muted-foreground">
            {scopedRules.length} override{scopedRules.length !== 1 ? 's' : ''}
            {' · '}
            {signerGroups.length} group{signerGroups.length !== 1 ? 's' : ''}
          </span>
        }
      >
        {/* Default approver counts */}
        <SectionSubhead>Default — applies to all products &amp; sites</SectionSubhead>
        <div className="px-4 pb-3 pt-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Action</th>
                <th className="pb-2 pr-3 font-medium">Approvers</th>
                <th className="pb-2 font-medium">Mode</th>
              </tr>
            </thead>
            <tbody>
              {APPROVAL_POLICY_ROWS.map(({ countKey, label }) => {
                const raw = cfg[countKey]
                const count = raw === undefined || raw === null ? 1 : Number(raw)
                return (
                  <tr key={countKey} className="border-t border-border/40">
                    <td className="py-2 pr-3">{label}</td>
                    <td className="py-2 pr-3">
                      <select
                        disabled={!canManage}
                        value={Number.isFinite(count) ? count : 1}
                        onChange={(e) => patchApproverCount(countKey, Number(e.target.value))}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value={0}>N/A</option>
                        {[1,2,3,4,5,6,7,8,9,10].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </td>
                    <td className="py-2">
                      <span className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-medium',
                        count >= 2 ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground',
                      )}>
                        {approverModeLabel(count)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Scoped overrides */}
        <div ref={scopedOverridesRef} className="border-t border-border/40">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Scoped overrides
            </p>
            {canManage && !creatingRule && (
              <Button size="sm" variant="outline" className="h-7" onClick={openRuleCreate}>
                <Plus className="mr-1 h-3 w-3" /> Create new rule
              </Button>
            )}
          </div>

          <div className="px-4 pb-3">
            <p className="mb-3 text-xs text-muted-foreground">
              Strictest-wins: scoped rules can raise but never lower the default floor.
            </p>

            {/* ── Inline create form ── */}
            {creatingRule && (
              <div className="mb-4 rounded-lg border border-primary/40 bg-primary/5 p-4">
                <p className="mb-3 text-sm font-semibold">New approval rule</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {/* Action */}
                  <label className="col-span-2 block sm:col-span-1">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Action</span>
                    <select
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      value={newRule.action || 'batch_release'}
                      onChange={(e) => patchNewRule('action', e.target.value)}
                    >
                      {PHARMA_ACTIONS.map((a) => (
                        <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
                      ))}
                    </select>
                  </label>

                  {/* Required approvers */}
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Approvers required</span>
                    <select
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      value={newRule.required_approvers ?? 2}
                      onChange={(e) => patchNewRule('required_approvers', Number(e.target.value))}
                    >
                      <option value={0}>N/A</option>
                      {[1,2,3,4,5,6,7,8,9,10].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>

                  {/* Priority */}
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Priority</span>
                    <input type="number" min={0}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      value={newRule.priority ?? 100}
                      onChange={(e) => patchNewRule('priority', Number(e.target.value))}
                    />
                  </label>
                </div>

                {/* Scope selectors */}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Product (optional)</span>
                    <select
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      disabled={ruleScopesLoading}
                      value={newRule.product_id ?? ''}
                      onChange={(e) => patchNewRule('product_id', e.target.value || null)}
                    >
                      <option value="">— any —</option>
                      {ruleScopes.products.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Plant (optional)</span>
                    <select
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      disabled={ruleScopesLoading}
                      value={newRule.plant_id ?? ''}
                      onChange={(e) => patchNewRule('plant_id', e.target.value || null)}
                    >
                      <option value="">— any —</option>
                      {ruleScopes.plants.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">BU / Branch (optional)</span>
                    <select
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      disabled={ruleScopesLoading}
                      value={newRule.store_id ?? ''}
                      onChange={(e) => patchNewRule('store_id', e.target.value || null)}
                    >
                      <option value="">— any —</option>
                      {ruleScopes.stores.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </label>
                </div>

                {/* Flags row */}
                <div className="mt-3 flex flex-wrap gap-4">
                  {[
                    { key: 'sequential',        label: 'Sequential signing' },
                    { key: 'forbid_initiator',  label: 'Initiator may not sign' },
                    { key: 'overrides_default', label: 'Overrides default floor' },
                    { key: 'is_default',        label: 'Default rule' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex cursor-pointer items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-primary"
                        checked={!!(newRule as any)[key]}
                        onChange={(e) => patchNewRule(key, e.target.checked)}
                      />
                      {label}
                    </label>
                  ))}
                </div>

                {/* Notes */}
                <label className="mt-3 block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Notes (optional)</span>
                  <textarea rows={2} className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                    value={newRule.notes || ''}
                    onChange={(e) => patchNewRule('notes', e.target.value || null)}
                  />
                </label>

                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" onClick={saveNewRule}>Create rule</Button>
                  <Button size="sm" variant="ghost" onClick={() => setCreatingRule(false)}>Cancel</Button>
                  <button
                    type="button"
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground hover:underline"
                    onClick={() => { setCreatingRule(false); setDrawerRule(emptyRule()) }}
                  >
                    Advanced options (signer steps) →
                  </button>
                </div>
              </div>
            )}

            {/* ── Rules table ── */}
            {scopedRules.length === 0 && !creatingRule ? (
              <div className="rounded-md border border-dashed border-border/60 py-6 text-center">
                <p className="text-xs text-muted-foreground">No scoped rules yet — default applies everywhere.</p>
                {canManage && (
                  <button
                    className="mt-1.5 text-xs font-medium text-primary hover:underline"
                    onClick={openRuleCreate}
                  >
                    Create your first rule →
                  </button>
                )}
              </div>
            ) : scopedRules.length > 0 && (
              <div className="overflow-hidden rounded-md border border-border/50">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 font-medium">ID</th>
                      <th className="px-3 py-2 font-medium">Action</th>
                      <th className="px-3 py-2 font-medium">Scope</th>
                      <th className="px-3 py-2 font-medium">Mode</th>
                      {canManage && <th className="px-3 py-2 font-medium" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {scopedRules.map((rule) => (
                      <tr key={rule.id} className="bg-background hover:bg-muted/20">
                        <td className="px-3 py-2.5">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {rule.id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-medium">
                          {ACTION_LABELS[rule.action] || rule.action}
                          {rule.overrides_default && (
                            <span className="ml-1.5 rounded bg-blue-100 px-1 py-0.5 text-[9px] font-medium text-blue-700">override</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{scopeSummary(rule)}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-medium',
                            rule.required_approvers >= 2 ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground',
                          )}>
                            {rule.sequential ? 'sequential' : approverModeLabel(rule.required_approvers)}
                          </span>
                          {rule.steps.length > 0 && (
                            <span className="ml-1 text-[10px] text-muted-foreground">{rule.steps.length} step(s)</span>
                          )}
                        </td>
                        {canManage && (
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex justify-end gap-3">
                              <button className="text-primary hover:underline" onClick={() => setDrawerRule(rule)}>Edit</button>
                              <button className="text-destructive hover:underline" onClick={() => deactivateRule(rule.id)}>Deactivate</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* DB-managed defaults */}
            {defaultRules.length > 0 && (
              <div className="mt-3 border-t border-border/40 pt-3">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">DB default rules</p>
                <div className="overflow-hidden rounded-md border border-border/50">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-border/30">
                      {defaultRules.map((r) => (
                        <tr key={r.id} className="bg-background hover:bg-muted/20">
                          <td className="px-3 py-2">
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                              {r.id.slice(0, 8)}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-medium">{ACTION_LABELS[r.action] || r.action}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.required_approvers}× approvers</td>
                          {canManage && (
                            <td className="px-3 py-2 text-right">
                              <button className="text-primary hover:underline" onClick={() => setDrawerRule(r)}>Edit</button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Signer groups */}
        <div className="border-t border-border/40">
          <SectionSubhead>
            Signer panels
            {signerGroups.length > 0 && (
              <span className="ml-1.5 font-normal normal-case text-muted-foreground">
                — {signerGroups.length} panel{signerGroups.length !== 1 ? 's' : ''}
              </span>
            )}
          </SectionSubhead>
          <div className="px-4 pb-4 pt-1">
            <p className="mb-2 text-xs text-muted-foreground">
              Define named signer panels with a code (e.g. <span className="font-mono">QA-BOARD</span>) and reference them in rule signer steps.
            </p>
            <SignerGroupsCard canManage={canManage} groups={signerGroups} onRefresh={load} />
          </div>
        </div>
      </SettingsSection>

      {/* ══ Section 4: Distribution & track-and-trace ══ */}
      <SettingsSection
        title="Distribution & track-and-trace"
        description="Shipping gates and serialization obligations — checked independently of the e-sign flow."
        status={
          <div className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            {regionBadge(cfg.track_trace_region || 'none')}
          </div>
        }
      >
        <SettingRow
          label="Block ship without valid wholesale licence"
          description="At dispatch: the customer must have a licence number that has not expired."
          disabled={!canManage}
          control={
            <Switch
              checked={!!cfg.wholesale_license_check}
              disabled={!canManage}
              onCheckedChange={(v) => patchEsign('wholesale_license_check', v)}
            />
          }
        />
        <SettingRow
          label="Auto-write EPCIS events on serial lifecycle"
          description="Appends EPCIS commissioning, shipping and decommission events automatically as serials progress."
          disabled={!canManage}
          control={
            <Switch
              checked={!!cfg.auto_epcis_on_serial}
              disabled={!canManage}
              onCheckedChange={(v) => patchEsign('auto_epcis_on_serial', v)}
            />
          }
        />

        {/* Vendor-wide region */}
        <SettingRow
          label="Vendor-wide track & trace region"
          description="Applies when no BU / branch / plant override is set."
          control={
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canManage}
              value={cfg.track_trace_region || 'none'}
              onChange={(e) =>
                pharmaApi.patchSettings({ track_trace_region: e.target.value })
                  .then((next) => { setCfg(next); toast.success('Default region updated') })
                  .catch((err: any) => toast.error(err?.response?.data?.detail || 'Failed'))
              }
            >
              {REGION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          }
        />

        {/* Per-org overrides */}
        <div className="border-t border-border/40">
          <SectionSubhead>
            Org overrides
            <span className="ml-1.5 font-normal normal-case">(plant › branch › BU › vendor default)</span>
          </SectionSubhead>
          <div className="px-4 pb-3 pt-1">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Per-site region overrides.</p>
              {canManage && (
                <button onClick={() => setAddingRegion((v) => !v)}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  {addingRegion ? <XIcon className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {addingRegion ? 'Cancel' : 'Add override'}
                </button>
              )}
            </div>

            {addingRegion && (
              <div className="mb-3 rounded-md border border-border/60 bg-muted/30 p-3">
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-0.5 block text-[10px] text-muted-foreground">Org type</span>
                    <select className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                      value={newRegionScope}
                      onChange={(e) => { setNewRegionScope(e.target.value as 'store' | 'plant'); setNewRegionId('') }}>
                      <option value="store">BU / Branch</option>
                      <option value="plant">Plant</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-0.5 block text-[10px] text-muted-foreground">Region</span>
                    <select className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                      value={newRegionValue} onChange={(e) => setNewRegionValue(e.target.value)}>
                      {REGION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                </div>
                <label className="mb-3 block">
                  <span className="mb-0.5 block text-[10px] text-muted-foreground">
                    {newRegionScope === 'store' ? 'BU / Branch' : 'Plant'}
                  </span>
                  {newRegionScope === 'store' && orgStores.length > 0 ? (
                    <select className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                      value={newRegionId} onChange={(e) => setNewRegionId(e.target.value)}>
                      <option value="">— select —</option>
                      {orgStores.map((s) => (
                        <option key={s.id} value={s.id}>[{s.unit_type === 'branch' ? 'Branch' : 'BU'}] {s.name}</option>
                      ))}
                    </select>
                  ) : newRegionScope === 'plant' && orgPlants.length > 0 ? (
                    <select className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                      value={newRegionId} onChange={(e) => setNewRegionId(e.target.value)}>
                      <option value="">— select —</option>
                      {orgPlants.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                    </select>
                  ) : (
                    <input type="text" placeholder="UUID"
                      className="h-8 w-full rounded border border-input bg-background px-2 text-xs font-mono"
                      value={newRegionId} onChange={(e) => setNewRegionId(e.target.value)} />
                  )}
                </label>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveOrgRegion}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAddingRegion(false); setNewRegionId('') }}>Cancel</Button>
                </div>
              </div>
            )}

            {orgRegions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No overrides — vendor default applies everywhere.</p>
            ) : (
              <div className="space-y-1">
                {orgRegions.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-background px-3 py-2 text-xs">
                    <span className="flex-1">{orgNameFor(row)}</span>
                    <div className="flex items-center gap-2">
                      {regionBadge(row.track_trace_region)}
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {row.plant_id ? 'plant' : 'store'}
                      </span>
                    </div>
                    {canManage && (
                      <button onClick={() => removeOrgRegion(row.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SettingsSection>

      {/* ── Verify policy sheet ── */}
      <Sheet open={verifyOpen} onOpenChange={setVerifyOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Verify effective policy
            </SheetTitle>
          </SheetHeader>
          <p className="mt-1 text-xs text-muted-foreground">
            Dry-run: resolve and preview the merged policy for any action + context before it affects a real batch.
          </p>
          <div className="mt-4">
            <VerifyPolicyPanel />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Rule drawer ── */}
      {drawerRule && (
        <RuleDrawer
          initial={drawerRule}
          signerGroups={signerGroups}
          onSave={saveRule}
          onClose={() => setDrawerRule(null)}
        />
      )}
    </div>
  )
}
