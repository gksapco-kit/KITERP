import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { Trash2, Loader2, Package, AlertTriangle, ChevronDown, ChevronRight, Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useStores, usePlants, useStorageLocationTree } from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import { ProcurementLineItemSelector } from '@/components/procurement/ProcurementLineItemSelector'
import {
  type RequisitionType,
  type ItemRow,
  QTY_LABELS,
  REQUISITION_TYPES,
  PRIORITIES,
  DEFAULT_UOM,
  itemTypeLabel,
} from '@/components/procurement/procurementLineItemTypes'
import {
  type ProcurementProductContext,
  normalizeUom,
} from '@/lib/procurementProductContext'
import { uomLabel } from '@/lib/uomOptions'
import { variantSelectOption, type VariantSelectSource } from '@/lib/productVariants'

type ProductVariant = VariantSelectSource

interface CostCenterOption {
  id: string
  code: string
  name: string
}

interface Props {
  item: ItemRow
  lineNumber: number
  canRemove: boolean
  expanded: boolean
  onToggleExpand: () => void
  costCenters: CostCenterOption[]
  costCentersLoading: boolean
  storeId?: string | null
  onChange: (field: keyof ItemRow, value: string | number) => void
  onPatch: (patch: Partial<ItemRow>) => void
  onRemove: () => void
}

function flattenLocations(
  nodes: { id: string; name: string; children?: { id: string; name: string; children?: unknown[] }[] }[],
  prefix = '',
): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = []
  for (const node of nodes) {
    const label = prefix ? `${prefix} / ${node.name}` : node.name
    out.push({ value: node.id, label })
    if (node.children?.length) {
      out.push(...flattenLocations(node.children as typeof nodes, label))
    }
  }
  return out
}

function FieldCell({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <Label className="text-[11px] leading-tight text-gray-500">{label}</Label>
      <div className="mt-0.5">{children}</div>
    </div>
  )
}

function ReadOnlyValue({ value, className }: { value: string; className?: string }) {
  return (
    <div className={`text-xs h-8 px-2.5 flex items-center rounded-md border bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 ${className ?? ''}`}>
      {value || '—'}
    </div>
  )
}

