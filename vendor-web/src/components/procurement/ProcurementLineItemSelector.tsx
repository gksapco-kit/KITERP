import { Input } from '@/components/ui/input'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { useProducts, useServices } from '@/hooks/useVendor'
import { useAssetCategories } from '@/hooks/useFinance'
import type { RequisitionType } from '@/components/procurement/procurementLineItemTypes'

export type { RequisitionType } from '@/components/procurement/procurementLineItemTypes'

const lineSelectTrigger =
  'h-8 w-full min-w-0 text-xs border-gray-200 bg-white rounded-md shadow-none'
const lineInputCls =
  'h-8 w-full min-w-0 rounded-md border-gray-200 bg-white px-2 text-xs shadow-none focus:border-blue-400'

interface Props {
  type: RequisitionType
  referenceId: string
  description: string
  onReferenceChange: (id: string) => void
  onDescriptionChange: (value: string) => void
  className?: string
  /** When true, omit built-in labels (parent LineField owns the label). */
  hideLabel?: boolean
  triggerClassName?: string
}

export function itemSelectorLabel(type: RequisitionType): string {
  switch (type) {
    case 'product': return 'Product'
    case 'consumption': return 'Consumable / Material'
    case 'service': return 'Service'
    case 'asset': return 'Asset'
    default: return 'Description'
  }
}

export function ProcurementLineItemSelector({
  type,
  referenceId,
  description,
  onReferenceChange,
  onDescriptionChange,
  className,
  hideLabel = false,
  triggerClassName = lineSelectTrigger,
}: Props) {
  const { data: productsData, isLoading: productsLoading } = useProducts({ size: 500, status: 'active' })
  const { data: servicesData, isLoading: servicesLoading } = useServices({ size: 500, status: 'active' })
  const { data: categories = [], isLoading: categoriesLoading } = useAssetCategories()

  const products = productsData?.items ?? []
  const services = servicesData?.items ?? []

  if (type === 'product') {
    return (
      <div className={className}>
        {!hideLabel && (
          <p className="text-[10px] font-semibold uppercase tracking-wide leading-none text-gray-400 dark:text-gray-500 select-none">
            Product <span className="ml-0.5 text-red-500">*</span>
          </p>
        )}
        <Select
          value={referenceId}
          onChange={onReferenceChange}
          options={selectOptionsWithBlank(
            'Select product…',
            products.map(p => ({ value: p.id, label: p.name, hint: p.sku || undefined })),
          )}
          placeholder={productsLoading ? 'Loading…' : 'Select product…'}
          disabled={productsLoading}
          className={`w-full min-w-0 ${hideLabel ? '' : 'mt-1'}`}
          showSelectedHint={false}
          triggerClassName={triggerClassName}
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
        {!hideLabel && (
          <p className="text-[10px] font-semibold uppercase tracking-wide leading-none text-gray-400 dark:text-gray-500 select-none">
            Consumable / Material <span className="ml-0.5 text-red-500">*</span>
          </p>
        )}
        <Select
          value={referenceId}
          onChange={onReferenceChange}
          options={selectOptionsWithBlank(
            'Select consumable…',
            products.map(p => ({ value: p.id, label: p.name, hint: p.sku || undefined })),
          )}
          placeholder={productsLoading ? 'Loading…' : 'Select consumable…'}
          disabled={productsLoading}
          className={`w-full min-w-0 ${hideLabel ? '' : 'mt-1'}`}
          showSelectedHint={false}
          triggerClassName={triggerClassName}
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
        {!hideLabel && (
          <p className="text-[10px] font-semibold uppercase tracking-wide leading-none text-gray-400 dark:text-gray-500 select-none">
            Service <span className="ml-0.5 text-red-500">*</span>
          </p>
        )}
        <Select
          value={referenceId}
          onChange={onReferenceChange}
          options={selectOptionsWithBlank(
            'Select service…',
            services.map(s => ({ value: s.id, label: s.name })),
          )}
          placeholder={servicesLoading ? 'Loading…' : 'Select service…'}
          disabled={servicesLoading}
          className={`w-full min-w-0 ${hideLabel ? '' : 'mt-1'}`}
          showSelectedHint={false}
          triggerClassName={triggerClassName}
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
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1.5 ${className ?? ''}`}>
        <div className="min-w-0">
          {!hideLabel && (
            <p className="text-[10px] font-semibold uppercase tracking-wide leading-none text-gray-400 dark:text-gray-500 select-none">
              Asset Category
            </p>
          )}
          <Select
            value={referenceId}
            onChange={onReferenceChange}
            options={selectOptionsWithBlank(
              'Select category (optional)…',
              (categories as { id: string; name: string }[]).map(c => ({ value: c.id, label: c.name })),
            )}
            placeholder={categoriesLoading ? 'Loading…' : 'Select category (optional)…'}
            disabled={categoriesLoading}
            className={`w-full min-w-0 ${hideLabel ? '' : 'mt-1'}`}
            triggerClassName={triggerClassName}
            aria-label="Asset category"
          />
        </div>
        <div className="min-w-0">
          {!hideLabel && (
            <p className="text-[10px] font-semibold uppercase tracking-wide leading-none text-gray-400 dark:text-gray-500 select-none">
              Asset Description <span className="ml-0.5 text-red-500">*</span>
            </p>
          )}
          <Input
            value={description}
            onChange={e => onDescriptionChange(e.target.value)}
            placeholder="e.g. Dell laptop for finance team"
            className={`${lineInputCls} ${hideLabel ? '' : 'mt-1'}`}
            aria-label="Asset description"
          />
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {!hideLabel && (
        <p className="text-[10px] font-semibold uppercase tracking-wide leading-none text-gray-400 dark:text-gray-500 select-none">
          Description <span className="ml-0.5 text-red-500">*</span>
        </p>
      )}
      <Input
        value={description}
        onChange={e => onDescriptionChange(e.target.value)}
        placeholder="Describe what is needed…"
        className={`${lineInputCls} ${hideLabel ? '' : 'mt-1'}`}
        aria-label="Description"
      />
    </div>
  )
}
