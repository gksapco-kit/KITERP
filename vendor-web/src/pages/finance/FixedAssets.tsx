import { useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import {
  useAssets, useAsset, useCreateAsset, useUpdateAsset, useRunDepreciation, useDisposeAsset,
  useAssetCategories, useCreateAssetCategory, useUpdateAssetCategory,
  useAssetMaintenance, useCreateMaintenance, useAccounts,
} from '@/hooks/useFinance'
import { useStores } from '@/hooks/useVendor'
import { BusinessUnitSelect } from '@/components/common/BusinessUnitSelect'
import { BranchSelect } from '@/components/common/BranchSelect'
import { Plus, Zap, Trash2, X, Pencil, Eye, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  disposed: 'bg-red-100 text-red-600',
  under_maintenance: 'bg-yellow-100 text-yellow-700',
}

const DEP_METHOD_OPTIONS = [
  { value: 'straight_line', label: 'Straight Line' },
  { value: 'wdv', label: 'Written Down Value' },
  { value: 'units_of_production', label: 'Units of Production' },
]

const DISPOSAL_METHOD_OPTIONS = [
  { value: 'sold', label: 'Sold' },
  { value: 'scrapped', label: 'Scrapped' },
  { value: 'donated', label: 'Donated' },
]

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function shortStoreLabel(full: string) {
  const sep = full.indexOf(' — ')
  return sep > 0 ? full.slice(0, sep) : full
}

function TruncCell({ value, className = '' }: { value: string; className?: string }) {
  if (!value || value === '—') return <span className="text-gray-400">—</span>
  return (
    <span className={`block truncate ${className}`} title={value}>
      {value}
    </span>
  )
}

function DialogChromeHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}

