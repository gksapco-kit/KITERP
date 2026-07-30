import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  Hash,
  Layers,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { pharmaApi } from '@/api/pharma'
import { askConfirm } from '@/components/common/ConfirmProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import { extractApiError } from '@/lib/errorMessages'
import { useHasPermission } from '@/hooks/usePermissions'
import { PharmaCard } from './pharmaShared'

type LinkedModel = {
  id: string
  code: string
  label: string
  is_active?: boolean
  is_default?: boolean
}

type SequenceRow = {
  id: string
  prefix: string
  plant_id?: string | null
  product_id?: string | null
  last_number: number
  pad_width: number
  period_key?: string
  batch_count?: number
  linked_models?: LinkedModel[]
  created_at?: string | null
  updated_at?: string | null
}

type ModelRow = {
  id: string
  code: string
  label: string
  pattern: string
  prefix: string
  pad_width: number
  reset_period: string
  scope: string
  applies_to: string
  is_default: boolean
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

const RESET_LABELS: Record<string, string> = {
  never: 'Never',
  yearly: 'Yearly',
  monthly: 'Monthly',
  daily: 'Daily',
}

const SCOPE_LABELS: Record<string, string> = {
  vendor: 'Vendor-wide',
  plant: 'Per plant',
  product: 'Per product',
}

const APPLIES_OPTIONS = ['manual', 'production', 'receipt', 'return', 'serial']

const TOKEN_CHIPS = [
  { token: '{PREFIX}', hint: 'Prefix value' },
  { token: '{YYYY}', hint: '4-digit year' },
  { token: '{YY}', hint: '2-digit year' },
  { token: '{YYYYMM}', hint: 'Year-month' },
  { token: '{YYYYMMDD}', hint: 'Compact date' },
  { token: '{MM}', hint: 'Month' },
  { token: '{DD}', hint: 'Day' },
  { token: '{SEQ}', hint: 'Counter (required)' },
]

/** Match sequence → model by prefix + reset/period (no FK in DB). */
function periodMatchesReset(periodKey: string | undefined, resetPeriod: string): boolean {
  const pk = (periodKey || '').trim()
  const rp = (resetPeriod || 'never').toLowerCase()
  if (rp === 'never') return pk === ''
  if (rp === 'yearly') return /^\d{4}$/.test(pk)
  if (rp === 'monthly') return /^\d{6}$/.test(pk)
  if (rp === 'daily') return /^\d{8}$/.test(pk)
  return true
}

function modelsForSequence(seq: SequenceRow, models: ModelRow[]): ModelRow[] {
  const prefix = (seq.prefix || '').toUpperCase()
  return models.filter(
    (m) =>
      (m.prefix || '').toUpperCase() === prefix &&
      periodMatchesReset(seq.period_key, m.reset_period),
  )
}

function sequencesForModel(model: ModelRow, sequences: SequenceRow[]): SequenceRow[] {
  const prefix = (model.prefix || '').toUpperCase()
  return sequences.filter(
    (s) =>
      (s.prefix || '').toUpperCase() === prefix &&
      periodMatchesReset(s.period_key, model.reset_period),
  )
}

function renderPreview(pattern: string, prefix: string, padWidth: number): string {
  if (!pattern || !pattern.includes('{SEQ}')) return ''
  const today = new Date()
  const pad = (n: number, w: number) => String(n).padStart(w, '0')
  const YYYY = String(today.getFullYear())
  const YY = YYYY.slice(2)
  const MM = pad(today.getMonth() + 1, 2)
  const DD = pad(today.getDate(), 2)
  const num = '1'.padStart(Math.max(2, padWidth), '0')
  return pattern
    .replace('{PREFIX}', prefix.toUpperCase() || 'B')
    .replace('{YYYYMMDD}', `${YYYY}${MM}${DD}`)
    .replace('{YYYYMM}', `${YYYY}${MM}`)
    .replace('{YYYY}', YYYY)
    .replace('{YY}', YY)
    .replace('{MM}', MM)
    .replace('{DD}', DD)
    .replace('{SEQ}', num)
}

const BLANK_FORM = {
  code: '',
  label: '',
  pattern: '{PREFIX}-{SEQ}',
  prefix: 'B',
  pad_width: 5,
  reset_period: 'never',
  scope: 'vendor',
  applies_to: 'manual',
  is_default: false,
  is_active: true,
}

export default function PharmaSettingsBatchNumberingPage() {
  const navigate = useNavigate()
  const canManage = useHasPermission('pharma.manage')
  const [searchParams] = useSearchParams()
  const scopePlantId = searchParams.get('plant_id') || undefined

  const [nextNumber, setNextNumber] = useState('')
  const [sequences, setSequences] = useState<SequenceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedModelCode, setSelectedModelCode] = useState('')
  const [highlightSeqId, setHighlightSeqId] = useState<string | null>(null)

  const [models, setModels] = useState<ModelRow[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  /** null = closed; view = read-only; edit/create = editable form */
  const [panelMode, setPanelMode] = useState<'view' | 'edit' | 'create' | null>(null)
  const [editingModel, setEditingModel] = useState<ModelRow | null>(null)
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const patternRef = useRef<HTMLInputElement>(null)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const modelPanelOpen = panelMode !== null
  const isFormEditable = panelMode === 'edit' || panelMode === 'create'

  const activeModels = models.filter((m) => m.is_active)
  const selectedModel =
    activeModels.find((m) => m.code === selectedModelCode) ||
    activeModels.find((m) => m.is_default && m.applies_to.split(',').map((s) => s.trim()).includes('manual')) ||
    activeModels.find((m) => m.applies_to.split(',').map((s) => s.trim()).includes('manual')) ||
    activeModels[0] ||
    null

  const loadSequences = async () => {
    setLoading(true)
    try {
      const seqRes = await pharmaApi.sequences(scopePlantId ? { plant_id: scopePlantId } : undefined)
      setSequences(seqRes?.sequences || [])
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Failed to load sequences'))
    } finally {
      setLoading(false)
    }
  }

  const loadModels = async () => {
    setModelsLoading(true)
    try {
      const res = await pharmaApi.listModels()
      const list: ModelRow[] = res?.models || []
      setModels(list)
      if (!selectedModelCode) {
        const preferred =
          list.find((m) => m.is_active && m.is_default) ||
          list.find((m) => m.is_active) ||
          null
        if (preferred) setSelectedModelCode(preferred.code)
      }
    } catch {
      // ignore
    } finally {
      setModelsLoading(false)
    }
  }

  useEffect(() => {
    loadSequences()
    loadModels()
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    }
  }, [])

  const flashAllocated = (seqId: string | null) => {
    setHighlightSeqId(seqId)
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = setTimeout(() => setHighlightSeqId(null), 5000)
  }

  const clearAllocationHighlight = () => {
    setNextNumber('')
    setHighlightSeqId(null)
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = null
    }
  }

  const allocate = async () => {
    if (!selectedModel) {
      toast.error('Create a numbering model first')
      return
    }
    try {
      const res = await pharmaApi.nextBatchNumber({
        model_code: selectedModel.code,
        purpose: 'manual',
      })
      setNextNumber(res.batch_number)
      toast.success(`Allocated ${res.batch_number}`)
      const seqRes = await pharmaApi.sequences()
      const list: SequenceRow[] = seqRes?.sequences || []
      setSequences(list)
      const prefix = (selectedModel.prefix || '').toUpperCase()
      const matched =
        list.find(
          (s) =>
            (s.prefix || '').toUpperCase() === prefix &&
            periodMatchesReset(s.period_key, selectedModel.reset_period),
        ) ||
        list.find((s) => (s.prefix || '').toUpperCase() === prefix) ||
        null
      flashAllocated(matched?.id ?? null)
      if (matched?.id) {
        requestAnimationFrame(() => {
          document
            .getElementById(`seq-row-${matched.id}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        })
      }
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Allocation failed'))
    }
  }

  const insertToken = (token: string) => {
    const el = patternRef.current
    if (!el) {
      setForm((f) => ({ ...f, pattern: f.pattern + token }))
      return
    }
    const start = el.selectionStart ?? form.pattern.length
    const end = el.selectionEnd ?? start
    const next = form.pattern.slice(0, start) + token + form.pattern.slice(end)
    setForm((f) => ({ ...f, pattern: next }))
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    }, 0)
  }

  const fillFormFromModel = (m: ModelRow) => {
    setForm({
      code: m.code,
      label: m.label,
      pattern: m.pattern,
      prefix: m.prefix,
      pad_width: m.pad_width,
      reset_period: m.reset_period,
      scope: m.scope,
      applies_to: m.applies_to,
      is_default: m.is_default,
      is_active: m.is_active,
    })
  }

  const openCreate = () => {
    setEditingModel(null)
    setForm({ ...BLANK_FORM })
    setPanelMode('create')
  }

  /** Row click — read-only display. */
  const openView = (m: ModelRow) => {
    setSelectedModelCode(m.code)
    clearAllocationHighlight()
    setEditingModel(m)
    fillFormFromModel(m)
    setPanelMode('view')
  }

  /** Edit button — editable form. */
  const openEdit = (m: ModelRow) => {
    setSelectedModelCode(m.code)
    clearAllocationHighlight()
    setEditingModel(m)
    fillFormFromModel(m)
    setPanelMode('edit')
  }

  /** Toolbar dropdown: only switches allocate target (does not open edit). */
  const selectModelForAllocate = (code: string) => {
    setSelectedModelCode(code)
    clearAllocationHighlight()
    const m = models.find((row) => row.code === code)
    if (m && panelMode) {
      setEditingModel(m)
      fillFormFromModel(m)
      // Keep current mode, but never escalate view → edit via dropdown
      if (panelMode === 'create') setPanelMode('view')
    }
  }

  const closePanel = () => setPanelMode(null)

  const saveModel = async () => {
    if (!form.pattern.includes('{SEQ}')) {
      toast.error('Pattern must contain the {SEQ} token')
      return
    }
    setSaving(true)
    try {
      if (editingModel) {
        await pharmaApi.updateModel(editingModel.id, {
          label: form.label,
          pattern: form.pattern,
          prefix: form.prefix,
          pad_width: form.pad_width,
          reset_period: form.reset_period,
          scope: form.scope,
          applies_to: form.applies_to,
          is_default: form.is_default,
          is_active: form.is_active,
        })
        toast.success('Model updated')
      } else {
        const created = await pharmaApi.createModel({
          code: form.code.trim().toUpperCase(),
          label: form.label,
          pattern: form.pattern,
          prefix: form.prefix,
          pad_width: form.pad_width,
          reset_period: form.reset_period,
          scope: form.scope,
          applies_to: form.applies_to,
          is_default: form.is_default,
          is_active: form.is_active,
        })
        toast.success('Model created')
        const code = created?.model?.code || form.code.trim().toUpperCase()
        setSelectedModelCode(code)
      }
      setPanelMode(null)
      await loadModels()
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Save failed'))
    } finally {
      setSaving(false)
    }
  }

  const deleteModel = async (id: string) => {
    const ok = await askConfirm({
      title: 'Delete this batch number model?',
      description: 'This cannot be undone. Existing sequences and allocated numbers are not removed.',
      variant: 'danger',
    })
    if (!ok) return
    setDeletingId(id)
    try {
      await pharmaApi.deleteModel(id)
      toast.success('Model deleted')
      if (selectedModel?.id === id) setSelectedModelCode('')
      if (editingModel?.id === id) closePanel()
      await loadModels()
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Delete failed'))
    } finally {
      setDeletingId(null)
    }
  }

  const formPreview = renderPreview(form.pattern, form.prefix, form.pad_width)
  const allocatePreview = selectedModel
    ? renderPreview(selectedModel.pattern, selectedModel.prefix, selectedModel.pad_width)
    : null

  const fieldLabel = 'mb-0.5 block text-[11px] font-medium text-muted-foreground'
  const selectCls =
    'h-8 w-full rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50'

  return (
    <div className="space-y-3 p-4 md:p-6">
      <div>
        <Link
          to="/pharma/settings"
          className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Foundations
        </Link>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Pharmaceutical Manufacturing
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Batch numbering</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Models define the pattern and purpose. Sequences track the live counter.
              Allocate issues the next number (row opens view; Edit unlocks changes).
            </p>
          </div>
          {canManage ? (
            <Button size="sm" className="h-8 gap-1.5" onClick={openCreate} disabled={panelMode === 'create'}>
              <Plus className="h-3.5 w-3.5" />
              New model
            </Button>
          ) : null}
        </div>
      </div>

      {/* Models + allocate + form — one card */}
      <PharmaCard className="overflow-hidden p-0">
        {/* Toolbar: allocate + actions */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <h2 className="mr-auto flex items-center gap-1.5 text-sm font-semibold">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            Numbering models
            {!modelsLoading ? (
              <span className="font-normal text-muted-foreground">({models.length})</span>
            ) : null}
          </h2>

          {activeModels.length > 0 ? (
            <>
              <select
                className="h-8 max-w-[200px] rounded-md border border-input bg-background px-2 text-xs"
                value={selectedModelCode || selectedModel?.code || ''}
                onChange={(e) => selectModelForAllocate(e.target.value)}
                title="Select numbering model for allocate"
              >
                {activeModels.map((m) => (
                  <option key={m.id} value={m.code}>
                    {m.code}
                  </option>
                ))}
              </select>
              <Button size="sm" className="h-8" onClick={allocate} disabled={!canManage || !selectedModel}>
                Allocate
              </Button>
              {nextNumber ? (
                <span
                  className="rounded-md bg-emerald-500/15 px-2 py-1 font-mono text-xs font-semibold text-emerald-800 ring-1 ring-emerald-500/25 dark:text-emerald-300"
                  title="Newly allocated"
                >
                  {nextNumber}
                </span>
              ) : null}
              {!nextNumber && allocatePreview ? (
                <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
                  next ≈ {allocatePreview}
                </span>
              ) : null}
            </>
          ) : null}
        </div>

        {/* Compact view / create / edit panel */}
        {modelPanelOpen ? (
          <div className="border-b border-border bg-muted/25 px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold">
                {panelMode === 'create'
                  ? 'New model'
                  : panelMode === 'edit'
                    ? `Edit · ${editingModel?.code}`
                    : `View · ${editingModel?.code}`}
              </h3>
              <div className="flex items-center gap-1.5">
                {formPreview ? (
                  <span className="mr-1 hidden font-mono text-[11px] text-muted-foreground md:inline">
                    {formPreview}
                  </span>
                ) : null}
                {panelMode === 'view' && canManage && editingModel ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2.5 text-xs"
                    onClick={() => openEdit(editingModel)}
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </Button>
                ) : null}
                {isFormEditable && canManage ? (
                  <Button size="sm" className="h-7 px-2.5 text-xs" onClick={saveModel} disabled={saving || !formPreview}>
                    {saving ? 'Saving…' : panelMode === 'create' ? 'Create' : 'Update'}
                  </Button>
                ) : null}
                <button
                  type="button"
                  className="rounded p-1 hover:bg-muted"
                  onClick={closePanel}
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {isFormEditable ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-4 lg:grid-cols-6">
              {panelMode === 'create' ? (
                <div>
                  <label className={fieldLabel}>Code *</label>
                  <Input
                    className="h-8 font-mono text-xs uppercase"
                    placeholder="FG_MONTHLY"
                    value={form.code}
                    maxLength={40}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    disabled={!canManage}
                  />
                </div>
              ) : null}

              <div className={panelMode === 'create' ? '' : 'md:col-span-2'}>
                <label className={fieldLabel}>Label *</label>
                <Input
                  className="h-8 text-xs"
                  placeholder="Finished Goods monthly"
                  value={form.label}
                  maxLength={120}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  disabled={!canManage}
                />
              </div>

              <div>
                <label className={fieldLabel}>Prefix</label>
                <Input
                  className="h-8 font-mono text-xs uppercase"
                  placeholder="FG"
                  value={form.prefix}
                  maxLength={40}
                  onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value.toUpperCase() }))}
                  disabled={!canManage}
                />
              </div>

              <div>
                <label className={fieldLabel}>Pad</label>
                <select
                  className={selectCls}
                  value={form.pad_width}
                  onChange={(e) => setForm((f) => ({ ...f, pad_width: Number(e.target.value) }))}
                  disabled={!canManage}
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={fieldLabel}>Reset</label>
                <select
                  className={selectCls}
                  value={form.reset_period}
                  onChange={(e) => setForm((f) => ({ ...f, reset_period: e.target.value }))}
                  disabled={!canManage}
                >
                  {Object.entries(RESET_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={fieldLabel}>Scope</label>
                <select
                  className={selectCls}
                  value={form.scope}
                  onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
                  disabled={!canManage}
                >
                  {Object.entries(SCOPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 md:col-span-4 lg:col-span-6">
                <label className={fieldLabel}>
                  Pattern * <span className="font-normal">({'{SEQ}'} required)</span>
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Input
                    ref={patternRef}
                    className="h-8 min-w-[180px] flex-1 font-mono text-xs"
                    placeholder="{PREFIX}-{YYYY}-{SEQ}"
                    value={form.pattern}
                    maxLength={120}
                    onChange={(e) => setForm((f) => ({ ...f, pattern: e.target.value }))}
                    disabled={!canManage}
                  />
                  {TOKEN_CHIPS.map(({ token, hint }) => (
                    <button
                      key={token}
                      type="button"
                      title={hint}
                      className="h-7 rounded border border-border bg-background px-1.5 font-mono text-[10px] hover:bg-muted disabled:opacity-50"
                      onClick={() => insertToken(token)}
                      disabled={!canManage}
                    >
                      {token}
                    </button>
                  ))}
                </div>
                {!formPreview ? (
                  <p className="mt-0.5 text-[11px] text-destructive">Pattern must contain {'{SEQ}'}</p>
                ) : (
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground md:hidden">{formPreview}</p>
                )}
              </div>

              <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 md:col-span-4 lg:col-span-6">
                <span className={fieldLabel + ' mb-0 mr-1'}>Applies to</span>
                {APPLIES_OPTIONS.map((opt) => {
                  const selected = form.applies_to.split(',').map((s) => s.trim()).includes(opt)
                  return (
                    <label key={opt} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={selected}
                        disabled={!canManage}
                        onChange={(e) => {
                          const cur = new Set(form.applies_to.split(',').map((s) => s.trim()).filter(Boolean))
                          if (e.target.checked) cur.add(opt)
                          else cur.delete(opt)
                          setForm((f) => ({ ...f, applies_to: [...cur].join(',') }))
                        }}
                      />
                      {opt}
                    </label>
                  )
                })}
                <label className="ml-auto flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={form.is_default}
                    disabled={!canManage}
                    onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
                  />
                  Default
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={form.is_active}
                    disabled={!canManage}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  />
                  Active
                </label>
              </div>
            </div>
            ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs md:grid-cols-4 lg:grid-cols-6">
              <div className="md:col-span-2">
                <div className={fieldLabel}>Label</div>
                <div className="font-medium">{form.label || '—'}</div>
              </div>
              <div>
                <div className={fieldLabel}>Prefix</div>
                <div className="font-mono font-medium">{form.prefix || '—'}</div>
              </div>
              <div>
                <div className={fieldLabel}>Pad</div>
                <div className="tabular-nums">{form.pad_width}</div>
              </div>
              <div>
                <div className={fieldLabel}>Reset</div>
                <div>{RESET_LABELS[form.reset_period] ?? form.reset_period}</div>
              </div>
              <div>
                <div className={fieldLabel}>Scope</div>
                <div>{SCOPE_LABELS[form.scope] ?? form.scope}</div>
              </div>
              <div className="col-span-2 md:col-span-4 lg:col-span-6">
                <div className={fieldLabel}>Pattern</div>
                <div className="font-mono text-muted-foreground">{form.pattern}</div>
              </div>
              <div className="col-span-2 md:col-span-4 lg:col-span-4">
                <div className={fieldLabel}>Applies to</div>
                <div className="capitalize text-muted-foreground">
                  {form.applies_to
                    .split(',')
                    .map((a) => a.trim())
                    .filter(Boolean)
                    .join(', ') || '—'}
                </div>
              </div>
              <div className="col-span-2 flex flex-wrap gap-1.5 lg:col-span-2 lg:justify-end">
                {form.is_default ? (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">Default</span>
                ) : null}
                {form.is_active ? (
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">Active</span>
                ) : (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Off</span>
                )}
              </div>
            </div>
            )}
          </div>
        ) : null}

        {modelsLoading ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">Loading…</p>
        ) : null}

        {!modelsLoading && models.length === 0 && !modelPanelOpen ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">
            No models yet — click <span className="font-medium text-foreground">New model</span> to define a pattern like{' '}
            <span className="font-mono">{'{PREFIX}-{YYYY}-{SEQ}'}</span>.
          </p>
        ) : null}

        {!modelsLoading && models.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="border-b bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-1.5 font-medium">Code</th>
                  <th className="px-3 py-1.5 font-medium">Label</th>
                  <th className="px-3 py-1.5 font-medium">Prefix</th>
                  <th className="px-3 py-1.5 font-medium">Pattern</th>
                  <th className="px-3 py-1.5 font-medium">Applies</th>
                  <th className="px-3 py-1.5 font-medium">Reset</th>
                  <th className="px-3 py-1.5 font-medium">Sequence</th>
                  <th className="px-3 py-1.5 font-medium">Flags</th>
                  <th className="px-3 py-1.5 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {models.map((m) => {
                  const linkedSeqs = sequencesForModel(m, sequences)
                  const isSelected = m.code === selectedModelCode
                  return (
                  <tr
                    key={m.id}
                    className={`cursor-pointer hover:bg-muted/50 ${!m.is_active ? 'opacity-50' : ''} ${
                      isSelected ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : ''
                    }`}
                    onClick={() => openView(m)}
                  >
                    <td className="px-3 py-1.5 font-mono font-semibold text-primary">{m.code}</td>
                    <td className="px-3 py-1.5">{m.label}</td>
                    <td className="px-3 py-1.5 font-mono font-medium">{m.prefix}</td>
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">{m.pattern}</td>
                    <td className="px-3 py-1.5 capitalize text-muted-foreground">
                      {m.applies_to.split(',').map((a) => a.trim()).join(', ')}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {RESET_LABELS[m.reset_period] ?? m.reset_period}
                    </td>
                    <td className="px-3 py-1.5">
                      {linkedSeqs.length === 0 ? (
                        <span className="text-muted-foreground">None yet</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {linkedSeqs.map((s) => (
                            <Link
                              key={s.id}
                              to={`/pharma/settings/batch-numbering/${s.id}`}
                              className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                              title={s.period_key ? `Period ${s.period_key}` : 'No period reset'}
                            >
                              {s.prefix}
                              {s.period_key ? ` · ${s.period_key}` : ''}
                            </Link>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="flex flex-wrap gap-1">
                        {m.is_default ? (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">Default</span>
                        ) : null}
                        {!m.is_active ? (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Off</span>
                        ) : null}
                        {!m.is_default && m.is_active ? '—' : null}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <div className="inline-flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          className="inline-flex rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Edit"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEdit(m)
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {canManage ? (
                          <button
                            type="button"
                            className="inline-flex rounded p-1 text-destructive hover:bg-destructive/10"
                            title="Delete"
                            disabled={deletingId === m.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteModel(m.id)
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </PharmaCard>

      {/* Sequences */}
      <PharmaCard className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Hash className="h-3.5 w-3.5 text-muted-foreground" />
            Sequences
          </h2>
          <span className="text-[11px] text-muted-foreground">{sequences.length} total</span>
        </div>

        {loading ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">Loading…</p>
        ) : null}
        {!loading && sequences.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">
            No sequences yet — allocate from a model to create the first counter.
          </p>
        ) : null}

        {!loading && sequences.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="border-b bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-1.5 font-medium">Prefix</th>
                  <th className="px-3 py-1.5 font-medium">Model</th>
                  <th className="px-3 py-1.5 font-medium">Last #</th>
                  <th className="px-3 py-1.5 font-medium">Pad</th>
                  <th className="px-3 py-1.5 font-medium">Period</th>
                  <th className="px-3 py-1.5 font-medium">Batches</th>
                  <th className="px-3 py-1.5 font-medium">Scope</th>
                  <th className="px-3 py-1.5 font-medium">Updated</th>
                  <th className="px-3 py-1.5 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {sequences.map((s) => {
                  const linked =
                    (s.linked_models && s.linked_models.length > 0
                      ? s.linked_models
                      : modelsForSequence(s, models).map((m) => ({
                          id: m.id,
                          code: m.code,
                          label: m.label,
                          is_active: m.is_active,
                          is_default: m.is_default,
                        }))) as LinkedModel[]
                  const isFresh = highlightSeqId === s.id
                  return (
                  <tr
                    id={`seq-row-${s.id}`}
                    key={s.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      isFresh
                        ? 'bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/30'
                        : ''
                    }`}
                    {...onClickableTableRow(() => navigate(`/pharma/settings/batch-numbering/${s.id}`))}
                  >
                    <td className="px-3 py-1.5">
                      <Link
                        to={`/pharma/settings/batch-numbering/${s.id}`}
                        className="font-mono font-semibold text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {s.prefix}
                      </Link>
                      {isFresh && nextNumber ? (
                        <span className="ml-1.5 rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
                          {nextNumber}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5">
                      {linked.length === 0 ? (
                        <span
                          className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          title="No numbering model uses this prefix and reset period"
                        >
                          Orphan
                        </span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {linked.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              className={`rounded px-1.5 py-0.5 font-mono text-[10px] hover:underline ${
                                m.is_active === false
                                  ? 'bg-muted text-muted-foreground'
                                  : 'bg-primary/10 text-primary'
                              }`}
                              title={m.label}
                              onClick={(e) => {
                                e.stopPropagation()
                                const full = models.find((row) => row.id === m.id)
                                if (full) openView(full)
                                else setSelectedModelCode(m.code)
                              }}
                            >
                              {m.code}
                            </button>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className={`px-3 py-1.5 tabular-nums ${isFresh ? 'font-semibold text-emerald-800 dark:text-emerald-300' : ''}`}>
                      {s.last_number}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums">{s.pad_width}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{s.period_key || '—'}</td>
                    <td className="px-3 py-1.5 tabular-nums">{s.batch_count ?? '—'}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {s.product_id ? 'Product' : s.plant_id ? 'Plant' : 'Vendor'}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {s.updated_at ? new Date(s.updated_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </PharmaCard>
    </div>
  )
}