function ProductContextBody({ ctx, loading }: { ctx: ProcurementProductContext | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-gray-400 py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading product details…
      </div>
    )
  }
  if (!ctx) {
    return <p className="text-sm text-gray-500 py-4">No product details available.</p>
  }

  const entityLabel = ctx.store_scope === 'all'
    ? 'All business units'
    : ctx.entities.map(e => e.name).join(', ') || '—'
  const stockLow = ctx.reorder_point != null && ctx.available_stock <= ctx.reorder_point

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Entity / Business Unit</p>
          <p className="font-medium text-gray-800 dark:text-gray-200" title={entityLabel}>{entityLabel}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Material Code</p>
          <p className="font-medium font-mono">{ctx.material_code || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">SKU</p>
          <p className="font-medium font-mono">{ctx.sku || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">HSN</p>
          <p className="font-medium font-mono">{ctx.hsn_code || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">GST Rate</p>
          <p className="font-medium">{ctx.is_taxable && ctx.gst_rate != null ? `${ctx.gst_rate}%` : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Available Stock</p>
          <p className={`font-semibold ${stockLow ? 'text-amber-600' : 'text-green-700 dark:text-green-400'}`}>
            {ctx.available_stock}
            {ctx.reserved_qty > 0 && (
              <span className="text-gray-400 font-normal ml-1">({ctx.reserved_qty} reserved)</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">On Demand (MRP)</p>
          <p className={`font-semibold ${ctx.on_demand_mrp > 0 ? 'text-orange-600' : 'text-gray-600'}`}>
            {ctx.on_demand_mrp}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Reorder Point</p>
          <p className="font-medium">{ctx.reorder_point ?? '—'}</p>
        </div>
      </div>
      {(ctx.open_requisition_qty > 0 || ctx.open_po_qty > 0) && (
        <div className="flex flex-wrap gap-3 text-xs text-gray-500 border-t pt-3 mt-3">
          {ctx.open_requisition_qty > 0 && (
            <span>In open requisitions: <strong className="text-gray-700">{ctx.open_requisition_qty}</strong></span>
          )}
          {ctx.open_po_qty > 0 && (
            <span>On order (PO): <strong className="text-gray-700">{ctx.open_po_qty}</strong></span>
          )}
        </div>
      )}
      {stockLow && (
        <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1.5 mt-3">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Stock is at or below reorder point — consider raising this requisition quantity.
        </div>
      )}
    </>
  )
}

export function ProcurementLineItemForm({
  item,
  lineNumber,
  canRemove,
  expanded,
  onToggleExpand,
  costCenters,
  costCentersLoading,
  storeId: headerStoreId,
  onChange,
  onPatch,
  onRemove,
}: Props) {
  const type = item.item_type
  const { data: storesData } = useStores()
  const stores = storesData?.stores ?? []
  const activeStores = useMemo(
    () => stores.filter(s => s.is_active !== false),
    [stores],
  )
  const defaultStoreId = useMemo(
    () => headerStoreId || stores.find(s => s.is_default)?.id || stores[0]?.id || null,
    [headerStoreId, stores],
  )

  const { data: plantsData, isLoading: plantsLoading } = usePlants(
    activeStores.length > 1 ? null : defaultStoreId,
  )
  const plants = plantsData?.plants ?? []

  const plantOptions = useMemo(
    () => plants.map(p => {
      const base = p.code ? `${p.name} (${p.code})` : p.name
      if (activeStores.length <= 1) return { value: p.id, label: base }
      const store = activeStores.find(s => s.id === p.store_id)
      const storeLabel = store
        ? (store.code ? `${store.name} (${store.code})` : store.name)
        : null
      return { value: p.id, label: storeLabel ? `${base} — ${storeLabel}` : base }
    }),
    [plants, activeStores],
  )

  const plantStoreId = useMemo(() => {
    if (!item.plant_id) return defaultStoreId
    return plants.find(p => p.id === item.plant_id)?.store_id ?? defaultStoreId
  }, [item.plant_id, plants, defaultStoreId])

  const { data: locationsData, isLoading: locationsLoading } = useStorageLocationTree(
    plantStoreId,
    item.plant_id || null,
  )
  const locationOptions = useMemo(
    () => flattenLocations(locationsData?.locations ?? []),
    [locationsData?.locations],
  )

  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [variantsLoading, setVariantsLoading] = useState(false)
  const [productContext, setProductContext] = useState<ProcurementProductContext | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [productDetailsOpen, setProductDetailsOpen] = useState(false)

  const isCatalogLine = type === 'product' || type === 'consumption'
  const showVariantColumn = isCatalogLine
  const showPrice = type !== 'consumption'
  const showPlant = ['product', 'consumption', 'asset'].includes(type)
  const showStorage = ['product', 'consumption'].includes(type)
  const showServicePeriod = type === 'service'
  const showAssetTag = type === 'asset'
  const showAccountAssignment = type === 'other'

  const lineTotal = (Number(item.quantity) || 0) * (Number(item.estimated_price) || 0)
  const plantLabel = type === 'asset' ? 'Installation Plant' : 'Deliver to Plant'
  const summaryLabel = productContext?.name
    || (item.description.trim() ? item.description.trim() : null)
    || (item.reference_id ? 'Item selected' : 'No item selected')

  const loadVariants = useCallback(async (productId: string) => {
    if (!productId) {
      setVariants([])
      return
    }
    setVariantsLoading(true)
    try {
      const full = await vendorApi.getProduct(productId)
      setVariants((full.variants ?? []).map(v => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode,
        uom: v.uom,
        uom_quantity: v.uom_quantity,
        price: v.price,
        cost_price: v.cost_price,
        currency: v.currency,
        attributes: v.attributes,
        color: v.color,
      })))
    } catch {
      setVariants([])
    } finally {
      setVariantsLoading(false)
    }
  }, [])

  const onPatchRef = useRef(onPatch)
  onPatchRef.current = onPatch
  const itemRef = useRef(item)
  itemRef.current = item

  const loadProductContext = useCallback(async (productId: string, variantId?: string, plantId?: string) => {
    if (!productId) {
      setProductContext(null)
      return
    }
    setContextLoading(true)
    try {
      const ctx = await vendorApi.getProcurementProductContext(productId, {
        variant_id: variantId || undefined,
        store_id: defaultStoreId || undefined,
        plant_id: plantId || undefined,
      }) as ProcurementProductContext

      setProductContext(ctx)

      const current = itemRef.current
      const patch: Partial<ItemRow> = {
        uom: normalizeUom(ctx.uom),
      }
      if (current.item_type !== 'consumption') {
    // Seed purchase price from catalog only when the line has none yet
    if (!String(current.estimated_price ?? '').trim() && ctx.cost_price != null) {
      patch.estimated_price = String(ctx.cost_price)
    }
  }
      if (!current.plant_id && ctx.default_plant_id) {
        patch.plant_id = ctx.default_plant_id
      }
      if (!current.storage_location_id && ctx.default_storage_location_id) {
        patch.storage_location_id = ctx.default_storage_location_id
      }
      onPatchRef.current(patch)
    } catch {
      setProductContext(null)
    } finally {
      setContextLoading(false)
    }
  }, [defaultStoreId])

  useEffect(() => {
    if (item.reference_id && isCatalogLine) loadVariants(item.reference_id)
    else setVariants([])
  }, [item.reference_id, isCatalogLine, loadVariants])

  useEffect(() => {
    if (isCatalogLine && item.reference_id) {
      loadProductContext(item.reference_id, item.variant_id, item.plant_id)
    } else {
      setProductContext(null)
    }
  }, [item.reference_id, item.variant_id, item.plant_id, isCatalogLine, loadProductContext])

  const handleItemTypeChange = (newType: RequisitionType) => {
    onPatch({
      item_type: newType,
      reference_id: '',
      variant_id: '',
      description: '',
      uom: DEFAULT_UOM[newType],
      estimated_price: '',
      plant_id: '',
      storage_location_id: '',
      asset_tag: '',
      account_assignment: '',
      service_period_from: '',
      service_period_to: '',
    })
  }

  const handleReferenceChange = (id: string) => {
    onPatch({
      reference_id: id,
      variant_id: '',
      plant_id: '',
      storage_location_id: '',
      uom: DEFAULT_UOM[type],
      estimated_price: '',
    })
  }

  const inputClass = 'text-xs h-8 py-0 px-2.5'
  const selectorClass = 'min-w-0 [&_label]:text-[11px] [&_label]:leading-tight [&_label]:text-gray-500 [&_select]:h-8 [&_select]:text-xs [&_select]:py-0 [&_select]:px-2.5 [&_input]:h-8 [&_input]:text-xs [&_input]:py-0 [&_input]:px-2.5'
  const rowGrid = 'grid grid-cols-4 gap-x-3 gap-y-2.5'

  const variantField = (
    <FieldCell label="Variant">
      <div className="flex items-center gap-1">
        <div className="flex-1 min-w-0">
          {!item.reference_id ? (
            <div className={`${inputClass} flex items-center text-gray-400 border rounded-md bg-gray-50 dark:bg-gray-900/50`}>
              Select product first
            </div>
          ) : variantsLoading ? (
            <div className="flex items-center gap-1 text-[11px] text-gray-400 h-8">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </div>
          ) : variants.length > 0 ? (
            <Select
              value={item.variant_id}
              onChange={v => onChange('variant_id', v)}
              options={selectOptionsWithBlank(
                '— Product level —',
                variants.map(variantSelectOption),
              )}
              placeholder="— Product level —"
              className={inputClass}
              triggerClassName="h-8 px-2.5 text-xs"
              aria-label="Variant"
            />
          ) : (
            <div className={`${inputClass} flex items-center text-gray-400 border rounded-md bg-gray-50 dark:bg-gray-900/50`}>
              No variants
            </div>
          )}
        </div>
        {item.reference_id && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            title="Product details"
            aria-label="Product details"
            onClick={() => setProductDetailsOpen(true)}
            disabled={contextLoading && !productContext}
          >
            {contextLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Info className="w-3.5 h-3.5" />}
          </Button>
        )}
      </div>
    </FieldCell>
  )

  return (
    <div className="border rounded-md bg-gray-50 dark:bg-gray-800/50 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-900/50 border-b">
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex flex-1 items-center gap-2 min-w-0 text-left hover:opacity-80"
        >
          {expanded
            ? <ChevronDown className="w-4 h-4 shrink-0 text-gray-400" />
            : <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />}
          <span className="text-xs font-semibold text-gray-600 shrink-0">Line {lineNumber}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 shrink-0">
            {itemTypeLabel(type)}
          </span>
          <span className="text-xs text-gray-800 dark:text-gray-200 truncate flex-1">{summaryLabel}</span>
          <span className="text-[11px] text-gray-500 shrink-0 hidden sm:inline">
            {item.quantity} {uomLabel(item.uom)}
            {showPrice && lineTotal > 0 && ` · ₹${lineTotal.toFixed(2)}`}
          </span>
        </button>
        {canRemove && (
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onRemove}>
            <Trash2 className="w-3 h-3 text-red-500" />
          </Button>
        )}
      </div>

      {expanded && (
        <div className="p-3 space-y-2.5 bg-white dark:bg-gray-900/30">
          {/* Row 1: line meta */}
          <div className={rowGrid}>
            <FieldCell label="Requisition Type">
              <Select
                value={type}
                onChange={v => handleItemTypeChange(v as RequisitionType)}
                options={REQUISITION_TYPES}
                className={inputClass}
                aria-label="Requisition type"
              />
            </FieldCell>
            <FieldCell label="Department (Cost Center)">
              <Select
                value={item.cost_center_id}
                onChange={v => onChange('cost_center_id', v)}
                options={selectOptionsWithBlank(
                  costCentersLoading ? 'Loading…' : 'Select cost center…',
                  costCenters.map(cc => ({ value: cc.id, label: `${cc.code} · ${cc.name}` })),
                )}
                placeholder={costCentersLoading ? 'Loading…' : 'Select cost center…'}
                disabled={costCentersLoading}
                className={inputClass}
                aria-label="Cost center"
              />
            </FieldCell>
            <FieldCell label="Priority">
              <Select
                value={item.priority}
                onChange={v => onChange('priority', v)}
                options={PRIORITIES.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
                className={inputClass}
                aria-label="Priority"
              />
            </FieldCell>
            <FieldCell label="Required By">
              <Input
                type="date"
                value={item.needed_by_date}
                onChange={e => onChange('needed_by_date', e.target.value)}
                className={inputClass}
              />
            </FieldCell>
          </div>

          {/* Row 2: item selection */}
          <div className={rowGrid}>
            {showVariantColumn ? (
              <>
                <div className="col-span-2 min-w-0">
                  <ProcurementLineItemSelector
                    type={type}
                    referenceId={item.reference_id}
                    description={item.description}
                    onReferenceChange={handleReferenceChange}
                    onDescriptionChange={value => onChange('description', value)}
                    className={selectorClass}
                  />
                </div>
                <div className="col-span-2 min-w-0">{variantField}</div>
              </>
            ) : (
              <div className="col-span-4 min-w-0">
                <ProcurementLineItemSelector
                  type={type}
                  referenceId={item.reference_id}
                  description={item.description}
                  onReferenceChange={handleReferenceChange}
                  onDescriptionChange={value => onChange('description', value)}
                  className={selectorClass}
                />
              </div>
            )}
          </div>

          {/* Row 3: quantity & pricing */}
          <div className={rowGrid}>
            <FieldCell label={QTY_LABELS[type]}>
              <Input
                type="number"
                min={0.001}
                step={type === 'service' ? 0.5 : 0.001}
                value={item.quantity}
                onChange={e => onChange('quantity', e.target.value)}
                className={inputClass}
              />
            </FieldCell>
            <FieldCell label="Unit of Measure">
              {isCatalogLine && item.reference_id ? (
                <ReadOnlyValue
                  value={contextLoading && !item.uom ? 'Loading…' : (uomLabel(item.uom) || item.uom || '—')}
                />
              ) : (
                <Input
                  value={item.uom}
                  onChange={e => onChange('uom', e.target.value)}
                  className={inputClass}
                />
              )}
            </FieldCell>
            {showPrice ? (
              <FieldCell label={type === 'product' ? 'Purchase Price' : 'Est. Unit Price'}>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={item.estimated_price}
                  onChange={e => onChange('estimated_price', e.target.value)}
                  className={inputClass}
                />
              </FieldCell>
            ) : (
              <div aria-hidden="true" />
            )}
            {showServicePeriod ? (
              <FieldCell label="Service From">
                <Input
                  type="date"
                  value={item.service_period_from}
                  onChange={e => onChange('service_period_from', e.target.value)}
                  className={inputClass}
                />
              </FieldCell>
            ) : showAccountAssignment ? (
              <FieldCell label="Account Assignment">
                <Input
                  value={item.account_assignment}
                  onChange={e => onChange('account_assignment', e.target.value)}
                  placeholder="GL, project…"
                  className={inputClass}
                />
              </FieldCell>
            ) : showPlant ? (
              <FieldCell label={plantLabel}>
                <Select
                  value={item.plant_id}
                  onChange={v => onPatch({ plant_id: v, storage_location_id: '' })}
                  options={selectOptionsWithBlank(
                    plantsLoading ? 'Loading…' : 'Select plant…',
                    plantOptions,
                  )}
                  placeholder={plantsLoading ? 'Loading…' : 'Select plant…'}
                  disabled={plantsLoading || (activeStores.length <= 1 && !defaultStoreId)}
                  className={inputClass}
                  aria-label="Plant"
                />
              </FieldCell>
            ) : (
              <div aria-hidden="true" />
            )}
          </div>

          {/* Row 4: logistics & notes */}
          <div className={rowGrid}>
            {showServicePeriod ? (
              <FieldCell label="Service To">
                <Input
                  type="date"
                  value={item.service_period_to}
                  onChange={e => onChange('service_period_to', e.target.value)}
                  className={inputClass}
                />
              </FieldCell>
            ) : showStorage ? (
              <FieldCell label="Storage Location">
                <Select
                  value={item.storage_location_id}
                  onChange={v => onChange('storage_location_id', v)}
                  options={selectOptionsWithBlank(
                    locationsLoading ? 'Loading…' : 'Select location…',
                    locationOptions,
                  )}
                  placeholder={
                    !item.plant_id
                      ? 'Select plant first…'
                      : locationsLoading
                        ? 'Loading…'
                        : 'Select location…'
                  }
                  disabled={!item.plant_id || locationsLoading}
                  className={inputClass}
                  aria-label="Storage location"
                />
              </FieldCell>
            ) : showAssetTag ? (
              <FieldCell label="Asset Tag / Serial">
                <Input
                  value={item.asset_tag}
                  onChange={e => onChange('asset_tag', e.target.value)}
                  placeholder="Optional"
                  className={inputClass}
                />
              </FieldCell>
            ) : null}
            <FieldCell
              label="Line Notes"
              className={showServicePeriod || showStorage || showAssetTag ? 'col-span-3' : 'col-span-4'}
            >
              <Input
                placeholder="Optional notes"
                value={item.notes}
                onChange={e => onChange('notes', e.target.value)}
                className={inputClass}
              />
            </FieldCell>
          </div>

          <Dialog open={productDetailsOpen} onOpenChange={setProductDetailsOpen}>
            <DialogContent className="max-w-md sm:max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Package className="w-4 h-4" /> Product Details
                </DialogTitle>
                {productContext?.name && (
                  <DialogDescription>{productContext.name}</DialogDescription>
                )}
              </DialogHeader>
              <ProductContextBody ctx={productContext} loading={contextLoading} />
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  )
}