// ── Category create/edit modal, with GL account mapping ─────────────────────
function CategoryFormModal({ category, onClose }: { category?: any; onClose: () => void }) {
  const isEdit = !!category
  const { data: accounts = [] } = useAccounts()
  const assetAccounts = useMemo(() => (accounts as any[]).filter(a => a.account_type === 'Asset'), [accounts])
  const expenseAccounts = useMemo(() => (accounts as any[]).filter(a => a.account_type === 'Expense'), [accounts])
  const createMut = useCreateAssetCategory()
  const updateMut = useUpdateAssetCategory()
  const [form, setForm] = useState({
    name: category?.name || '',
    depreciation_method: category?.depreciation_method || 'straight_line',
    useful_life_years: category?.useful_life_years != null ? String(category.useful_life_years) : '5',
    salvage_pct: category?.salvage_pct != null ? String(category.salvage_pct) : '0',
    asset_account_id: category?.asset_account_id || '',
    accum_dep_account_id: category?.accum_dep_account_id || '',
    dep_expense_account_id: category?.dep_expense_account_id || '',
  })
  useEscapeToClose(onClose, true)

  const pending = createMut.isPending || updateMut.isPending

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error('Category name is required')
      return
    }
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      depreciation_method: form.depreciation_method,
      useful_life_years: Number(form.useful_life_years) || 5,
      salvage_pct: Number(form.salvage_pct) || 0,
      asset_account_id: form.asset_account_id || undefined,
      accum_dep_account_id: form.accum_dep_account_id || undefined,
      dep_expense_account_id: form.dep_expense_account_id || undefined,
    }
    if (isEdit) {
      updateMut.mutate({ id: category.id, data: payload }, {
        onSuccess: () => { toast.success('Category updated'); onClose() },
        onError: (err: unknown) => toast.error(extractApiError(err, 'Could not update category')),
      })
    } else {
      createMut.mutate(payload, {
        onSuccess: () => { toast.success('Category created'); onClose() },
        onError: (err: unknown) => toast.error(extractApiError(err, 'Could not create category')),
      })
    }
  }

  const accountOptions = (list: any[]) => [
    { value: '', label: '— Use default —' },
    ...list.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` })),
  ]

  return (
    <div data-kiterp-modal className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <DialogChromeHeader title={isEdit ? 'Edit Category' : 'Add Asset Category'} onClose={onClose} />

        <div>
          <Label className="block text-xs font-medium text-gray-600 mb-1">Category Name</Label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Plant & Machinery"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Depreciation Method</Label>
            <Select value={form.depreciation_method} onChange={v => setForm(f => ({ ...f, depreciation_method: v }))} options={DEP_METHOD_OPTIONS} />
          </div>
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Useful Life (years)</Label>
            <input
              type="number" min={1}
              value={form.useful_life_years}
              onChange={e => setForm(f => ({ ...f, useful_life_years: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <Label className="block text-xs font-medium text-gray-600 mb-1">Salvage / Residual %</Label>
          <input
            type="number" min={0} max={100}
            value={form.salvage_pct}
            onChange={e => setForm(f => ({ ...f, salvage_pct: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="pt-3 border-t border-gray-200">
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">GL Account Mapping</p>
          <p className="text-xs text-gray-400 mb-3">Leave blank to fall back to the default Fixed Asset / Accumulated Depreciation / Depreciation Expense accounts.</p>
          <div className="space-y-3">
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">Fixed Asset Account</Label>
              <Select value={form.asset_account_id} onChange={v => setForm(f => ({ ...f, asset_account_id: v }))} options={accountOptions(assetAccounts)} />
            </div>
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">Accumulated Depreciation Account</Label>
              <Select value={form.accum_dep_account_id} onChange={v => setForm(f => ({ ...f, accum_dep_account_id: v }))} options={accountOptions(assetAccounts)} />
            </div>
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">Depreciation Expense Account</Label>
              <Select value={form.dep_expense_account_id} onChange={v => setForm(f => ({ ...f, dep_expense_account_id: v }))} options={accountOptions(expenseAccounts)} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-cancel px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Category'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Register / Edit asset modal ──────────────────────────────────────────────
function AssetFormModal({ asset, categories, storeNameById, onClose }: {
  asset?: any; categories: any[]; storeNameById: Map<string, string>; onClose: () => void
}) {
  const isEdit = !!asset
  const createMut = useCreateAsset()
  const updateMut = useUpdateAsset()
  const [form, setForm] = useState({
    asset_code: asset?.asset_code || '',
    name: asset?.name || '',
    category_id: asset?.category_id || '',
    acquisition_date: asset?.acquisition_date || new Date().toISOString().slice(0, 10),
    purchase_cost: asset?.purchase_cost != null ? String(asset.purchase_cost) : '',
    salvage_value: asset?.salvage_value != null ? String(asset.salvage_value) : '',
    useful_life_years: asset?.useful_life_years != null ? String(asset.useful_life_years) : '5',
    depreciation_method: asset?.depreciation_method || 'straight_line',
    total_units_capacity: asset?.total_units_capacity != null ? String(asset.total_units_capacity) : '',
    location: asset?.location || '',
    serial_number: asset?.serial_number || '',
    notes: asset?.notes || '',
  })
  const [buId, setBuId] = useState('')
  const [branchId, setBranchId] = useState('')

  const pending = createMut.isPending || updateMut.isPending

  const applyCategoryDefaults = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId)
    setForm(f => {
      const cost = Number(f.purchase_cost) || 0
      const salvagePct = cat?.salvage_pct != null ? Number(cat.salvage_pct) : 0
      return {
        ...f,
        category_id: categoryId,
        depreciation_method: cat?.depreciation_method || f.depreciation_method,
        useful_life_years: cat?.useful_life_years != null ? String(cat.useful_life_years) : f.useful_life_years,
        salvage_value: cat && cost > 0 ? String(Math.round(cost * salvagePct) / 100) : f.salvage_value,
      }
    })
  }

  const handleSave = () => {
    if (!form.asset_code.trim() || !form.name.trim()) {
      toast.error('Asset code and name are required')
      return
    }
    if (!form.purchase_cost || Number(form.purchase_cost) <= 0) {
      toast.error('Enter a valid purchase cost')
      return
    }
    if (form.depreciation_method === 'units_of_production' && (!form.total_units_capacity || Number(form.total_units_capacity) <= 0)) {
      toast.error('Enter the total lifetime production capacity (e.g. total units/hours)')
      return
    }
    const payload: Record<string, unknown> = {
      asset_code: form.asset_code.trim(),
      name: form.name.trim(),
      category_id: form.category_id || undefined,
      acquisition_date: form.acquisition_date,
      purchase_cost: Number(form.purchase_cost),
      salvage_value: Number(form.salvage_value) || 0,
      useful_life_years: Number(form.useful_life_years) || 5,
      depreciation_method: form.depreciation_method,
      total_units_capacity: form.depreciation_method === 'units_of_production'
        ? Number(form.total_units_capacity) : undefined,
      location: form.location.trim() || undefined,
      serial_number: form.serial_number.trim() || undefined,
      notes: form.notes.trim() || undefined,
    }
    // Only send store_id when the user actively picked a BU/Branch — leaving both
    // blank on edit preserves the asset's current assignment.
    if (branchId || buId) payload.store_id = branchId || buId

    if (isEdit) {
      updateMut.mutate({ id: asset.id, data: payload }, {
        onSuccess: () => { toast.success('Asset updated'); onClose() },
        onError: (err: unknown) => toast.error(extractApiError(err, 'Could not update asset')),
      })
    } else {
      createMut.mutate(payload, {
        onSuccess: () => { toast.success('Asset registered'); onClose() },
        onError: (err: unknown) => toast.error(extractApiError(err, 'Could not register asset')),
      })
    }
  }

  const fieldClass = 'h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm'
  const labelClass = 'mb-0.5 block text-[11px] font-medium text-muted-foreground'

  return (
    <ModalOverlay onClose={onClose} className="z-[100] bg-black/60 p-3">
      <ModalPanel className="max-w-2xl max-h-[calc(100dvh-1.5rem)] !rounded-lg overflow-hidden">
        <ModalHeader
          title={isEdit ? 'Edit Asset' : 'Register New Asset'}
          onClose={onClose}
          className="border-0 px-4 py-2.5 [&>div>h2]:text-base [&>div>h2]:leading-none"
        />
        <ModalBody className="space-y-2 overflow-y-auto px-4 pb-1 pt-0">
        {isEdit && (
          <p className="text-[11px] text-muted-foreground">
            Currently: {asset.store_id ? (storeNameById.get(asset.store_id) || 'Unknown') : 'Unassigned'} — leave BU/Branch blank to keep unchanged.
          </p>
        )}

        <div className="grid grid-cols-2 gap-x-2 gap-y-2">
          <div>
            <Label className={labelClass}>Business Unit</Label>
            <BusinessUnitSelect
              value={buId}
              onChange={id => { setBuId(id); setBranchId('') }}
              allowAll={isEdit}
              autoSelectDefault={false}
              className="h-8"
            />
          </div>
          <div>
            <Label className={labelClass}>Branch</Label>
            <BranchSelect
              businessUnitId={buId || null}
              value={branchId}
              onChange={setBranchId}
              allowAll
              className="h-8"
            />
          </div>
          <div>
            <Label className={labelClass}>Category</Label>
            <Select
              value={form.category_id}
              onChange={applyCategoryDefaults}
              className="h-8"
              options={[{ value: '', label: '— No category —' }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
            />
          </div>
          <div>
            <Label className={labelClass}>Depreciation Method</Label>
            <Select value={form.depreciation_method} onChange={v => setForm(f => ({ ...f, depreciation_method: v }))} className="h-8" options={DEP_METHOD_OPTIONS} />
          </div>
          {form.depreciation_method === 'units_of_production' && (
            <div>
              <Label className={labelClass} title="Total lifetime output (e.g. total units, machine hours, km) this asset is expected to produce.">
                Total Lifetime Capacity
              </Label>
              <input
                type="number"
                value={form.total_units_capacity}
                title="Total lifetime output (e.g. total units, machine hours, km) this asset is expected to produce."
                onChange={e => setForm(f => ({ ...f, total_units_capacity: e.target.value }))}
                className={fieldClass}
              />
            </div>
          )}
          <div>
            <Label className={labelClass}>Asset Code</Label>
            <input
              value={form.asset_code}
              disabled={isEdit}
              onChange={e => setForm(f => ({ ...f, asset_code: e.target.value }))}
              className={`${fieldClass} disabled:bg-gray-100 disabled:text-gray-500`}
            />
          </div>
          <div>
            <Label className={labelClass}>Name</Label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={fieldClass}
            />
          </div>
          <div>
            <Label className={labelClass}>Acquisition Date</Label>
            <input
              type="date"
              value={form.acquisition_date}
              disabled={isEdit}
              title={isEdit ? 'Cannot be changed after registration' : undefined}
              onChange={e => setForm(f => ({ ...f, acquisition_date: e.target.value }))}
              className={`${fieldClass} disabled:bg-gray-100 disabled:text-gray-500`}
            />
          </div>
          <div>
            <Label className={labelClass}>Purchase Cost</Label>
            <input
              type="number"
              value={form.purchase_cost}
              disabled={isEdit}
              title={isEdit ? 'Cannot be changed after registration — use Maintenance (capitalize) to add cost' : undefined}
              onChange={e => setForm(f => ({ ...f, purchase_cost: e.target.value }))}
              className={`${fieldClass} disabled:bg-gray-100 disabled:text-gray-500`}
            />
          </div>
          <div>
            <Label className={labelClass} title="Expected amount recoverable when fully depreciated or disposed.">Salvage / Residual Value</Label>
            <input
              type="number"
              value={form.salvage_value}
              title="Expected amount recoverable when fully depreciated or disposed."
              onChange={e => setForm(f => ({ ...f, salvage_value: e.target.value }))}
              className={fieldClass}
            />
          </div>
          <div>
            <Label className={labelClass}>Useful Life (years)</Label>
            <input
              type="number"
              value={form.useful_life_years}
              onChange={e => setForm(f => ({ ...f, useful_life_years: e.target.value }))}
              className={fieldClass}
            />
          </div>
          <div>
            <Label className={labelClass}>Location</Label>
            <input
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              className={fieldClass}
            />
          </div>
          <div>
            <Label className={labelClass}>Serial Number</Label>
            <input
              value={form.serial_number}
              onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
              className={fieldClass}
            />
          </div>
          <div className="col-span-2">
            <Label className={labelClass}>Notes</Label>
            <input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional"
              className={fieldClass}
            />
          </div>
        </div>
        </ModalBody>
        <ModalFooter className="border-0 px-4 py-2.5">
          <button type="button" onClick={onClose} className="btn-cancel h-8 rounded-md border border-border px-3 text-sm">Cancel</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? 'Saving…' : isEdit ? 'Save Changes' : 'Register Asset'}
          </button>
        </ModalFooter>
      </ModalPanel>
    </ModalOverlay>
  )
}

// ── Units-of-production depreciation prompt — collects period output ────────
function DepreciationUnitsModal({ asset, onClose }: { asset: any; onClose: () => void }) {
  const depMut = useRunDepreciation()
  const [units, setUnits] = useState('')
  useEscapeToClose(onClose, true)

  const capacity = Number(asset.total_units_capacity || 0)
  const consumed = Number(asset.units_consumed || 0)
  const remaining = Math.max(capacity - consumed, 0)

  const handleConfirm = () => {
    const val = Number(units)
    if (!val || val <= 0) {
      toast.error('Enter the units produced/consumed this period')
      return
    }
    depMut.mutate({ id: asset.id, units: val }, {
      onSuccess: (res: any) => { toast.success(`Depreciation posted: ${fmt(res?.amount || 0)}`); onClose() },
      onError: (err: unknown) => toast.error(extractApiError(err, 'Could not run depreciation')),
    })
  }

  return (
    <div data-kiterp-modal className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-sm p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <DialogChromeHeader title="Run Depreciation (Units of Production)" onClose={onClose} />
        <p className="text-xs text-gray-500 -mt-2">
          Lifetime capacity {capacity.toLocaleString('en-IN')} · consumed to date {consumed.toLocaleString('en-IN')} · remaining {remaining.toLocaleString('en-IN')}
        </p>
        <div>
          <Label className="block text-xs font-medium text-gray-600 mb-0.5">Units produced/consumed this period</Label>
          <input
            type="number"
            value={units}
            onChange={e => setUnits(e.target.value)}
            className="w-full h-9 border border-gray-300 rounded-lg px-2.5 text-sm"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-cancel px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={depMut.isPending}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {depMut.isPending ? 'Posting…' : 'Post Depreciation'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Disposal modal — replaces the old one-click "scrapped @ ₹0" action ──────
function DisposeModal({ asset, onClose }: { asset: any; onClose: () => void }) {
  const disposeMut = useDisposeAsset()
  const [form, setForm] = useState({
    disposal_date: new Date().toISOString().slice(0, 10),
    disposal_method: 'scrapped',
    sale_price: '0',
    notes: '',
  })
  useEscapeToClose(onClose, true)

  const bookValue = Number(asset.current_value || 0)
  const salePrice = Number(form.sale_price) || 0
  const gainLoss = salePrice - bookValue

  const handleConfirm = () => {
    disposeMut.mutate({
      id: asset.id,
      data: {
        disposal_date: form.disposal_date,
        disposal_method: form.disposal_method,
        sale_price: salePrice,
        notes: form.notes.trim() || undefined,
      },
    }, {
      onSuccess: () => { toast.success('Asset disposed'); onClose() },
      onError: (err: unknown) => toast.error(extractApiError(err, 'Could not dispose asset')),
    })
  }

  return (
    <div data-kiterp-modal className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <DialogChromeHeader title="Dispose Asset" onClose={onClose} />
        <p className="text-sm text-gray-600 -mt-2">{asset.name} <span className="text-gray-400">({asset.asset_code})</span></p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Disposal Date</Label>
            <input
              type="date"
              value={form.disposal_date}
              onChange={e => setForm(f => ({ ...f, disposal_date: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Method</Label>
            <Select value={form.disposal_method} onChange={v => setForm(f => ({ ...f, disposal_method: v }))} options={DISPOSAL_METHOD_OPTIONS} />
          </div>
        </div>

        <div>
          <Label className="block text-xs font-medium text-gray-600 mb-1">Sale / Recovery Price</Label>
          <input
            type="number" min={0}
            value={form.sale_price}
            onChange={e => setForm(f => ({ ...f, sale_price: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <Label className="block text-xs font-medium text-gray-600 mb-1">Notes</Label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-gray-500">Book Value (NBV)</span><span className="font-mono">{fmt(bookValue)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Sale / Recovery Price</span><span className="font-mono">{fmt(salePrice)}</span></div>
          <div className={`flex justify-between font-semibold ${gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            <span>{gainLoss >= 0 ? 'Gain' : 'Loss'} on Disposal</span>
            <span className="font-mono">{fmt(Math.abs(gainLoss))}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-cancel px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={disposeMut.isPending}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {disposeMut.isPending ? 'Processing…' : 'Confirm Disposal'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Maintenance list + quick-add, shown inside the asset detail drawer ──────
function MaintenanceTab({ asset }: { asset: any }) {
  const { data: records = [], isLoading } = useAssetMaintenance(asset.id)
  const createMut = useCreateMaintenance()
  const [showAdd, setShowAdd] = useState(false)
  const blankForm = {
    maintenance_date: new Date().toISOString().slice(0, 10),
    description: '', cost: '', vendor_name: '', status: 'completed', capitalize: false,
  }
  const [form, setForm] = useState(blankForm)

  const handleAdd = () => {
    if (!form.maintenance_date) {
      toast.error('Maintenance date is required')
      return
    }
    createMut.mutate({
      asset_id: asset.id,
      maintenance_date: form.maintenance_date,
      description: form.description.trim() || undefined,
      cost: Number(form.cost) || 0,
      vendor_name: form.vendor_name.trim() || undefined,
      status: form.status,
      capitalize: form.capitalize,
    }, {
      onSuccess: () => {
        toast.success('Maintenance recorded')
        setShowAdd(false)
        setForm(blankForm)
      },
      onError: (err: unknown) => toast.error(extractApiError(err, 'Could not add maintenance record')),
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(s => !s)}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> {showAdd ? 'Cancel' : 'Add Record'}
        </button>
      </div>

      {showAdd && (
        <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">Date</Label>
              <input
                type="date" value={form.maintenance_date}
                onChange={e => setForm(f => ({ ...f, maintenance_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
              />
            </div>
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">Cost</Label>
              <input
                type="number" min={0} value={form.cost}
                onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
              />
            </div>
          </div>
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Description</Label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">Vendor</Label>
              <input
                value={form.vendor_name}
                onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
              />
            </div>
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">Status</Label>
              <Select
                value={form.status}
                onChange={v => setForm(f => ({ ...f, status: v }))}
                options={[
                  { value: 'scheduled', label: 'Scheduled' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600 pt-1">
            <input
              type="checkbox"
              checked={form.capitalize}
              onChange={e => setForm(f => ({ ...f, capitalize: e.target.checked }))}
            />
            Capitalize this cost into the asset's book value (instead of posting as an expense)
          </label>
          <div className="flex justify-end pt-1">
            <button
              onClick={handleAdd}
              disabled={createMut.isPending}
              className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {createMut.isPending ? 'Saving…' : 'Save Record'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (records as any[]).length === 0 ? (
        <p className="text-sm text-gray-500">No maintenance records yet.</p>
      ) : (
        <div className="space-y-2">
          {(records as any[]).map(r => (
            <div key={r.id} className="border border-gray-200 rounded-lg p-2.5 text-sm flex justify-between items-start">
              <div>
                <p className="font-medium text-gray-800">{r.description || 'Maintenance'}</p>
                <p className="text-xs text-gray-500">{r.maintenance_date} · {r.vendor_name || '—'} · <span className="capitalize">{r.status}</span></p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono">{fmt(r.cost || 0)}</p>
                {r.journal_entry_id && <p className="text-[10px] text-green-600 font-medium">Posted to GL</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Asset detail drawer — overview / depreciation history / maintenance ─────
function AssetDetailDrawer({ assetId, storeNameById, onClose, onEdit, onDispose }: {
  assetId: string; storeNameById: Map<string, string>
  onClose: () => void; onEdit: (asset: any) => void; onDispose: (asset: any) => void
}) {
  const { data: asset, isLoading } = useAsset(assetId)
  const depMut = useRunDepreciation()
  const [tab, setTab] = useState<'overview' | 'depreciation' | 'maintenance'>('overview')
  const [showUnitsPrompt, setShowUnitsPrompt] = useState(false)
  useEscapeToClose(onClose, true)

  return (
    <div data-kiterp-modal className="fixed inset-0 z-[100] flex justify-end bg-black/40" onClick={onClose}>
      <div className="bg-card text-foreground h-full w-full max-w-xl shadow-2xl overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
        {isLoading || !asset ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Loading…</p>
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"><X className="w-5 h-5" /></button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-lg">{(asset as any).name}</h2>
                <p className="text-xs text-gray-500 font-mono">{(asset as any).asset_code}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted shrink-0" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-500">Purchase Cost</p>
                <p className="font-mono font-semibold">{fmt((asset as any).purchase_cost || 0)}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-500">Current Value (NBV)</p>
                <p className="font-mono font-semibold text-blue-700">{fmt((asset as any).current_value || 0)}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-500">Accumulated Depreciation</p>
                <p className="font-mono font-semibold text-red-500">{fmt((asset as any).accumulated_depreciation || 0)}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-500">Status</p>
                <span className={`inline-block mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[(asset as any).status] || 'bg-gray-100 text-gray-600'}`}>
                  {(asset as any).status}
                </span>
              </div>
            </div>

            <div className="text-sm grid grid-cols-2 gap-y-1.5">
              <span className="text-gray-500">Category</span>
              <span>{(asset as any).category?.name || '—'}</span>
              <span className="text-gray-500">Business Unit</span>
              <span>{(asset as any).store_id ? (storeNameById.get((asset as any).store_id) || '—') : '—'}</span>
              <span className="text-gray-500">Acquisition Date</span>
              <span>{(asset as any).acquisition_date}</span>
              <span className="text-gray-500">Location</span>
              <span>{(asset as any).location || '—'}</span>
              <span className="text-gray-500">Serial Number</span>
              <span>{(asset as any).serial_number || '—'}</span>
              <span className="text-gray-500">Depreciation Method</span>
              <span className="capitalize">{(asset as any).depreciation_method?.replace(/_/g, ' ')}</span>
              {(asset as any).depreciation_method === 'units_of_production' && (
                <>
                  <span className="text-gray-500">Production Capacity</span>
                  <span>{Number((asset as any).total_units_capacity || 0).toLocaleString('en-IN')} (consumed {Number((asset as any).units_consumed || 0).toLocaleString('en-IN')})</span>
                </>
              )}
              {(asset as any).status === 'disposed' && (
                <>
                  <span className="text-gray-500">Disposal Date</span>
                  <span>{(asset as any).disposal_date || '—'}</span>
                  <span className="text-gray-500">Disposal Value</span>
                  <span>{fmt((asset as any).disposal_value || 0)}</span>
                </>
              )}
              {(asset as any).notes && (
                <>
                  <span className="text-gray-500">Notes</span>
                  <span>{(asset as any).notes}</span>
                </>
              )}
            </div>

            <div className="flex gap-2 border-b border-gray-200">
              {([
                ['overview', 'Overview'],
                ['depreciation', `Depreciation (${((asset as any).depreciation_entries || []).length})`],
                ['maintenance', 'Maintenance'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${tab === key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'overview' && (
              <p className="text-sm text-gray-500">{(asset as any).description || 'No description provided.'}</p>
            )}

            {tab === 'depreciation' && (
              ((asset as any).depreciation_entries || []).length === 0 ? (
                <p className="text-sm text-gray-500">No depreciation entries yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {((asset as any).depreciation_entries || []).map((e: any) => (
                    <div key={e.id} className="flex justify-between text-sm border border-gray-200 rounded-lg px-3 py-2">
                      <span className="text-gray-600">
                        {e.depreciation_date}
                        {e.units_produced != null && <span className="text-xs text-gray-400"> · {Number(e.units_produced).toLocaleString('en-IN')} units</span>}
                      </span>
                      <span className="font-mono text-red-500">-{fmt(e.amount || 0)}</span>
                      <span className="font-mono text-gray-500">NBV {fmt(e.book_value_after || 0)}</span>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === 'maintenance' && <MaintenanceTab asset={asset} />}

            <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200">
              <button
                onClick={() => onEdit(asset)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              {(asset as any).status === 'active' && (
                <>
                  <button
                    onClick={() => {
                      if ((asset as any).depreciation_method === 'units_of_production') setShowUnitsPrompt(true)
                      else depMut.mutate((asset as any).id, {
                        onSuccess: (res: any) => toast.success(`Depreciation posted: ${fmt(res?.amount || 0)}`),
                        onError: (err: unknown) => toast.error(extractApiError(err, 'Could not run depreciation')),
                      })
                    }}
                    disabled={depMut.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-50 disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5" /> Run Depreciation
                  </button>
                  <button
                    onClick={() => onDispose(asset)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Dispose
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
      {showUnitsPrompt && asset && <DepreciationUnitsModal asset={asset} onClose={() => setShowUnitsPrompt(false)} />}
    </div>
  )
}

export default function FixedAssets() {
  const [tab, setTab] = useState<'assets' | 'categories'>('assets')
  const [showNew, setShowNew] = useState(false)
  const [editingAsset, setEditingAsset] = useState<any>(null)
  const [detailAssetId, setDetailAssetId] = useState<string | null>(null)
  const [disposingAsset, setDisposingAsset] = useState<any>(null)
  const [unitsPromptAsset, setUnitsPromptAsset] = useState<any>(null)
  const [showCatModal, setShowCatModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any>(null)

  // Business Unit / Branch filter for the asset list.
  const [storeFilter, setStoreFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const effectiveStoreFilter = branchFilter || storeFilter

  const { data: assets = [], isLoading } = useAssets({ store_id: effectiveStoreFilter || undefined })
  const { data: categories = [] } = useAssetCategories()
  const { data: allStoresData } = useStores({ include_branches: true })
  const storeNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of allStoresData?.stores ?? []) m.set(s.id, s.code ? `${s.code} — ${s.name}` : s.name)
    return m
  }, [allStoresData])
  const depMut = useRunDepreciation()

  const openNew = () => { setEditingAsset(null); setShowNew(true) }
  const openEdit = (asset: any) => { setEditingAsset(asset); setDetailAssetId(null); setShowNew(true) }

  return (
    <div className="mx-auto max-w-7xl space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          Register assets, categories, depreciation, and maintenance
        </p>
        {tab === 'assets' ? (
          <button
            type="button"
            onClick={openNew}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> Add Asset
          </button>
        ) : tab === 'categories' ? (
          <button
            type="button"
            onClick={() => { setEditingCategory(null); setShowCatModal(true) }}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> Add Category
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {([['assets', 'Assets'], ['categories', 'Categories']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg text-sm border ${tab === key ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'assets' && (
          <div className="flex gap-2">
            <div className="w-48">
              <BusinessUnitSelect
                value={storeFilter}
                onChange={id => { setStoreFilter(id); setBranchFilter('') }}
                allowAll
                autoSelectDefault={false}
              />
            </div>
            <div className="w-48">
              <BranchSelect
                businessUnitId={storeFilter || null}
                value={branchFilter}
                onChange={setBranchFilter}
                allowAll
              />
            </div>
          </div>
        )}
      </div>

      {tab === 'assets' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full table-fixed text-xs">
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-[14%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead className="bg-gray-50 border-b">
              <tr>
                {[
                  ['Code', 'Asset code'],
                  ['Name', 'Asset name'],
                  ['Category', 'Category'],
                  ['BU', 'Business unit'],
                  ['Acquired', 'Acquisition date'],
                  ['Cost', 'Purchase cost'],
                  ['Curr. value', 'Current book value'],
                  ['Acc. dep.', 'Accumulated depreciation'],
                  ['Status', 'Status'],
                  ['Actions', 'Actions'],
                ].map(([label, title]) => (
                  <th key={label} title={title} className="px-2 py-2.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={10} className="px-2 py-8 text-center text-gray-500">Loading…</td></tr>
              ) : (assets as any[]).length === 0 ? (
                <tr><td colSpan={10} className="px-2 py-8 text-center text-gray-500">No assets registered yet.</td></tr>
              ) : (assets as any[]).map((a: any) => {
                const storeFull = a.store_id ? (storeNameById.get(a.store_id) || '—') : '—'
                const storeShort = storeFull !== '—' ? shortStoreLabel(storeFull) : '—'
                return (
                <tr
                  key={a.id}
                  onClick={() => setDetailAssetId(a.id)}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${detailAssetId === a.id ? 'bg-blue-50/60' : ''}`}
                >
                  <td className="px-2 py-2 min-w-0">
                    <TruncCell value={a.asset_code} className="font-mono text-gray-500" />
                  </td>
                  <td className="px-2 py-2 min-w-0">
                    <TruncCell value={a.name} className="font-medium text-gray-800" />
                  </td>
                  <td className="px-2 py-2 min-w-0">
                    <TruncCell value={a.category?.name || '—'} className="text-gray-600" />
                  </td>
                  <td className="px-2 py-2 min-w-0">
                    {storeFull === '—' ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <span className="block truncate text-gray-600" title={storeFull}>
                        {storeShort}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-gray-600 whitespace-nowrap">{a.acquisition_date}</td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums whitespace-nowrap">{fmt(a.purchase_cost || 0)}</td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums text-blue-700 whitespace-nowrap">{fmt(a.current_value || 0)}</td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums text-red-500 whitespace-nowrap">{fmt(a.accumulated_depreciation || 0)}</td>
                  <td className="px-2 py-2">
                    <span className={`inline-block max-w-full truncate text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`} title={a.status}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-1 py-2" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5">
                      <button onClick={() => setDetailAssetId(a.id)} title="View Details"
                        className="p-0.5 text-gray-500 hover:text-gray-800 shrink-0">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openEdit(a)} title="Edit"
                        className="p-0.5 text-gray-500 hover:text-gray-800 shrink-0">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {a.status === 'active' && (
                        <>
                          <button
                            onClick={() => {
                              if (a.depreciation_method === 'units_of_production') setUnitsPromptAsset(a)
                              else depMut.mutate(a.id, {
                                onSuccess: (res: any) => toast.success(`Depreciation posted: ${fmt(res?.amount || 0)}`),
                                onError: (err: unknown) => toast.error(extractApiError(err, 'Could not run depreciation')),
                              })
                            }}
                            title="Run Depreciation"
                            disabled={depMut.isPending}
                            className="p-0.5 text-yellow-600 hover:text-yellow-800 disabled:opacity-50 shrink-0">
                            <Zap className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDisposingAsset(a)}
                            title="Dispose" className="p-0.5 text-red-500 hover:text-red-700 shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(categories as any[]).map((c: any) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 relative group">
              <button
                onClick={() => { setEditingCategory(c); setShowCatModal(true) }}
                title="Edit category"
                className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <p className="font-semibold text-gray-800 pr-6">{c.name}</p>
              <p className="text-xs text-gray-500 mt-1 capitalize">{c.depreciation_method?.replace('_', ' ')} · {c.useful_life_years} years</p>
              <p className="text-xs text-gray-400">Salvage / Residual: {c.salvage_pct}%</p>
              {(c.asset_account_id || c.accum_dep_account_id || c.dep_expense_account_id) && (
                <p className="text-[10px] text-green-600 font-medium mt-2 flex items-center gap-1">
                  <Wrench className="w-3 h-3" /> GL accounts mapped
                </p>
              )}
            </div>
          ))}
          {(categories as any[]).length === 0 && (
            <div className="col-span-3 text-center py-8 text-gray-500 text-sm bg-white rounded-xl border border-gray-200">No categories yet.</div>
          )}
        </div>
      )}

      {showNew && (
        <AssetFormModal
          asset={editingAsset}
          categories={categories as any[]}
          storeNameById={storeNameById}
          onClose={() => { setShowNew(false); setEditingAsset(null) }}
        />
      )}

      {showCatModal && (
        <CategoryFormModal
          category={editingCategory}
          onClose={() => { setShowCatModal(false); setEditingCategory(null) }}
        />
      )}

      {detailAssetId && (
        <AssetDetailDrawer
          assetId={detailAssetId}
          storeNameById={storeNameById}
          onClose={() => setDetailAssetId(null)}
          onEdit={openEdit}
          onDispose={(a) => setDisposingAsset(a)}
        />
      )}

      {disposingAsset && (
        <DisposeModal asset={disposingAsset} onClose={() => setDisposingAsset(null)} />
      )}

      {unitsPromptAsset && (
        <DepreciationUnitsModal asset={unitsPromptAsset} onClose={() => setUnitsPromptAsset(null)} />
      )}
    </div>
  )
}
