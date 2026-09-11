import { Input } from '@/components/ui/input'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { useProducts, useServices } from '@/hooks/useVendor'
import { useAssetCategories } from '@/hooks/useFinance'
import type { RequisitionType } from '@/components/procurement/procurementLineItemTypes'
import type { Product, Service } from '@/types'

export type { RequisitionType } from '@/components/procurement/procurementLineItemTypes'

/** List-cache snapshot so the line can seed price / UoM / codes without waiting on detail fetches. */
export type CatalogPickSnapshot = {
  id: string
  name?: string
  uom?: string | null
  cost_price?: number | null
  price?: number | null
  purchase_price?: number | null
  purchase_price_fixed?: number | null
  hsn_code?: string | null
  sac_code?: string | null
  barcode?: string | null
  sku?: string | null
  material_code?: string | null
  gst_rate?: number | null
  tax_rate?: number | null
  is_taxable?: boolean
}

export function productToCatalogSnapshot(p: Product): CatalogPickSnapshot {
  return {
    id: p.id,
    name: p.name,
    uom: p.uom,
    cost_price: p.cost_price,
    price: p.price,
    hsn_code: p.hsn_code,
    barcode: p.barcode,
    sku: p.sku,
    material_code: p.material_code,
    gst_rate: p.gst_rate,
    tax_rate: p.tax_rate,
    is_taxable: p.is_taxable,
  }
}

export function serviceToCatalogSnapshot(s: Service): CatalogPickSnapshot {
  return {
    id: s.id,
    name: s.name,
    uom: s.uom,
    cost_price: (s as { cost_price?: number | null }).cost_price,
    price: s.price,
    purchase_price: s.purchase_price,
    purchase_price_fixed: s.purchase_price_fixed,
    sac_code: s.sac_code,
    material_code: s.material_code,
    gst_rate: s.gst_rate,
    tax_rate: s.tax_rate,
    is_taxable: s.is_taxable,
  }
}

const lineSelectTrigger =
  'h-8 w-full min-w-0 text-xs border-gray-200 bg-white rounded-md shadow-none'
const lineInputCls =
  'h-8 w-full min-w-0 rounded-md border-gray-200 bg-white px-2 text-xs shadow-none focus:border-blue-400'

interface Props {
  type: RequisitionType
  referenceId: string
  description: string
  onReferenceChange: (id: string, listed?: CatalogPickSnapshot) => void
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
          onChange={id => {
            const p = products.find(x => x.id === id)
            onReferenceChange(id, p ? productToCatalogSnapshot(p) : undefined)
          }}
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
          onChange={id => {
            const p = products.find(x => x.id === id)
            onReferenceChange(id, p ? productToCatalogSnapshot(p) : undefined)
          }}
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
          onChange={id => {
            const s = services.find(x => x.id === id)
            onReferenceChange(id, s ? serviceToCatalogSnapshot(s) : undefined)
          }}
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
      <div className={`grid min-w-0 grid-cols-2 gap-x-2 gap-y-1.5 ${className ?? ''}`}>
        <div className="min-w-0">
          {!hideLabel && (
            <p
              title="Asset Category"
              className="flex h-4 items-center overflow-hidden text-[10px] font-semibold uppercase tracking-wide leading-none text-gray-400 dark:text-gray-500 select-none"
            >
              <span className="truncate">Asset Category</span>
            </p>
          )}
          <Select
            value={referenceId}
            onChange={id => onReferenceChange(id)}
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
            <p
              title="Asset Description"
              className="flex h-4 items-center overflow-hidden text-[10px] font-semibold uppercase tracking-wide leading-none text-gray-400 dark:text-gray-500 select-none"
            >
              <span className="truncate">Asset Description <span className="ml-0.5 text-red-500">*</span></span>
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
