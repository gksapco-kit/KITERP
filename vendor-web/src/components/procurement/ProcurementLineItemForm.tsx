import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Trash2, Loader2, Package, AlertTriangle, Info, FileText } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useTaxCodes } from '@/hooks/useFinance'
import {
  buildTaxCodeMap,
  resolveLineTax,
  taxSplitLabel,
  type TaxCode,
} from '@/lib/procurementTax'
import { formatCurrency } from '@/lib/utils'
import { vendorApi } from '@/api/vendor'
import {
  ProcurementLineItemSelector,
  itemSelectorLabel,
  type CatalogPickSnapshot,
} from '@/components/procurement/ProcurementLineItemSelector'
import {
  type RequisitionType,
  type ItemRow,
  QTY_LABELS,
  REQUISITION_TYPES,
  PRIORITIES,
  DEFAULT_UOM,
} from '@/components/procurement/procurementLineItemTypes'
import {
  type ProcurementProductContext,
  normalizeUom,
} from '@/lib/procurementProductContext'
import {
  priceToInput,
  resolveCatalogPurchasePrice,
  resolveServicePurchasePrice,
} from '@/lib/procurementPurchasePrice'
import { uomLabel } from '@/lib/uomOptions'
import { variantSelectOption, type VariantSelectSource } from '@/lib/productVariants'
import { LineCollapsedGlimpse } from '@/components/procurement/LineCollapsedGlimpse'
import { LineItemExpandHeader } from '@/components/procurement/LineItemExpandHeader'
import {
  buildProductMasterFacts,
  buildServiceMasterFacts,
  getMasterFactValue,
  PRODUCT_MASTER_SLOTS,
  SERVICE_MASTER_SLOTS,
} from '@/components/procurement/LineMasterFacts'

type ProductVariant = VariantSelectSource & { hsn_code?: string | null }

interface ServiceMasterSnapshot {
  id?: string
  sac_code?: string | null
  material_code?: string | null
  purchase_price?: number | null
  gst_rate?: number | null
  tax_rate?: number | null
  is_taxable?: boolean
  name?: string
}

function snapshotToProductContext(listed: CatalogPickSnapshot): ProcurementProductContext {
  return {
    product_id: listed.id,
    name: listed.name || '',
    material_code: listed.material_code,
    sku: listed.sku,
    uom: normalizeUom(listed.uom),
    cost_price: listed.cost_price ?? null,
    hsn_code: listed.hsn_code,
    barcode: listed.barcode,
    gst_rate: listed.gst_rate ?? listed.tax_rate,
    is_taxable: listed.is_taxable !== false,
    store_scope: 'all',
    entities: [],
    available_stock: 0,
    reserved_qty: 0,
    open_requisition_qty: 0,
    open_po_qty: 0,
    on_demand_mrp: 0,
    stock_by_location: [],
  }
}

function snapshotToServiceMaster(listed: CatalogPickSnapshot): ServiceMasterSnapshot {
  return {
    id: listed.id,
    sac_code: listed.sac_code,
    material_code: listed.material_code,
    purchase_price: listed.purchase_price ?? listed.purchase_price_fixed ?? listed.cost_price,
    gst_rate: listed.gst_rate,
    tax_rate: listed.tax_rate,
    is_taxable: listed.is_taxable,
    name: listed.name,
  }
}

interface CostCenterOption {
  id: string
  code: string
  name: string
}

interface Props {
  item: ItemRow
  lineNumber: number
  canRemove: boolean
  /** Controlled expand state. Uncontrolled (starts expanded) when omitted. */
  expanded?: boolean
  onToggleExpand?: () => void
  costCenters: CostCenterOption[]
  costCentersLoading: boolean
  storeId?: string | null
  /** Header destination plant — used for product stock context (PO-style). */
  destinationPlantId?: string | null
  onChange: (field: keyof ItemRow, value: string | number) => void
  onPatch: (patch: Partial<ItemRow>) => void
  onRemove: () => void
  /** Seed empty header destination from catalog defaults. */
  onSuggestDestination?: (plantId: string, storageLocationId?: string) => void
  /** Field that failed validation — expands the line and highlights the control. */
  errorField?: keyof ItemRow | null
}

