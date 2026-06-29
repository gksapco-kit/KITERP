import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { ProcurementSupplierField } from '@/components/procurement/ProcurementSupplierField'

export type ProcurementSource = 'supplier' | 'internal'
export type BUScope = 'within_bu' | 'cross_bu'

export const PROCUREMENT_SOURCES: { value: ProcurementSource; label: string }[] = [
  { value: 'supplier', label: 'Supplier' },
  { value: 'internal', label: 'Internal' },
]

export const BU_SCOPES: { value: BUScope; label: string }[] = [
  { value: 'within_bu', label: 'Within BU' },
  { value: 'cross_bu', label: 'Cross BU (2 different BUs)' },
]

interface StoreOption {
  id: string
  name: string
  code?: string | null
}

interface Props {
  inline?: boolean
  storeId: string
  procurementSource: ProcurementSource
  buScope: BUScope
  fromStoreId: string
  toStoreId: string
  headerSupplierId: string
  stores: StoreOption[]
  storesLoading: boolean
  onStoreChange: (id: string) => void
  onSourceChange: (source: ProcurementSource) => void
  onScopeChange: (scope: BUScope) => void
  onFromStoreChange: (id: string) => void
  onToStoreChange: (id: string) => void
  onHeaderSupplierChange: (id: string) => void
}

function storeLabel(s: StoreOption) {
  return s.code ? `${s.name} (${s.code})` : s.name
}

const fieldClass = 'text-xs h-8 py-0 px-2.5'

export function ProcurementPRHeaderFields({
  inline = false,
  storeId,
  procurementSource,
  buScope,
  fromStoreId,
  toStoreId,
  headerSupplierId,
  stores,
  storesLoading,
  onStoreChange,
  onSourceChange,
  onScopeChange,
  onFromStoreChange,
  onToStoreChange,
  onHeaderSupplierChange,
}: Props) {
  const storeOptions = stores.map(s => ({ value: s.id, label: storeLabel(s) }))
  const otherStores = stores.filter(s => s.id !== fromStoreId)

  const buField = (
    <div className={inline ? 'col-span-12 sm:col-span-6 lg:col-span-2' : undefined}>
      <Label className="text-[11px] leading-tight text-gray-500">Business Unit *</Label>
      <Select
        value={storeId}
        onChange={onStoreChange}
        options={selectOptionsWithBlank(
          storesLoading ? 'Loading…' : 'Select BU…',
          storeOptions,
        )}
        placeholder={storesLoading ? 'Loading…' : 'Select BU…'}
        disabled={storesLoading}
        className={`mt-0.5 ${fieldClass}`}
        aria-label="Business unit"
      />
    </div>
  )

  const sourceField = (
    <div className={inline ? 'col-span-12 sm:col-span-6 lg:col-span-2' : undefined}>
      <Label className="text-[11px] leading-tight text-gray-500">Source *</Label>
      <Select
        value={procurementSource}
        onChange={v => onSourceChange(v as ProcurementSource)}
        options={PROCUREMENT_SOURCES}
        className={`mt-0.5 ${fieldClass}`}
        aria-label="Procurement source"
      />
    </div>
  )

  const thirdField = procurementSource === 'supplier' ? (
    <ProcurementSupplierField
      inline
      value={headerSupplierId}
      onChange={onHeaderSupplierChange}
      label="Supplier"
      returnTo="procurement/requisitions"
      className={inline ? 'col-span-12 sm:col-span-12 lg:col-span-4' : undefined}
    />
  ) : (
    <div className={inline ? 'col-span-12 sm:col-span-12 lg:col-span-4' : undefined}>
      <Label className="text-[11px] leading-tight text-gray-500">BU Movement *</Label>
      <Select
        value={buScope}
        onChange={v => onScopeChange(v as BUScope)}
        options={BU_SCOPES}
        className={`mt-0.5 ${fieldClass}`}
        aria-label="BU scope"
      />
    </div>
  )

  if (inline) {
    return (
      <>
        {buField}
        {sourceField}
        {thirdField}
        {procurementSource === 'internal' && buScope === 'cross_bu' && (
          <>
            <div className="col-span-12 sm:col-span-6 lg:col-span-2 lg:col-start-5">
              <Label className="text-[11px] leading-tight text-gray-500">From BU *</Label>
              <Select
                value={fromStoreId}
                onChange={onFromStoreChange}
                options={selectOptionsWithBlank('Select source BU…', storeOptions)}
                placeholder="Select source BU…"
                disabled={storesLoading}
                className={`mt-0.5 ${fieldClass}`}
                aria-label="From business unit"
              />
            </div>
            <div className="col-span-12 sm:col-span-6 lg:col-span-2">
              <Label className="text-[11px] leading-tight text-gray-500">To BU *</Label>
              <Select
                value={toStoreId}
                onChange={onToStoreChange}
                options={selectOptionsWithBlank(
                  'Select destination BU…',
                  otherStores.map(s => ({ value: s.id, label: storeLabel(s) })),
                )}
                placeholder="Select destination BU…"
                disabled={storesLoading || !fromStoreId}
                className={`mt-0.5 ${fieldClass}`}
                aria-label="To business unit"
              />
            </div>
          </>
        )}
      </>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {buField}
        {sourceField}
        {thirdField}
      </div>

      {procurementSource === 'internal' && buScope === 'cross_bu' && (
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <Label className="text-[11px] leading-tight">From BU *</Label>
            <Select
              value={fromStoreId}
              onChange={onFromStoreChange}
              options={selectOptionsWithBlank('Select source BU…', storeOptions)}
              placeholder="Select source BU…"
              disabled={storesLoading}
              className={`mt-0.5 ${fieldClass}`}
              aria-label="From business unit"
            />
          </div>
          <div>
            <Label className="text-[11px] leading-tight">To BU *</Label>
            <Select
              value={toStoreId}
              onChange={onToStoreChange}
              options={selectOptionsWithBlank(
                'Select destination BU…',
                otherStores.map(s => ({ value: s.id, label: storeLabel(s) })),
              )}
              placeholder="Select destination BU…"
              disabled={storesLoading || !fromStoreId}
              className={`mt-0.5 ${fieldClass}`}
              aria-label="To business unit"
            />
          </div>
        </div>
      )}

      {!storesLoading && stores.length === 0 && (
        <p className="text-[11px] text-amber-600">No business units — add them under Settings → Stores.</p>
      )}
    </div>
  )
}
