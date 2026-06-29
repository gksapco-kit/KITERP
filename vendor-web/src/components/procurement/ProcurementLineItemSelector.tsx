import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { useProducts, useServices } from '@/hooks/useVendor'
import { useAssetCategories } from '@/hooks/useFinance'
import type { RequisitionType } from '@/components/procurement/procurementLineItemTypes'

export type { RequisitionType } from '@/components/procurement/procurementLineItemTypes'

interface Props {
  type: RequisitionType
  referenceId: string
  description: string
  onReferenceChange: (id: string) => void
  onDescriptionChange: (value: string) => void
  className?: string
}

export function ProcurementLineItemSelector({
  type,
  referenceId,
  description,
  onReferenceChange,
  onDescriptionChange,
  className,
}: Props) {
  const { data: productsData, isLoading: productsLoading } = useProducts({ size: 500, status: 'active' })
  const { data: servicesData, isLoading: servicesLoading } = useServices({ size: 500, status: 'active' })
  const { data: categories = [], isLoading: categoriesLoading } = useAssetCategories()

  const products = productsData?.items ?? []
  const services = servicesData?.items ?? []

  if (type === 'product') {
    return (
      <div className={className}>
        <Label className="text-[11px] leading-tight text-gray-500">Product *</Label>
        <Select
          value={referenceId}
          onChange={onReferenceChange}
          options={selectOptionsWithBlank(
            'Select product…',
            products.map(p => ({ value: p.id, label: p.name })),
          )}
          placeholder={productsLoading ? 'Loading…' : 'Select product…'}
          disabled={productsLoading}
          className="mt-0.5 text-xs h-8 py-0 px-2.5"
          aria-label="Product"
        />
        {!productsLoading && products.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">No active products — add products under Inventory first.</p>
        )}
      </div>
    )
  }

  if (type === 'consumption') {
    return (
      <div className={className}>
        <Label className="text-[11px] leading-tight text-gray-500">Consumable / Material *</Label>
        <Select
          value={referenceId}
          onChange={onReferenceChange}
          options={selectOptionsWithBlank(
            'Select consumable…',
            products.map(p => ({ value: p.id, label: p.name })),
          )}
          placeholder={productsLoading ? 'Loading…' : 'Select consumable…'}
          disabled={productsLoading}
          className="mt-0.5 text-xs h-8 py-0 px-2.5"
          aria-label="Consumable"
        />
        {!productsLoading && products.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">No active products — add consumables under Inventory first.</p>
        )}
      </div>
    )
  }

  if (type === 'service') {
    return (
      <div className={className}>
        <Label className="text-[11px] leading-tight text-gray-500">Service *</Label>
        <Select
          value={referenceId}
          onChange={onReferenceChange}
          options={selectOptionsWithBlank(
            'Select service…',
            services.map(s => ({ value: s.id, label: s.name })),
          )}
          placeholder={servicesLoading ? 'Loading…' : 'Select service…'}
          disabled={servicesLoading}
          className="mt-0.5 text-xs h-8 py-0 px-2.5"
          aria-label="Service"
        />
        {!servicesLoading && services.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">No active services — add services under Services first.</p>
        )}
      </div>
    )
  }

  if (type === 'asset') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-1.5 ${className ?? ''}`}>
        <div>
          <Label className="text-[11px] leading-tight text-gray-500">Asset Category</Label>
          <Select
            value={referenceId}
            onChange={onReferenceChange}
            options={selectOptionsWithBlank(
              'Select category (optional)…',
              (categories as { id: string; name: string }[]).map(c => ({ value: c.id, label: c.name })),
            )}
            placeholder={categoriesLoading ? 'Loading…' : 'Select category (optional)…'}
            disabled={categoriesLoading}
            className="mt-0.5 text-xs h-8 py-0 px-2.5"
            aria-label="Asset category"
          />
        </div>
        <div>
          <Label className="text-[11px] leading-tight text-gray-500">Asset Description *</Label>
          <Input
            value={description}
            onChange={e => onDescriptionChange(e.target.value)}
            placeholder="e.g. Dell laptop for finance team"
            className="mt-0.5 text-xs h-8 py-0 px-2.5"
          />
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <Label className="text-[11px] leading-tight text-gray-500">Description *</Label>
      <Input
        value={description}
        onChange={e => onDescriptionChange(e.target.value)}
        placeholder="Describe what is needed…"
        className="mt-0.5 text-xs h-7 py-0 px-2"
      />
    </div>
  )
}