function LineField({
  label,
  required,
  children,
  className,
  error,
}: {
  label: string
  required?: boolean
  children: ReactNode
  className?: string
  error?: boolean
}) {
  return (
    <div className={`min-w-0 ${className ?? ''}`}>
      <p
        title={label}
        className={`flex h-4 items-center overflow-hidden text-[10px] font-semibold uppercase tracking-wide leading-none select-none ${
          error ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'
        }`}
      >
        <span className="truncate">
          {label}{required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
      </p>
      <div className="mt-1">{children}</div>
      {error ? (
        <p className="mt-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">Required</p>
      ) : null}
    </div>
  )
}

const lineSelectTrigger =
  'h-8 w-full min-w-0 text-xs border-gray-200 bg-white rounded-md shadow-none'
const lineInputCls =
  'h-8 w-full min-w-0 rounded-md border-gray-200 bg-white px-2 text-sm shadow-none focus:border-blue-400 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
/** Uniform row grid so field columns align across pricing / ops rows. */
const LINE_ROW_GRID =
  'grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6'
const readonlyBoxCls =
  'flex h-8 items-center rounded-md border border-gray-200 bg-gray-50 px-2.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-200'
const dashedBoxCls =
  'flex h-8 items-center rounded-md border border-dashed border-gray-200 px-2 text-xs text-gray-400 dark:border-gray-700'

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
          <p className="text-xs text-gray-500 mb-0.5">Barcode</p>
          <p className="font-medium font-mono">{ctx.barcode || '—'}</p>
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
  expanded: expandedProp,
  onToggleExpand,
  costCenters,
  costCentersLoading,
  storeId: headerStoreId,
  destinationPlantId,
  onChange,
  onPatch,
  onRemove,
  onSuggestDestination,
  errorField = null,
}: Props) {
  const type = item.item_type

  const { data: taxCodesData, error: taxCodesError } = useTaxCodes()
  const activeTaxCodes = useMemo(
    () => ((taxCodesData as TaxCode[] | undefined) ?? []).filter(c => c.is_active !== false),
    [taxCodesData],
  )
  const taxCodeMap = useMemo(() => buildTaxCodeMap(taxCodesData as TaxCode[] | undefined), [taxCodesData])
  const taxCodesUnavailable = !!taxCodesError
  const defaultStoreId = headerStoreId || null

  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [variantsForId, setVariantsForId] = useState('')
  const [variantsLoading, setVariantsLoading] = useState(false)
  const [productContext, setProductContext] = useState<ProcurementProductContext | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [productDetailsOpen, setProductDetailsOpen] = useState(false)
  const [serviceMasterLoading, setServiceMasterLoading] = useState(false)
  const [serviceMaster, setServiceMaster] = useState<ServiceMasterSnapshot | null>(null)
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(true)
  const productFetchGen = useRef(0)
  const serviceFetchGen = useRef(0)
  const variantFetchGen = useRef(0)
  const catalogKeyRef = useRef({ referenceId: '', variantId: '', plantId: destinationPlantId || '' })

  useEffect(() => {
    if (errorField) setUncontrolledExpanded(true)
  }, [errorField])

  const fieldErrorCls = 'border-red-400 bg-red-50 ring-1 ring-red-200 dark:border-red-500/60 dark:bg-red-950/30'
  const hasError = (field: keyof ItemRow) => errorField === field

  const isCatalogLine = type === 'product' || type === 'consumption'
  const showVariantColumn = isCatalogLine
  const showPrice = type !== 'consumption'
  const showServicePeriod = type === 'service'
  const showAssetTag = type === 'asset'
  const showAccountAssignment = type === 'other'
  /** UoM is driven by product/service master when a catalog item is selected. */
  const uomFromMaster = isCatalogLine || type === 'service'

  const lineTotal = (Number(item.quantity) || 0) * (Number(item.estimated_price) || 0)
  const lineTax = resolveLineTax(lineTotal, item.tax_code, taxCodeMap, false)

  const loadVariants = useCallback(async (productId: string) => {
    if (!productId) {
      setVariants([])
      setVariantsForId('')
      return
    }
    const gen = ++variantFetchGen.current
    setVariantsLoading(true)
    try {
      const full = await vendorApi.getProduct(productId)
      if (gen !== variantFetchGen.current) return
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
        hsn_code: (v as { hsn_code?: string | null }).hsn_code ?? null,
      })))
      setVariantsForId(productId)
    } catch {
      if (gen !== variantFetchGen.current) return
      setVariants([])
      setVariantsForId(productId)
    } finally {
      if (gen === variantFetchGen.current) setVariantsLoading(false)
    }
  }, [])

  const onPatchRef = useRef(onPatch)
  onPatchRef.current = onPatch
  const onSuggestDestinationRef = useRef(onSuggestDestination)
  onSuggestDestinationRef.current = onSuggestDestination
  const itemRef = useRef(item)
  itemRef.current = item

  const loadProductContext = useCallback(async (
    productId: string,
    variantId?: string,
    plantId?: string,
    opts?: { applyPrice?: boolean },
  ) => {
    if (!productId) {
      setProductContext(null)
      return
    }
    const gen = ++productFetchGen.current
    setContextLoading(true)
    try {
      const ctx = await vendorApi.getProcurementProductContext(productId, {
        variant_id: variantId || undefined,
        store_id: defaultStoreId || undefined,
        plant_id: plantId || undefined,
      }) as ProcurementProductContext

      if (gen !== productFetchGen.current) return
      setProductContext(ctx)

      const patch: Partial<ItemRow> = {
        uom: normalizeUom(ctx.uom),
      }
      if (opts?.applyPrice !== false && itemRef.current.item_type !== 'consumption') {
        patch.estimated_price = priceToInput(resolveCatalogPurchasePrice(
          { cost_price: ctx.cost_price, price: null },
          undefined,
        ))
      }
      onPatchRef.current(patch)

      if (ctx.default_plant_id) {
        onSuggestDestinationRef.current?.(
          ctx.default_plant_id,
          ctx.default_storage_location_id || undefined,
        )
      }
    } catch {
      if (gen !== productFetchGen.current) return
      setProductContext(null)
    } finally {
      if (gen === productFetchGen.current) setContextLoading(false)
    }
  }, [defaultStoreId])

  const loadServiceMaster = useCallback(async (serviceId: string) => {
    if (!serviceId) {
      setServiceMaster(null)
      return
    }
    const gen = ++serviceFetchGen.current
    setServiceMasterLoading(true)
    try {
      const detail = await vendorApi.getService(serviceId)
      if (gen !== serviceFetchGen.current) return
      setServiceMaster({
        id: serviceId,
        sac_code: detail.sac_code,
        material_code: detail.material_code,
        purchase_price: detail.purchase_price,
        gst_rate: detail.gst_rate,
        tax_rate: detail.tax_rate,
        is_taxable: detail.is_taxable,
        name: detail.name,
      })
      const patch: Partial<ItemRow> = {
        uom: detail.uom ? normalizeUom(detail.uom) : DEFAULT_UOM.service,
        estimated_price: priceToInput(resolveServicePurchasePrice(detail)),
      }
      onPatchRef.current(patch)
    } catch {
      if (gen !== serviceFetchGen.current) return
      setServiceMaster(null)
    } finally {
      if (gen === serviceFetchGen.current) setServiceMasterLoading(false)
    }
  }, [])

  useEffect(() => {
    if (item.reference_id && isCatalogLine) loadVariants(item.reference_id)
    else {
      setVariants([])
      setVariantsForId('')
    }
  }, [item.reference_id, isCatalogLine, loadVariants])

  useEffect(() => {
    const plantId = destinationPlantId || ''
    const prev = catalogKeyRef.current
    const productChanged = prev.referenceId !== item.reference_id || prev.variantId !== (item.variant_id || '')
    const plantChanged = prev.plantId !== plantId
    catalogKeyRef.current = {
      referenceId: item.reference_id,
      variantId: item.variant_id || '',
      plantId,
    }

    if (!isCatalogLine || !item.reference_id) {
      setProductContext(null)
      return
    }
    if (!productChanged && !plantChanged) return
    loadProductContext(item.reference_id, item.variant_id, destinationPlantId || undefined, {
      applyPrice: productChanged,
    })
  }, [item.reference_id, item.variant_id, destinationPlantId, isCatalogLine, loadProductContext])

  useEffect(() => {
    if (type === 'service' && item.reference_id) {
      loadServiceMaster(item.reference_id)
    } else {
      setServiceMaster(null)
      setServiceMasterLoading(false)
    }
  }, [type, item.reference_id, loadServiceMaster])

  // When variants arrive after product select and line price is still empty,
  // seed from variant master costs (common when cost lives only on variants).
  useEffect(() => {
    if (!isCatalogLine || item.item_type === 'consumption') return
    if (!item.reference_id || variantsLoading) return
    if (String(item.estimated_price ?? '').trim()) return
    if (!variants.length && productContext?.cost_price == null) return
    const masterPrice = resolveCatalogPurchasePrice(
      {
        cost_price: productContext?.cost_price ?? null,
        price: null,
        variants,
      },
      item.variant_id || undefined,
    )
    if (masterPrice != null) {
      onPatchRef.current({ estimated_price: priceToInput(masterPrice) })
    }
  }, [
    isCatalogLine,
    item.item_type,
    item.reference_id,
    item.variant_id,
    item.estimated_price,
    variants,
    variantsLoading,
    productContext?.cost_price,
  ])

  const handleItemTypeChange = (newType: RequisitionType) => {
    productFetchGen.current += 1
    serviceFetchGen.current += 1
    variantFetchGen.current += 1
    setProductContext(null)
    setServiceMaster(null)
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

  const handleReferenceChange = (id: string, listed?: CatalogPickSnapshot) => {
    if (!id) {
      productFetchGen.current += 1
      serviceFetchGen.current += 1
      variantFetchGen.current += 1
      setProductContext(null)
      setServiceMaster(null)
      onPatch({
        reference_id: '',
        variant_id: '',
        uom: DEFAULT_UOM[type],
        estimated_price: '',
      })
      return
    }

    // Drop in-flight detail fetches so a slower previous product cannot overwrite this pick.
    productFetchGen.current += 1
    serviceFetchGen.current += 1
    variantFetchGen.current += 1

    const patch: Partial<ItemRow> = {
      reference_id: id,
      variant_id: '',
    }
    if (listed?.uom && uomFromMaster) {
      patch.uom = normalizeUom(listed.uom)
    } else if (!uomFromMaster) {
      patch.uom = DEFAULT_UOM[type]
    }

    if (type !== 'consumption' && listed) {
      const masterPrice = type === 'service'
        ? resolveServicePurchasePrice(listed)
        : resolveCatalogPurchasePrice(listed, undefined)
      if (masterPrice != null) patch.estimated_price = priceToInput(masterPrice)
    }

    if (isCatalogLine) {
      setProductContext(listed ? snapshotToProductContext(listed) : null)
      setServiceMaster(null)
    } else if (type === 'service') {
      setServiceMaster(listed ? snapshotToServiceMaster(listed) : null)
      setProductContext(null)
    }

    onPatch(patch)
  }

  const handleVariantChange = (variantId: string) => {
    const variant = variants.find(v => v.id === variantId)
    const masterPrice = variant
      ? resolveCatalogPurchasePrice(
          { cost_price: null, price: null, variants },
          variantId,
        )
      : null
    onPatch({
      variant_id: variantId,
      ...(variant?.uom ? { uom: normalizeUom(variant.uom) } : {}),
      ...(masterPrice != null ? { estimated_price: priceToInput(masterPrice) } : {}),
    })
  }

  const selectorRequired = type !== 'asset'
  const hasTypeExtras = showServicePeriod || showAssetTag || showAccountAssignment
  const variantsReady = variantsForId === item.reference_id
  const masterFactsPending = Boolean(item.reference_id) && (
    isCatalogLine
      ? productContext?.product_id !== item.reference_id
      : type === 'service'
        ? serviceMaster?.id !== item.reference_id
        : false
  )
  const uomLoading =
    ((isCatalogLine && contextLoading) || (type === 'service' && serviceMasterLoading)) && !item.uom

  const isExpanded = expandedProp ?? uncontrolledExpanded
  const toggleExpand = () => {
    if (onToggleExpand) onToggleExpand()
    else setUncontrolledExpanded(v => !v)
  }
  const typeLabel = REQUISITION_TYPES.find(t => t.value === type)?.label ?? type
  const summaryLabel = productContext?.name
    || serviceMaster?.name
    || (item.description.trim() ? item.description.trim() : null)
    || (item.reference_id ? 'Item selected' : 'No item selected')
  const selectedVariant = item.variant_id
    ? variants.find(v => v.id === item.variant_id)
    : undefined
  const variantName = selectedVariant?.name || null
  const unitPrice = showPrice
    ? (Number(item.estimated_price) > 0 ? Number(item.estimated_price) : null)
    : null
  const costCenter = item.cost_center_id
    ? costCenters.find(cc => cc.id === item.cost_center_id)
    : undefined
  const costCenterLabel = costCenter ? costCenter.code : null
  const priorityLabel = item.priority && item.priority !== 'medium'
    ? item.priority.charAt(0).toUpperCase() + item.priority.slice(1)
    : null
  const masterFacts = type === 'service'
    ? buildServiceMasterFacts(serviceMaster)
    : buildProductMasterFacts({
        hsn_code: selectedVariant?.hsn_code || productContext?.hsn_code,
        barcode: selectedVariant?.barcode || productContext?.barcode,
        sku: selectedVariant?.sku || productContext?.sku,
        material_code: productContext?.material_code,
        gst_rate: productContext?.gst_rate,
        is_taxable: productContext?.is_taxable,
      })

  const lineHeader = (
    <LineItemExpandHeader
      lineNumber={lineNumber}
      typeLabel={typeLabel}
      expanded={isExpanded}
      onToggle={toggleExpand}
    />
  )

  if (!isExpanded) {
    return (
      <div className="flex flex-col gap-1.5 px-3 py-2 sm:px-4">
        {lineHeader}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleExpand}
            className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-80"
          >
            <LineCollapsedGlimpse
              typeLabel=""
              title={summaryLabel}
              quantity={item.quantity}
              uom={item.uom}
              unitPrice={unitPrice}
              taxCode={item.tax_code}
              taxAmount={lineTax.amount}
              variantName={variantName}
              masterFacts={masterFacts}
              extras={[costCenterLabel, priorityLabel]}
            />
          </button>
          <div
            className="min-w-[9.5rem] w-[9.5rem] shrink-0 rounded-md border border-blue-100 bg-blue-50/70 px-2 py-1.5 text-right dark:border-blue-900/40 dark:bg-blue-950/20 sm:min-w-[10.5rem] sm:w-[10.5rem]"
            title={`${formatCurrency(lineTotal)}${lineTax.amount > 0 ? ` (+${formatCurrency(lineTax.amount)} tax)` : ''}`}
          >
            <p className="text-[9px] font-semibold uppercase tracking-wide text-blue-500/80 leading-none">Total</p>
            <p className="mt-0.5 text-xs font-semibold tabular-nums leading-snug text-blue-800 dark:text-blue-200">
              {formatCurrency(lineTotal)}
            </p>
            {lineTax.amount > 0 && (
              <p className="text-[10px] tabular-nums leading-snug text-blue-600/70 dark:text-blue-300/70">
                +{formatCurrency(lineTax.amount)} tax
              </p>
            )}
          </div>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove line"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-600" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 px-3 py-3 sm:px-4">
      {lineHeader}

      <div className="flex items-start gap-2">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Row 1 — type / catalog / variant / qty / price / tax */}
        <div className={LINE_ROW_GRID}>
          <LineField label="Item Type">
            <Select
              value={type}
              onChange={v => handleItemTypeChange(v as RequisitionType)}
              options={REQUISITION_TYPES}
              className="w-full min-w-0"
              triggerClassName={lineSelectTrigger}
              aria-label="Item type"
            />
          </LineField>

          {type === 'asset' ? (
            <div className="col-span-2 min-w-0">
              <ProcurementLineItemSelector
                type={type}
                referenceId={item.reference_id}
                description={item.description}
                onReferenceChange={handleReferenceChange}
                onDescriptionChange={value => onChange('description', value)}
                triggerClassName={`${lineSelectTrigger}${hasError('description') || hasError('reference_id') ? ` ${fieldErrorCls}` : ''}`}
              />
              {(hasError('description') || hasError('reference_id')) ? (
                <p className="mt-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">Required</p>
              ) : null}
            </div>
          ) : (
            <LineField
              label={itemSelectorLabel(type)}
              required={selectorRequired || type === 'other'}
              error={hasError('reference_id') || hasError('description')}
            >
              <ProcurementLineItemSelector
                type={type}
                referenceId={item.reference_id}
                description={item.description}
                onReferenceChange={handleReferenceChange}
                onDescriptionChange={value => onChange('description', value)}
                hideLabel
                triggerClassName={`${lineSelectTrigger}${hasError('reference_id') || hasError('description') ? ` ${fieldErrorCls}` : ''}`}
              />
            </LineField>
          )}

          {type !== 'asset' && (
            <LineField label="Variant">
            {showVariantColumn ? (
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  {!item.reference_id ? (
                    <div className={dashedBoxCls}>Select product first</div>
                  ) : !variantsReady ? (
                    <div className="flex h-8 items-center gap-1.5 text-[11px] text-gray-400">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                    </div>
                  ) : variants.length > 0 ? (
                    <Select
                      value={item.variant_id}
                      onChange={handleVariantChange}
                      options={selectOptionsWithBlank(
                        '— Product level —',
                        variants.map(variantSelectOption),
                      )}
                      placeholder="— Product level —"
                      className="w-full min-w-0"
                      showSelectedHint={false}
                      triggerClassName={lineSelectTrigger}
                      aria-label="Variant"
                    />
                  ) : (
                    <div className={dashedBoxCls}>—</div>
                  )}
                </div>
                {item.reference_id && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 border-gray-200 shadow-none"
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
            ) : (
              <div className={dashedBoxCls}>—</div>
            )}
            </LineField>
          )}

          <LineField label={QTY_LABELS[type]} required>
            <Input
              type="number"
              min={0.001}
              step={type === 'service' ? 0.5 : 0.001}
              value={item.quantity}
              onChange={e => onChange('quantity', e.target.value)}
              onWheel={e => (e.target as HTMLInputElement).blur()}
              className={`${lineInputCls} font-semibold`}
            />
          </LineField>

          {showPrice ? (
            <LineField label={type === 'product' ? 'Purchase Price' : 'Est. Unit Price'}>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={item.estimated_price}
                onChange={e => onChange('estimated_price', e.target.value)}
                onWheel={e => (e.target as HTMLInputElement).blur()}
                className={`${lineInputCls} font-semibold`}
              />
            </LineField>
          ) : (
            <div className="hidden lg:block" />
          )}

          <LineField label="Tax Code">
            <Select
              value={item.tax_code}
              onChange={v => onChange('tax_code', v)}
              options={[
                {
                  value: '',
                  label: taxCodesUnavailable ? '⚠ Unavailable' : activeTaxCodes.length ? '— No tax —' : 'No tax codes',
                },
                ...activeTaxCodes.map(c => ({
                  value: c.code,
                  label: `${c.code} · ${Number(c.rate) || 0}%`,
                  hint: taxSplitLabel(c, false) || (c.tax_type || '').toUpperCase(),
                })),
                ...(item.tax_code && !taxCodeMap.has(item.tax_code.trim().toUpperCase())
                  ? [{ value: item.tax_code, label: item.tax_code, hint: 'unknown' }]
                  : []),
              ]}
              aria-label="Tax code"
              className="w-full min-w-0"
              showSelectedHint={false}
              triggerClassName={`${lineSelectTrigger} ${
                taxCodesUnavailable
                  ? 'border-red-300 bg-red-50'
                  : item.tax_code && !taxCodeMap.has(item.tax_code.trim().toUpperCase())
                    ? 'border-amber-300 bg-amber-50'
                    : ''
              }`}
            />
          </LineField>
        </div>

        {/* Row 2 — UoM + master codes (or service period) — no empty gaps */}
        <div className={LINE_ROW_GRID}>
          <LineField label="UoM">
            {uomFromMaster ? (
              !item.reference_id ? (
                <div className={dashedBoxCls}>—</div>
              ) : (
                <div className={readonlyBoxCls} title="From product / service master">
                  {uomLoading ? 'Loading…' : (uomLabel(item.uom) || item.uom || '—')}
                </div>
              )
            ) : (
              <Input
                value={item.uom}
                onChange={e => onChange('uom', e.target.value)}
                className={lineInputCls}
              />
            )}
          </LineField>

          {showServicePeriod ? (
            <>
              <LineField label="Service From">
                <Input
                  type="date"
                  value={item.service_period_from}
                  onChange={e => onChange('service_period_from', e.target.value)}
                  className={lineInputCls}
                />
              </LineField>
              <LineField label="Service To">
                <Input
                  type="date"
                  value={item.service_period_to}
                  onChange={e => onChange('service_period_to', e.target.value)}
                  className={lineInputCls}
                />
              </LineField>
              {SERVICE_MASTER_SLOTS.map(label => (
                <LineField key={label} label={label}>
                  <div className={`${readonlyBoxCls} font-mono tabular-nums`} title="From service master">
                    {serviceMasterLoading && masterFactsPending
                      ? 'Loading…'
                      : (getMasterFactValue(masterFacts, label) || '—')}
                  </div>
                </LineField>
              ))}
            </>
          ) : isCatalogLine ? (
            PRODUCT_MASTER_SLOTS.map(label => (
              <LineField key={label} label={label}>
                <div className={`${readonlyBoxCls} font-mono tabular-nums`} title="From product master">
                  {(contextLoading || variantsLoading) && masterFactsPending
                    ? 'Loading…'
                    : (getMasterFactValue(masterFacts, label) || '—')}
                </div>
              </LineField>
            ))
          ) : showAssetTag ? (
            <LineField label="Asset Tag">
              <Input
                value={item.asset_tag}
                onChange={e => onChange('asset_tag', e.target.value)}
                placeholder="Optional"
                className={lineInputCls}
              />
            </LineField>
          ) : showAccountAssignment ? (
            <LineField label="Account Assignment">
              <Input
                value={item.account_assignment}
                onChange={e => onChange('account_assignment', e.target.value)}
                placeholder="GL, project…"
                className={lineInputCls}
              />
            </LineField>
          ) : null}
        </div>

        {/* Row 3 — department / priority / date / note — same columns for every type */}
        <div className={LINE_ROW_GRID}>
          <LineField label="Department" required error={hasError('cost_center_id')}>
            <Select
              value={item.cost_center_id}
              onChange={v => onChange('cost_center_id', v)}
              options={selectOptionsWithBlank(
                costCentersLoading ? 'Loading…' : 'Select cost center…',
                costCenters.map(cc => ({ value: cc.id, label: `${cc.code} · ${cc.name}` })),
              )}
              placeholder={costCentersLoading ? 'Loading…' : 'Select cost center…'}
              disabled={costCentersLoading}
              className="w-full min-w-0"
              triggerClassName={`${lineSelectTrigger}${hasError('cost_center_id') ? ` ${fieldErrorCls}` : ''}`}
              aria-label="Cost center"
            />
          </LineField>
          <LineField label="Priority">
            <Select
              value={item.priority}
              onChange={v => onChange('priority', v)}
              options={PRIORITIES.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
              className="w-full min-w-0"
              triggerClassName={lineSelectTrigger}
              aria-label="Priority"
            />
          </LineField>
          <LineField label="Required By">
            <Input
              type="date"
              value={item.needed_by_date}
              onChange={e => onChange('needed_by_date', e.target.value)}
              className={lineInputCls}
            />
          </LineField>
          <LineField label="Note" className="col-span-2 sm:col-span-3 lg:col-span-3">
            <div className="relative">
              <FileText className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
              <Textarea
                rows={1}
                className="min-h-8 h-8 w-full resize-y overflow-auto rounded-md border-gray-200 bg-white py-1.5 pl-7 pr-2 text-xs leading-snug shadow-none placeholder:text-gray-300"
                placeholder={hasTypeExtras ? 'Optional…' : 'Optional notes'}
                value={item.notes}
                onChange={e => onChange('notes', e.target.value)}
              />
            </div>
          </LineField>
        </div>
      </div>

      <div className="flex w-[9.5rem] shrink-0 flex-col gap-2 pt-5 sm:w-[10.5rem]">
        <div
          className="rounded-md border border-blue-100 bg-blue-50/70 px-2 py-1.5 text-right dark:border-blue-900/40 dark:bg-blue-950/20"
          title={`${formatCurrency(lineTotal)}${lineTax.amount > 0 ? ` (+${formatCurrency(lineTax.amount)} tax)` : ''}`}
        >
          <p className="text-[9px] font-semibold uppercase tracking-wide text-blue-500/80 leading-none">Total</p>
          <p className="mt-0.5 text-xs font-semibold tabular-nums leading-snug text-blue-800 dark:text-blue-200">
            {formatCurrency(lineTotal)}
          </p>
          {lineTax.amount > 0 && (
            <p className="text-[10px] tabular-nums leading-snug text-blue-600/70 dark:text-blue-300/70">
              +{formatCurrency(lineTax.amount)} tax
            </p>
          )}
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove line"
            className="ml-auto flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-600" />
          </button>
        )}
      </div>
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
  )
}
