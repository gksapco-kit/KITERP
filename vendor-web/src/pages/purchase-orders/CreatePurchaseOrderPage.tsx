import { useState, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  PoDestinationFields,
  emptyPoDestination,
  poDestinationFromLine,
  poDestinationToPayload,
  poDestinationToHeaderPayload,
  type PoDestinationValue,
} from '@/components/procurement/PoDestinationFields'
import { ProcurementApproverFields } from '@/components/procurement/ProcurementApproverFields'
import {
  useCreatePurchaseOrder, useSuppliers, useProducts, useServices,
  useCreateSupplier, useRequisitions,
} from '@/hooks/useVendor'
import { useTaxCodes, useCostCenters } from '@/hooks/useFinance'
import { useVendorStore } from '@/stores/vendorStore'
import { vendorApi } from '@/api/vendor'
import { formatCurrency, cn } from '@/lib/utils'
import { buildTaxCodeMap, resolveLineTax, isIntraState, taxSplitLabel, type TaxCode } from '@/lib/procurementTax'
import { dedupeSuppliers, findExistingSupplier } from '@/lib/supplierUtils'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { UOM_OPTIONS, uomLabel } from '@/lib/uomOptions'
import { normalizeUom } from '@/lib/procurementProductContext'
import {
  priceToInput,
  resolveCatalogPurchasePrice,
  resolveProductPurchasePrice,
  resolveServicePurchasePrice,
} from '@/lib/procurementPurchasePrice'
import type { Product, Service, PurchaseRequisition, Supplier, PurchaseOrder } from '@/types'
import type { CostCenter } from '@/types/finance'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useGuardedClose } from '@/hooks/useGuardedClose'
import { useProcurementFieldConfig } from '@/hooks/useProcurementFieldConfig'
import { buildPrToPoPrefill, PO_FROM_PR_KEY, PO_FROM_INVENTORY_KEY, type PrToPoPrefill } from '@/lib/prToPoPrefill'
import { PO_COPY_FROM_ID_KEY } from '@/lib/copyDocument'
import { CopyFromDocumentField } from '@/components/procurement/CopyFromDocumentField'
import { extractApiError } from '@/lib/errorMessages'
import {
  type RequisitionType,
  REQUISITION_TYPES,
  DEFAULT_UOM,
  PRIORITIES,
  QTY_LABELS,
} from '@/components/procurement/procurementLineItemTypes'
import { toast } from 'sonner'
import { LineCollapsedGlimpse } from '@/components/procurement/LineCollapsedGlimpse'
import {
  buildProductMasterFacts,
  buildServiceMasterFacts,
  getMasterFactValue,
  PRODUCT_MASTER_SLOTS,
  SERVICE_MASTER_SLOTS,
} from '@/components/procurement/LineMasterFacts'
import {
  ArrowLeft, Loader2, Plus, X, Trash2,
  UserPlus, Building2, ExternalLink,
  FileText, Phone, Mail, MapPin, Hash,
  ChevronDown, ChevronRight,
} from 'lucide-react'

const PO_PENDING_SUPPLIER_KEY = 'po_pending_supplier'
const PO_BARCODE_PREFILL_KEY = 'po_barcode_prefill'

let _itemUid = 0
interface ItemRow {
  uid: number
  item_type: RequisitionType
  product_id: string
  variant_id: string
  quantity: string
  unit_cost: string
  item_note: string
  unit_of_measure: string
  item_category: string
  tax_code: string
  account_assignment: string
  account_assignment_value: string
  pr_item_id?: string
  cost_center_id: string
  priority: string
  needed_by_date: string
  service_period_from: string
  service_period_to: string
  asset_tag: string
}

function catalogLabelForType(type: RequisitionType): string {
  switch (type) {
    case 'service': return 'Service'
    case 'asset': return 'Asset / Material'
    case 'consumption': return 'Consumable'
    case 'other': return 'Item'
    default: return 'Product'
  }
}

function defaultsForPoType(type: RequisitionType): Pick<ItemRow, 'unit_of_measure' | 'item_category' | 'account_assignment'> {
  if (type === 'service') {
    return { unit_of_measure: DEFAULT_UOM.service, item_category: 'service', account_assignment: '' }
  }
  if (type === 'asset') {
    return { unit_of_measure: DEFAULT_UOM.asset, item_category: itemCategoryFromType(type), account_assignment: 'asset' }
  }
  if (type === 'consumption') {
    return { unit_of_measure: DEFAULT_UOM.consumption, item_category: itemCategoryFromType(type), account_assignment: '' }
  }
  if (type === 'other') {
    return { unit_of_measure: DEFAULT_UOM.other, item_category: itemCategoryFromType(type), account_assignment: '' }
  }
  return { unit_of_measure: DEFAULT_UOM.product, item_category: itemCategoryFromType(type), account_assignment: '' }
}

function usesProductCatalog(type: RequisitionType): boolean {
  return type !== 'service'
}

/** Map shared Item Type (same as PR) → PO item_category stored on the backend. */
function itemCategoryFromType(type: RequisitionType): string {
  return type === 'service' ? 'service' : 'standard'
}

const ACCT_ASSIGN_META: Record<string, { label: string; placeholder: string }> = {
  cost_center: { label: 'Cost Center', placeholder: 'e.g. CC-ADMIN-01' },
  project:     { label: 'Project / WBS Element', placeholder: 'e.g. PRJ-2024-001' },
  asset:       { label: 'Asset Number / Category', placeholder: 'e.g. AST-00123' },
  gl_account:  { label: 'GL Account', placeholder: 'e.g. 6100-0001' },
}

function buildPoItemNotes(item: ItemRow): string | undefined {
  const parts: string[] = []
  if (item.item_type === 'service' && (item.service_period_from || item.service_period_to)) {
    parts.push(`Service period: ${item.service_period_from || '—'} → ${item.service_period_to || '—'}`)
  }
  if (item.item_type === 'asset' && item.asset_tag.trim()) {
    parts.push(`Asset tag / serial: ${item.asset_tag.trim()}`)
  }
  if (item.priority && item.priority !== 'medium') {
    parts.push(`Priority: ${item.priority}`)
  }
  if (item.needed_by_date) {
    parts.push(`Required by: ${item.needed_by_date}`)
  }
  if (item.item_note.trim()) parts.push(item.item_note.trim())
  return parts.length ? parts.join('\n') : undefined
}

function supplierAddressLine(s?: Supplier | null): string | null {
  const a = s?.address
  if (!a) return null
  const parts = [a.street, a.city, a.state, a.postal_code].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

function supplierOptionHint(s: Supplier): string | undefined {
  const parts = [
    s.gstin ? `GSTIN ${s.gstin}` : null,
    s.address?.city || s.address?.state || null,
    s.phone || null,
  ].filter(Boolean) as string[]
  return parts.length ? parts.join(' · ') : undefined
}

function SupplierDetailsStrip({ supplier }: { supplier: Supplier }) {
  const address = supplierAddressLine(supplier)
  const bits: { icon: typeof Hash; label: string; value: string }[] = []
  if (supplier.gstin) bits.push({ icon: Hash, label: 'GSTIN', value: supplier.gstin })
  if (supplier.pan_number) bits.push({ icon: Hash, label: 'PAN', value: supplier.pan_number })
  if (supplier.contact_name) bits.push({ icon: UserPlus, label: 'Contact', value: supplier.contact_name })
  if (supplier.phone) bits.push({ icon: Phone, label: 'Phone', value: supplier.phone })
  if (supplier.email) bits.push({ icon: Mail, label: 'Email', value: supplier.email })
  if (address) bits.push({ icon: MapPin, label: 'Address', value: address })
  if (!bits.length && !supplier.company_name) return null
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50/80 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        <Building2 className="h-3 w-3" />
        {supplier.company_name || supplier.name}
        {supplier.company_name && supplier.company_name !== supplier.name && (
          <span className="font-normal normal-case tracking-normal text-gray-400">({supplier.name})</span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {bits.map(b => (
          <div key={b.label} className="flex min-w-0 items-start gap-1.5 text-xs text-gray-700 dark:text-gray-300">
            <b.icon className="mt-0.5 h-3 w-3 shrink-0 text-gray-400" />
            <span className="min-w-0">
              <span className="text-gray-400">{b.label}: </span>
              <span className="break-words font-medium">{b.value}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
interface CatalogItem {
  id: string; name: string; sku?: string; cost_price?: number; price?: number
  uom?: string; hsn_code?: string | null; barcode?: string | null
  material_code?: string | null; sac_code?: string | null
  gst_rate?: number | null; tax_rate?: number | null; is_taxable?: boolean
  type: 'product' | 'service'
  variants?: { id: string; name: string; sku?: string; barcode?: string; cost_price?: number; price?: number; uom?: string; hsn_code?: string | null }[]
}
interface BarcodePrefill {
  productId: string; variantId?: string; productName: string
  variantName?: string; unitCost?: number; prefillQty?: number
}
interface InventoryAlertPrefill { productId: string; variantId?: string; productName: string; quantity: number }

// ─── Fiori-style field label ───────────────────────────────────────────────────
function FL({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wide leading-none text-gray-400 dark:text-gray-500 select-none">
      {children}{required && <span className="ml-0.5 text-red-500">*</span>}
    </p>
  )
}

/** Keeps header field labels at a fixed height so inputs line up across the grid. */
function HeaderField({
  label,
  required,
  action,
  children,
  className,
}: {
  label: ReactNode
  required?: boolean
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <div className="flex h-4 items-center justify-between gap-2">
        <FL required={required}>{label}</FL>
        {action}
      </div>
      {children}
    </div>
  )
}

function LineField({
  label,
  required,
  children,
  className,
}: {
  label: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`min-w-0 ${className ?? ''}`}>
      <FL required={required}>{label}</FL>
      <div className="mt-1">{children}</div>
    </div>
  )
}

const lineSelectTrigger =
  'h-8 w-full min-w-0 text-xs border-gray-200 bg-white rounded-md shadow-none'
const lineInputCls =
  'h-8 w-full min-w-0 rounded-md border-gray-200 bg-white px-2 text-sm shadow-none focus:border-blue-400 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
const LINE_ROW_GRID =
  'grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6'
const dashedBoxCls =
  'flex h-8 items-center rounded-md border border-dashed border-gray-200 px-2 text-xs text-gray-400 dark:border-gray-700'
const readonlyBoxCls =
  'flex h-8 items-center rounded-md border border-gray-200 bg-gray-50 px-2.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-200'

// ─── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/80 px-5 py-2.5 dark:border-gray-700 dark:bg-gray-800/60">
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-0.5 rounded-full bg-blue-500" />
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-400">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

export default function CreatePurchaseOrderPage() {
  const navigate = useNavigate()
  const createMut = useCreatePurchaseOrder()
  const createSupplierMut = useCreateSupplier()
  const { data: suppliersData, refetch: refetchSuppliers } = useSuppliers({ is_active: true })
  const { data: productsData } = useProducts({ size: 500, status: 'active' })
  const { data: servicesData } = useServices({ size: 500, status: 'active' })
  const { data: requisitionsData } = useRequisitions({ size: 100 })
  const selectedStore = useVendorStore(s => s.selectedStore)
  const selectedBranch = useVendorStore(s => s.selectedBranch)
  const vendorGstin = useVendorStore(s => s.vendor?.gstin)

  const { getStatus } = useProcurementFieldConfig()
  const show   = useCallback((k: string) => getStatus('PO', k)    !== 'suppress', [getStatus])
  const req    = useCallback((k: string) => getStatus('PO', k)    === 'mandatory', [getStatus])
  const showWf = useCallback((k: string) => getStatus('WF_PO', k) !== 'suppress', [getStatus])

  // ── Prefill from sessionStorage ───────────────────────────────────────────────
  const [barcodePrefill, setBarcodePrefill] = useState<BarcodePrefill | undefined>()
  const [pendingSupplier, setPendingSupplier] = useState<{ id: string; name: string } | undefined>()
  const [prPrefill, setPrPrefill] = useState<PrToPoPrefill | undefined>()
  const [copiedFromNumber, setCopiedFromNumber] = useState<string | null>(null)
  const [copyLoading, setCopyLoading] = useState(false)

  useEffect(() => {
    try {
      const rawPr = sessionStorage.getItem(PO_FROM_PR_KEY)
      if (rawPr) { const p = JSON.parse(rawPr) as PrToPoPrefill; sessionStorage.removeItem(PO_FROM_PR_KEY); if (p?.requisitionId && p.items?.length) setPrPrefill(p) }
    } catch { /**/ }
    try {
      const rawInv = sessionStorage.getItem(PO_FROM_INVENTORY_KEY)
      if (rawInv) { const inv = JSON.parse(rawInv) as InventoryAlertPrefill; sessionStorage.removeItem(PO_FROM_INVENTORY_KEY); if (inv?.productId) setBarcodePrefill({ productId: inv.productId, variantId: inv.variantId, productName: inv.productName, prefillQty: inv.quantity }) }
    } catch { /**/ }
    try {
      const rawB = sessionStorage.getItem(PO_BARCODE_PREFILL_KEY)
      if (rawB) { const p = JSON.parse(rawB) as BarcodePrefill; sessionStorage.removeItem(PO_BARCODE_PREFILL_KEY); if (p?.productId) setBarcodePrefill(p) }
    } catch { /**/ }
    try {
      const rawS = sessionStorage.getItem(PO_PENDING_SUPPLIER_KEY)
      if (rawS) { const p = JSON.parse(rawS); sessionStorage.removeItem(PO_PENDING_SUPPLIER_KEY); if (p?.id) setPendingSupplier(p) }
    } catch { /**/ }
  }, [])

  const emptyItem = (): ItemRow => ({
    uid: ++_itemUid,
    item_type: 'product',
    product_id: '',
    variant_id: '',
    quantity: '',
    unit_cost: '',
    item_note: '',
    unit_of_measure: DEFAULT_UOM.product,
    item_category: 'standard',
    tax_code: '',
    account_assignment: '',
    account_assignment_value: '',
    cost_center_id: '',
    priority: 'medium',
    needed_by_date: '',
    service_period_from: '',
    service_period_to: '',
    asset_tag: '',
  })
  const [linkedRequisitionId, setLinkedRequisitionId] = useState('')
  const [linkedPrNumber, setLinkedPrNumber] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [primaryApproverId, setPrimaryApproverId] = useState('')
  const [secondaryApproverId, setSecondaryApproverId] = useState('')
  const [approverMessage, setApproverMessage] = useState('')
  const [dest, setDest] = useState<PoDestinationValue>(() => ({
    ...emptyPoDestination(selectedStore?.id || ''),
    scope: selectedBranch?.id ? { kind: 'branch', id: selectedBranch.id } : { kind: '' },
  }))
  const [showQuickSupplier, setShowQuickSupplier] = useState(false)
  const [qsName, setQsName] = useState(''); const [qsPhone, setQsPhone] = useState(''); const [qsEmail, setQsEmail] = useState('')
  const [productDetails, setProductDetails] = useState<Record<string, CatalogItem>>({})
  const [items, setItems] = useState<ItemRow[]>([emptyItem()])
  const [collapsedLineUids, setCollapsedLineUids] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    if (prPrefill?.items?.length) {
      setLinkedRequisitionId(prPrefill.requisitionId || ''); setLinkedPrNumber(prPrefill.prNumber || '')
      if (prPrefill.supplierId) setSupplierId(prPrefill.supplierId)
      if (prPrefill.expectedDate) setExpectedDate(prPrefill.expectedDate)
      if (prPrefill.notes) setNotes(prPrefill.notes)
      setItems(prPrefill.items.map(i => ({
        ...emptyItem(),
        item_type: i.isService ? 'service' : 'product',
        product_id: i.productId,
        variant_id: i.variantId || '',
        quantity: String(Math.max(1, Math.round(i.quantity))),
        unit_cost: String(i.unitCost ?? 0),
        item_note: i.note || '',
        pr_item_id: i.prItemId,
        needed_by_date: i.neededByDate || '',
      })))
      const first = prPrefill.items[0]
      setDest(poDestinationFromLine({ plant_id: first?.plantId, storage_location_id: first?.storageLocationId }, prPrefill.storeId || selectedStore?.id || ''))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prPrefill])
  useEffect(() => { if (barcodePrefill) setItems([{ ...emptyItem(), product_id: barcodePrefill.productId, variant_id: barcodePrefill.variantId || '', quantity: barcodePrefill.prefillQty != null ? String(barcodePrefill.prefillQty) : '1', unit_cost: barcodePrefill.unitCost != null ? String(barcodePrefill.unitCost) : '' }]) }, [barcodePrefill]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (pendingSupplier?.id) setSupplierId(pendingSupplier.id) }, [pendingSupplier?.id])
  useEffect(() => { if (selectedStore?.id && !dest.storeId) setDest(p => ({ ...p, storeId: selectedStore.id })) }, [selectedStore?.id, dest.storeId])
  useEffect(() => { if (selectedBranch?.id && !dest.scope.kind) setDest(p => ({ ...p, scope: { kind: 'branch', id: selectedBranch.id } })) }, [selectedBranch?.id, dest.scope.kind])

  const convertiblePrs = (requisitionsData?.items ?? []).filter((r: any) => ['open', 'approved', 'partially_converted'].includes(r.status)) as PurchaseRequisition[]

  const products: CatalogItem[] = (productsData?.items || []).map((p: Product) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    cost_price: resolveProductPurchasePrice(p) ?? undefined,
    price: p.price,
    uom: p.uom,
    hsn_code: p.hsn_code,
    barcode: p.barcode,
    material_code: (p as { material_code?: string }).material_code,
    gst_rate: p.gst_rate ?? p.tax_rate,
    is_taxable: p.is_taxable,
    type: 'product' as const,
  }))
  const services: CatalogItem[] = (servicesData?.items || []).map((s: Service) => ({
    id: s.id,
    name: s.name,
    cost_price: resolveServicePurchasePrice(s) ?? undefined,
    price: s.price,
    uom: s.uom,
    sac_code: s.sac_code,
    material_code: s.material_code,
    gst_rate: s.gst_rate ?? s.tax_rate,
    is_taxable: s.is_taxable,
    type: 'service' as const,
  }))
  const catalogMap = new Map([...products, ...services].map(c => [c.id, c]))

  const fetchProductDetails = useCallback(async (productId: string) => {
    if (!productId || productDetails[productId]) return
    try {
      const full = await vendorApi.getProduct(productId)
      setProductDetails(prev => ({
        ...prev,
        [productId]: {
          ...prev[productId],
          id: productId,
          name: full.name,
          uom: full.uom,
          cost_price: full.cost_price,
          price: full.price,
          hsn_code: (full as any).hsn_code ?? null,
          barcode: (full as any).barcode ?? null,
          material_code: (full as any).material_code ?? null,
          sku: full.sku,
          gst_rate: (full as any).gst_rate ?? full.tax_rate ?? null,
          is_taxable: full.is_taxable,
          type: 'product' as const,
          variants: (full.variants || []).map((v: any) => ({
            id: v.id, name: v.name, sku: v.sku, barcode: v.barcode,
            cost_price: v.cost_price, price: v.price, uom: v.uom,
            hsn_code: v.hsn_code ?? null,
          })),
        },
      }))
    } catch { /**/ }
  }, [productDetails])

  useEffect(() => {
    if (barcodePrefill?.productId) fetchProductDetails(barcodePrefill.productId)
    for (const item of items) {
      if (item.product_id && usesProductCatalog(item.item_type)) fetchProductDetails(item.product_id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcodePrefill?.productId, items])

  // Backfill UoM + category + unit cost from product/service master when catalog arrives (PR/barcode prefills, late list load)
  useEffect(() => {
    if (!catalogMap.size) return
    setItems(prev => {
      let changed = false
      const next = prev.map(row => {
        if (!row.product_id) return row
        const c = catalogMap.get(row.product_id)
        let nextRow = row

        if (!row.unit_of_measure) {
          const fromVariant = row.variant_id
            ? productDetails[row.product_id]?.variants?.find(v => v.id === row.variant_id)?.uom
            : undefined
          const fromMaster = fromVariant || c?.uom || productDetails[row.product_id]?.uom
          const uom = normalizeUom(fromMaster || '')
          if (uom) {
            nextRow = { ...nextRow, unit_of_measure: uom }
            changed = true
          }
        }

        if (!row.item_category && c?.type) {
          nextRow = { ...nextRow, item_category: c.type === 'service' ? 'service' : 'standard' }
          changed = true
        }

        if (c?.type === 'service' && row.item_type !== 'service') {
          nextRow = { ...nextRow, item_type: 'service', item_category: nextRow.item_category || 'service' }
          changed = true
        } else if (c?.type === 'product' && row.item_type === 'service') {
          nextRow = { ...nextRow, item_type: 'product', item_category: nextRow.item_category === 'service' ? 'standard' : nextRow.item_category }
          changed = true
        }

        const keepCost = Boolean(row.pr_item_id) && parseFloat(row.unit_cost) > 0
        if (!keepCost && !String(row.unit_cost ?? '').trim()) {
          const detail = productDetails[row.product_id]
          const masterPrice = c?.type === 'service'
            ? (c.cost_price ?? null)
            : resolveCatalogPurchasePrice(
                detail
                  ? { cost_price: detail.cost_price, price: detail.price, variants: detail.variants }
                  : c,
                row.variant_id || undefined,
              )
          if (masterPrice != null) {
            nextRow = { ...nextRow, unit_cost: priceToInput(masterPrice) }
            changed = true
          }
        }

        return nextRow
      })
      return changed ? next : prev
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productsData, servicesData, productDetails])

  const addItem = () => setItems(prev => [...prev, emptyItem()])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const updateItem = (idx: number, field: keyof ItemRow, value: string) => {
    setItems(prev => {
      const updated = [...prev]; const cur = updated[idx]; updated[idx] = { ...cur, [field]: value }
      if (field === 'item_type' && value !== cur.item_type) {
        const type = value as RequisitionType
        const defaults = defaultsForPoType(type)
        updated[idx] = {
          ...updated[idx],
          item_type: type,
          product_id: '',
          variant_id: '',
          unit_cost: '',
          tax_code: '',
          account_assignment_value: '',
          service_period_from: '',
          service_period_to: '',
          asset_tag: '',
          ...defaults,
        }
      }
      if (field === 'product_id' && value !== cur.product_id) {
        // Reset line-specific fields; seed UoM + category from product/service master
        const c = catalogMap.get(value)
        const masterUom = normalizeUom(c?.uom || '') || ''
        const masterCategory = c?.type === 'service' ? 'service' : value ? 'standard' : ''
        const inferredType: RequisitionType =
          c?.type === 'service' ? 'service' : (cur.item_type === 'service' ? 'product' : cur.item_type)
        updated[idx] = {
          ...updated[idx],
          item_type: inferredType,
          variant_id: '',
          unit_of_measure: masterUom || defaultsForPoType(inferredType).unit_of_measure,
          item_category: masterCategory || defaultsForPoType(inferredType).item_category,
          tax_code: '',
          account_assignment: inferredType === 'asset' ? (cur.account_assignment || 'asset') : (inferredType === 'service' ? '' : cur.account_assignment),
          account_assignment_value: inferredType === 'asset' ? cur.account_assignment_value : '',
        }
        const keepCost = Boolean(cur.pr_item_id) && parseFloat(cur.unit_cost) > 0
        if (!keepCost) {
          const masterPrice = c?.type === 'service'
            ? (c.cost_price ?? null)
            : resolveProductPurchasePrice(c)
          if (masterPrice != null) {
            updated[idx].unit_cost = priceToInput(masterPrice)
          } else {
            updated[idx].unit_cost = ''
          }
        }
        if (value && usesProductCatalog(inferredType)) fetchProductDetails(value)
      }
      if (field === 'variant_id' && value !== cur.variant_id) {
        const detail = productDetails[updated[idx].product_id]
        const v = detail?.variants?.find(vr => vr.id === value)
        // Prefer variant UoM when present; otherwise keep product-level UoM
        if (v?.uom) updated[idx].unit_of_measure = normalizeUom(v.uom) || updated[idx].unit_of_measure
        const keepCost = Boolean(cur.pr_item_id) && parseFloat(cur.unit_cost) > 0
        if (!keepCost) {
          const masterPrice = resolveCatalogPurchasePrice(detail, value || undefined)
          if (masterPrice != null) {
            updated[idx].unit_cost = priceToInput(masterPrice)
          }
        }
      }
      if (field === 'account_assignment') {
        // Clear the value field whenever the category changes
        updated[idx].account_assignment_value = ''
      }
      if (field === 'cost_center_id' && value && !updated[idx].account_assignment) {
        updated[idx].account_assignment = 'cost_center'
      }
      return updated
    })
  }

  const applyRequisition = useCallback((pr: PurchaseRequisition) => {
    const prefill = buildPrToPoPrefill(pr); if (!prefill) { toast.error('No convertible product/service lines on this requisition'); return }
    setLinkedRequisitionId(prefill.requisitionId); setLinkedPrNumber(prefill.prNumber)
    if (prefill.supplierId) setSupplierId(prefill.supplierId); if (prefill.expectedDate) setExpectedDate(prefill.expectedDate); if (prefill.notes) setNotes(prefill.notes)
    setItems(prefill.items.map(i => ({
      ...emptyItem(),
      item_type: i.isService ? 'service' : 'product',
      product_id: i.productId,
      variant_id: i.variantId || '',
      quantity: String(Math.max(1, Math.round(i.quantity))),
      unit_cost: String(i.unitCost ?? 0),
      item_note: i.note || '',
      pr_item_id: i.prItemId,
      needed_by_date: i.neededByDate || '',
    })))
    const first = prefill.items[0]; setDest(poDestinationFromLine({ plant_id: first?.plantId, storage_location_id: first?.storageLocationId }, prefill.storeId || selectedStore?.id || ''))
    toast.success(`Loaded lines from ${prefill.prNumber}`)
  }, [selectedStore?.id])

  const applyCopiedPo = useCallback((po: PurchaseOrder) => {
    setSupplierId(po.supplier_id || '')
    if (po.expected_delivery_date) setExpectedDate(String(po.expected_delivery_date).slice(0, 10))
    if (po.notes) setNotes(po.notes)
    if (po.currency) setCurrency(po.currency)
    if (po.payment_terms) setPaymentTerms(po.payment_terms || '')
    setLinkedRequisitionId('')
    setLinkedPrNumber('')
    const lines = (po.items ?? []).map(item => {
      const isService = Boolean(item.service_id) || item.item_category === 'service'
      return {
        ...emptyItem(),
        item_type: (isService ? 'service' : 'product') as RequisitionType,
        product_id: (isService ? item.service_id : item.product_id) || '',
        variant_id: item.variant_id || '',
        quantity: String(item.quantity_ordered ?? item.quantity ?? ''),
        unit_cost: String(item.unit_cost ?? ''),
        item_note: item.notes || item.description || '',
        unit_of_measure: item.unit_of_measure || DEFAULT_UOM.product,
        item_category: item.item_category || (isService ? 'service' : 'standard'),
        tax_code: item.tax_code || '',
        account_assignment: item.account_assignment || '',
        account_assignment_value: item.account_assignment_value || '',
      }
    })
    setItems(lines.length ? lines : [emptyItem()])
    const first = po.items?.[0]
    setDest(poDestinationFromLine(
      { plant_id: first?.plant_id || po.plant_id, storage_location_id: first?.storage_location_id },
      selectedStore?.id || '',
    ))
    setCopiedFromNumber(po.po_number)
    toast.success(`Copied from ${po.po_number}. A new PO number is assigned when you save.`)
  }, [selectedStore?.id])

  const handleCopyFromNumber = async (number: string) => {
    setCopyLoading(true)
    try {
      const po = await vendorApi.lookupPurchaseOrder(number)
      applyCopiedPo(po)
    } catch (err) {
      toast.error(extractApiError(err, 'No purchase order found with that number'))
    } finally {
      setCopyLoading(false)
    }
  }

  useEffect(() => {
    const id = sessionStorage.getItem(PO_COPY_FROM_ID_KEY)
    if (!id) return
    sessionStorage.removeItem(PO_COPY_FROM_ID_KEY)
    vendorApi.getPurchaseOrder(id)
      .then(applyCopiedPo)
      .catch(() => toast.error('Could not copy that purchase order'))
  }, [applyCopiedPo])

  const handleRequisitionChange = async (prId: string) => {
    if (!prId) { setLinkedRequisitionId(''); setLinkedPrNumber(''); setItems(prev => prev.map(({ pr_item_id: _, ...r }) => ({ ...r }))); return }
    const listed = convertiblePrs.find(r => r.id === prId)
    try { const full = await vendorApi.getRequisition(prId) as PurchaseRequisition; applyRequisition(full?.id ? full : (listed as PurchaseRequisition)) }
    catch { if (listed) applyRequisition(listed); else toast.error('Could not load requisition details') }
  }

  const handleQuickCreateSupplier = async () => {
    if (!qsName.trim()) return
    const existing = findExistingSupplier(dedupeSuppliers(suppliersData?.items ?? []), { name: qsName, phone: qsPhone || undefined, email: qsEmail || undefined })
    if (existing) { setSupplierId(existing.id); setShowQuickSupplier(false); setQsName(''); setQsPhone(''); setQsEmail(''); toast.info(`"${existing.name}" already exists — selected`); return }
    try {
      const created: any = await createSupplierMut.mutateAsync({ name: qsName.trim(), phone: qsPhone || undefined, email: qsEmail || undefined })
      await refetchSuppliers(); setSupplierId(created.id); setShowQuickSupplier(false); setQsName(''); setQsPhone(''); setQsEmail('')
    } catch { /**/ }
  }

  const { data: taxCodesData, error: taxCodesError } = useTaxCodes()
  const { data: costCenters = [], isLoading: costCentersLoading } = useCostCenters()
  const activeCostCenters = useMemo(
    () => (costCenters as CostCenter[]).filter(cc => cc.is_active !== false),
    [costCenters],
  )
  const taxCodeMap = useMemo(() => buildTaxCodeMap(taxCodesData as TaxCode[] | undefined), [taxCodesData])
  const activeTaxCodes = useMemo(
    () => ((taxCodesData as TaxCode[] | undefined) ?? []).filter(c => c.is_active !== false),
    [taxCodesData],
  )
  const taxCodesUnavailable = !!taxCodesError

  // Determine intra/inter-state for GST split preview (mirrors backend _split_line_tax logic)
  const suppliers = useMemo(
    () => dedupeSuppliers(suppliersData?.items ?? []) as Supplier[],
    [suppliersData],
  )
  const selectedSupplier = useMemo(
    () => (supplierId ? suppliers.find(s => s.id === supplierId) ?? null : null),
    [supplierId, suppliers],
  )
  const selectedSupplierGstin = selectedSupplier?.gstin
  const intraState = useMemo(
    () => isIntraState(selectedSupplierGstin, vendorGstin),
    [selectedSupplierGstin, vendorGstin],
  )
  const supplierOptions = useMemo(
    () => selectOptionsWithBlank(
      'Select supplier...',
      suppliers.map(s => ({
        value: s.id,
        label: s.name,
        hint: supplierOptionHint(s),
      })),
    ),
    [suppliers],
  )

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_cost) || 0), 0)
  const taxTotal = items.reduce((s, i) => {
    const lineTotal = (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_cost) || 0)
    return s + resolveLineTax(lineTotal, i.tax_code, taxCodeMap, intraState).amount
  }, 0)
  const grandTotal = subtotal + taxTotal

  const canSubmit = Boolean(
    supplierId && items.every(i => {
      const pd = productDetails[i.product_id]
      const isProduct = usesProductCatalog(i.item_type) && catalogMap.get(i.product_id)?.type !== 'service'
      const hasVariants = isProduct && (pd?.variants?.length ?? 0) > 0
      return (
        i.product_id && parseInt(i.quantity) > 0 && parseFloat(i.unit_cost) >= 0 &&
        (!hasVariants || !!i.variant_id) &&
        (!req('unit') || !!i.unit_of_measure) && (!req('item_category') || !!i.item_category) &&
        (!req('tax_code') || !!i.tax_code) && (!req('item_text') || !!i.item_note?.trim()) &&
        (!req('account_assignment_category') || !i.account_assignment || !ACCT_ASSIGN_META[i.account_assignment] || !!i.account_assignment_value?.trim()) &&
        (!req('account_assignment_category') || !!i.account_assignment)
      )
    }) &&
    (!req('delivery_date') || !!expectedDate) && (!req('header_text') || !!notes.trim()) &&
    (!req('currency') || !!currency) && (!req('payment_terms') || !!paymentTerms.trim()),
  )

  const isDirty = !!(supplierId || notes.trim() || expectedDate || paymentTerms.trim() || primaryApproverId || approverMessage.trim() || items.some(i => i.product_id || i.item_note?.trim() || i.item_type !== 'product'))

  const goBack = useCallback(() => navigate('/purchase-orders'), [navigate])
  const { handleClose, confirmOpen, cancelConfirm, forceClose } = useGuardedClose(goBack, isDirty, false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault(); if (!canSubmit) return
    try {
      const prItemIds = items.map(i => i.pr_item_id).filter(Boolean) as string[]
      const approvers = primaryApproverId ? [{ approver_id: primaryApproverId, level: 1 }, ...(secondaryApproverId ? [{ approver_id: secondaryApproverId, level: 2 }] : [])] : []
      const destPayload = poDestinationToPayload(dest)
      const headerDest = poDestinationToHeaderPayload(dest)
      const po = await createMut.mutateAsync({
        supplier_id: supplierId,
        items: items.map(i => {
          const pd = productDetails[i.product_id]
          const variant = i.variant_id ? pd?.variants?.find(v => v.id === i.variant_id) : null
          const hsn_code = variant?.hsn_code || pd?.hsn_code || undefined
          const isService = i.item_type === 'service' || catalogMap.get(i.product_id)?.type === 'service'
          const cc = activeCostCenters.find(c => c.id === i.cost_center_id)
          const acct = i.account_assignment || (i.cost_center_id ? 'cost_center' : '')
          const acctValue = acct === 'cost_center'
            ? (i.account_assignment_value.trim() || (cc ? cc.code : '') || undefined)
            : (i.account_assignment_value.trim() || undefined)
          const packedNotes = buildPoItemNotes(i)
          return {
            product_id: isService ? undefined : i.product_id,
            service_id: isService ? i.product_id : undefined,
            variant_id: isService ? undefined : (i.variant_id || undefined),
            quantity: parseInt(i.quantity),
            unit_cost: parseFloat(i.unit_cost),
            description: packedNotes,
            notes: packedNotes,
            unit_of_measure: show('unit') ? (i.unit_of_measure || undefined) : undefined,
            item_category: show('item_category')
              ? (i.item_category || itemCategoryFromType(i.item_type) || undefined)
              : itemCategoryFromType(i.item_type),
            tax_code: show('tax_code') ? (i.tax_code || undefined) : undefined,
            hsn_code: hsn_code || undefined,
            account_assignment: show('account_assignment_category') ? (acct || undefined) : (acct || undefined),
            account_assignment_value: acctValue,
            plant_id: show('plant') ? destPayload.plant_id : undefined,
            storage_location_id: show('storage_location') ? destPayload.storage_location_id : undefined,
          }
        }),
        expected_delivery_date: show('delivery_date')
          ? (expectedDate || items.map(i => i.needed_by_date).filter(Boolean).sort()[0] || undefined)
          : undefined,
        notes: show('header_text') ? (notes || undefined) : undefined,
        currency: show('currency') ? (currency || undefined) : undefined,
        payment_terms: show('payment_terms') ? (paymentTerms.trim() || undefined) : undefined,
        requisition_id: linkedRequisitionId || prPrefill?.requisitionId || undefined,
        pr_item_ids: prItemIds.length ? prItemIds : undefined,
        approvers, approver_message: approverMessage.trim() || undefined,
        // Header org dimensions drive approver-matrix routing, so the branch is
        // sent even when the picker is hidden — it comes from the user's context.
        branch_id: headerDest.branch_id,
        plant_id: show('plant') ? headerDest.plant_id : undefined,
      })
      navigate(`/purchase-orders/${po.id}`)
    } catch { /**/ }
  }, [canSubmit, supplierId, items, expectedDate, notes, currency, paymentTerms, dest, createMut, navigate, linkedRequisitionId, prPrefill?.requisitionId, primaryApproverId, secondaryApproverId, approverMessage, show, activeCostCenters, catalogMap, productDetails])

  const showDestination = show('business_unit') || show('plant') || show('storage_location')

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-[#f5f6f7] dark:bg-gray-950">

      {/* ── Fiori-style top action bar ─────────────────────────────────── */}
      <div className="sticky top-0 z-20 flex items-center gap-4 border-b border-gray-200 bg-white px-5 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Back"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-800 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>

        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
            {linkedRequisitionId || prPrefill ? 'Create PO from Requisition' : copiedFromNumber ? `Copy of ${copiedFromNumber}` : 'New Purchase Order'}
          </h1>
          <p className="text-[11px] text-gray-400">
            {linkedPrNumber || prPrefill?.prNumber
              ? `From ${linkedPrNumber || prPrefill?.prNumber}`
              : copiedFromNumber
                ? `Copied from ${copiedFromNumber} — a new PO number is assigned on save`
                : 'Fill in the details below and save as a draft PO'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleClose} className="h-8 rounded-full border-gray-300 px-4 text-xs font-medium text-gray-600">
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-po-form"
            size="sm"
            disabled={createMut.isPending || !canSubmit}
            className="h-8 rounded-full px-5 text-xs font-semibold"
          >
            {createMut.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
            Create Draft PO
          </Button>
        </div>
      </div>

      {/* ── Scrollable form ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-5 py-5 md:px-8 lg:px-10">
        <form id="create-po-form" onSubmit={handleSubmit}>
          <div className="mx-auto max-w-6xl space-y-4">

            {/* ══ ORDER DETAILS ══════════════════════════════════════════════ */}
            <Section title="Order Details">
              <div className="p-5 space-y-4">
                <CopyFromDocumentField
                  placeholder="Enter PO number, e.g. PO/2025-26/0042"
                  onCopy={handleCopyFromNumber}
                  loading={copyLoading}
                  copiedFrom={copiedFromNumber}
                />
                {/* Row 1: PR Ref | Supplier | Expected Delivery | Currency */}
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                  <HeaderField
                    label="Purchase Requisition"
                    action={
                      linkedRequisitionId ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/procurement/requisitions?pr=${linkedRequisitionId}`)}
                          className="flex items-center gap-0.5 text-[10px] font-medium text-indigo-600 hover:text-indigo-700"
                          title={linkedPrNumber ? `Open ${linkedPrNumber}` : 'Open purchase requisition'}
                        >
                          <ExternalLink className="h-2.5 w-2.5" /> Open
                        </button>
                      ) : undefined
                    }
                  >
                    <Select
                      value={linkedRequisitionId}
                      onChange={handleRequisitionChange}
                      options={selectOptionsWithBlank('No PR reference', [
                        ...(linkedRequisitionId && !convertiblePrs.some(r => r.id === linkedRequisitionId)
                          ? [{ value: linkedRequisitionId, label: linkedPrNumber || linkedRequisitionId }] : []),
                        ...convertiblePrs.map(r => ({ value: r.id, label: `${r.pr_number}${r.title ? ` — ${r.title}` : ''}` })),
                      ])}
                      aria-label="Purchase Requisition"
                      className="w-full"
                      triggerClassName="h-8 w-full text-sm rounded-md border-gray-200"
                    />
                  </HeaderField>

                  <HeaderField
                    label="Supplier"
                    required={req('supplier')}
                    action={
                      <button type="button" onClick={() => setShowQuickSupplier(v => !v)} className="flex items-center gap-0.5 text-[10px] font-medium text-blue-600 hover:text-blue-700">
                        <UserPlus className="h-2.5 w-2.5" /> Add
                      </button>
                    }
                  >
                    <Select
                      value={supplierId}
                      onChange={setSupplierId}
                      options={supplierOptions}
                      aria-label="Supplier"
                      className="w-full"
                      triggerClassName="h-8 w-full text-sm rounded-md border-gray-200"
                      showSelectedHint={false}
                    />
                  </HeaderField>

                  {show('delivery_date') && (
                    <HeaderField label="Expected Delivery" required={req('delivery_date')}>
                      <Input type="date" className="h-8 w-full rounded-md border-gray-200 text-sm" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} required={req('delivery_date')} />
                    </HeaderField>
                  )}

                  {show('currency') && (
                    <HeaderField label="Currency" required={req('currency')}>
                      <Select
                        value={currency} onChange={setCurrency}
                        options={[
                          { value: 'INR', label: 'INR — Indian Rupee' }, { value: 'USD', label: 'USD — US Dollar' },
                          { value: 'EUR', label: 'EUR — Euro' },         { value: 'GBP', label: 'GBP — British Pound' },
                          { value: 'AED', label: 'AED — UAE Dirham' },   { value: 'SGD', label: 'SGD — Singapore Dollar' },
                        ]}
                        aria-label="Currency" className="w-full" triggerClassName="h-8 w-full text-sm rounded-md border-gray-200"
                      />
                    </HeaderField>
                  )}
                </div>

                {selectedSupplier && <SupplierDetailsStrip supplier={selectedSupplier} />}

                {supplierId && (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {intraState ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        ✓ Intra-state · CGST + SGST
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        ⇄ Inter-state · IGST
                      </span>
                    )}
                    {!selectedSupplierGstin && (
                      <span className="text-[11px] text-gray-400">(supplier GSTIN missing — defaulting to inter-state)</span>
                    )}
                    {selectedSupplierGstin && !vendorGstin && (
                      <span className="text-[11px] text-gray-400">(your GSTIN missing — defaulting to inter-state)</span>
                    )}
                  </div>
                )}

                {/* Row 2: Payment Terms | Notes — Notes fills the remaining columns */}
                {(show('payment_terms') || show('header_text')) && (
                  <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                    {show('payment_terms') && (
                      <HeaderField label="Payment Terms" required={req('payment_terms')}>
                        <Input className="h-8 w-full rounded-md border-gray-200 text-sm" placeholder="e.g. Net 30" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} />
                      </HeaderField>
                    )}
                    {show('header_text') && (
                      <HeaderField
                        label="Notes / Remarks"
                        required={req('header_text')}
                        className={show('payment_terms') ? 'sm:col-span-1 lg:col-span-3' : 'sm:col-span-2 lg:col-span-4'}
                      >
                        <Input className="h-8 w-full rounded-md border-gray-200 text-sm" placeholder="Internal notes…" value={notes} onChange={e => setNotes(e.target.value)} required={req('header_text')} />
                      </HeaderField>
                    )}
                  </div>
                )}

                {/* Quick-create supplier panel */}
                {showQuickSupplier && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
                        <Building2 className="h-3.5 w-3.5" /> Quick Add Supplier
                      </p>
                      <button type="button" onClick={() => setShowQuickSupplier(false)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <Input className="h-8 rounded-md border-gray-200 text-sm bg-white" placeholder="Supplier name *" value={qsName} onChange={e => setQsName(e.target.value)} />
                      <PhoneInput value={qsPhone} onChange={setQsPhone} defaultCountryIso="IN" />
                      <Input className="h-8 rounded-md border-gray-200 text-sm bg-white" placeholder="Email (optional)" value={qsEmail} onChange={e => setQsEmail(e.target.value)} />
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <button type="button" onClick={() => navigate('/master-data/new?returnTo=purchase-orders/new&kind=supplier')} className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline">
                        <ExternalLink className="w-3 h-3" /> Full supplier form
                      </button>
                      <Button type="button" size="sm" className="h-7 rounded-full px-4 text-xs" disabled={!qsName.trim() || createSupplierMut.isPending} onClick={handleQuickCreateSupplier}>
                        {createSupplierMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
                        Create & Select
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Section>

            {/* ══ DESTINATION ════════════════════════════════════════════════ */}
            {showDestination && (
              <Section title="Destination / Plant">
                <div className="p-5">
                  <PoDestinationFields
                    value={dest} onChange={setDest}
                    showBusinessUnit={show('business_unit')}
                    showBranchPlant={show('plant')}
                    showStorageLocation={show('storage_location')}
                  />
                </div>
              </Section>
            )}

            {/* ══ LINE ITEMS ═════════════════════════════════════════════════ */}
            <Section
              title={`Line Items${req('material') || req('quantity') || req('net_price') ? ' *' : ''}`}
              action={
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-6 gap-1 rounded-full border-blue-200 px-3 text-[11px] text-blue-600 hover:bg-blue-50">
                  <Plus className="h-3 w-3" /> Add Item
                </Button>
              }
            >
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((item, idx) => {
                  const pd = productDetails[item.product_id]
                  const variants = pd?.variants || []
                  const isProduct = usesProductCatalog(item.item_type) && catalogMap.get(item.product_id)?.type !== 'service'
                  const hasVariants = isProduct && variants.length > 0
                  const loadingVariants = isProduct && !!item.product_id && !pd
                  const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0)
                  const lineTax = resolveLineTax(lineTotal, item.tax_code, taxCodeMap, intraState)
                  const showAcct = show('account_assignment_category')
                  const showNote = show('item_text')
                  const catalogOptions = item.item_type === 'service'
                    ? services.map(s => ({ value: s.id, label: s.name, group: 'Services' }))
                    : products.map(p => ({ value: p.id, label: p.name, hint: p.sku || undefined, group: 'Products' }))
                  const lineExpanded = !collapsedLineUids.has(item.uid)
                  const toggleLine = () => setCollapsedLineUids(prev => {
                    const next = new Set(prev)
                    if (next.has(item.uid)) next.delete(item.uid)
                    else next.add(item.uid)
                    return next
                  })
                  const typeLabel = REQUISITION_TYPES.find(t => t.value === item.item_type)?.label ?? item.item_type
                  const summaryLabel = catalogMap.get(item.product_id)?.name
                    || (item.item_note.trim() ? item.item_note.trim() : null)
                    || (item.product_id ? 'Item selected' : 'No item selected')
                  const variantName = item.variant_id
                    ? (pd?.variants?.find(v => v.id === item.variant_id)?.name || null)
                    : null
                  const unitPrice = parseFloat(item.unit_cost) > 0 ? parseFloat(item.unit_cost) : null
                  const catalog = catalogMap.get(item.product_id)
                  const selectedVariant = item.variant_id
                    ? pd?.variants?.find(v => v.id === item.variant_id)
                    : undefined
                  const masterFacts = catalog?.type === 'service' || item.item_type === 'service'
                    ? buildServiceMasterFacts(catalog)
                    : buildProductMasterFacts({
                        hsn_code: selectedVariant?.hsn_code || pd?.hsn_code || catalog?.hsn_code,
                        barcode: selectedVariant?.barcode || pd?.barcode || catalog?.barcode,
                        sku: selectedVariant?.sku || pd?.sku || catalog?.sku,
                        material_code: pd?.material_code || catalog?.material_code,
                        gst_rate: pd?.gst_rate ?? catalog?.gst_rate,
                        is_taxable: pd?.is_taxable ?? catalog?.is_taxable,
                      })
                  const lineToggle = (
                    <button
                      type="button"
                      onClick={toggleLine}
                      aria-expanded={lineExpanded}
                      aria-label={lineExpanded ? `Collapse line ${idx + 1}` : `Expand line ${idx + 1}`}
                      title={lineExpanded ? 'Collapse line' : 'Expand line'}
                      className="flex items-center gap-0.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      {lineExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                        : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        {idx + 1}
                      </span>
                    </button>
                  )

                  if (!lineExpanded) {
                    return (
                      <div key={item.uid} className="flex items-center gap-2 px-3 py-2 sm:px-4">
                        {lineToggle}
                        <button
                          type="button"
                          onClick={toggleLine}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-80"
                        >
                          <LineCollapsedGlimpse
                            typeLabel={typeLabel}
                            title={summaryLabel}
                            quantity={item.quantity}
                            uom={item.unit_of_measure}
                            unitPrice={unitPrice}
                            currency={currency}
                            taxCode={item.tax_code}
                            taxAmount={lineTax.amount}
                            variantName={variantName}
                            masterFacts={masterFacts}
                            extras={[
                              item.item_category && item.item_category !== 'standard' ? item.item_category : null,
                              item.account_assignment || null,
                            ]}
                          />
                        </button>
                        <div
                          className="min-w-[9.5rem] w-[9.5rem] shrink-0 rounded-md border border-blue-100 bg-blue-50/70 px-2 py-1.5 text-right dark:border-blue-900/40 dark:bg-blue-950/20 sm:min-w-[10.5rem] sm:w-[10.5rem]"
                          title={`${formatCurrency(lineTotal, currency)}${lineTax.amount > 0 ? ` (+${formatCurrency(lineTax.amount, currency)} tax)` : ''}`}
                        >
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-blue-500/80 leading-none">Total</p>
                          <p className="mt-0.5 text-xs font-semibold tabular-nums leading-snug text-blue-800 dark:text-blue-200">
                            {formatCurrency(lineTotal, currency)}
                          </p>
                          {lineTax.amount > 0 && (
                            <p className="text-[10px] tabular-nums leading-snug text-blue-600/70 dark:text-blue-300/70">
                              +{formatCurrency(lineTax.amount, currency)} tax
                            </p>
                          )}
                        </div>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            aria-label="Remove line"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                          </button>
                        )}
                      </div>
                    )
                  }

                  return (
                    <div key={item.uid} className="flex items-start gap-2 px-3 py-3 sm:px-4">
                      <div className="shrink-0 pt-5">{lineToggle}</div>

                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        {/* Row 1 */}
                        <div className={LINE_ROW_GRID}>
                          <LineField label="Item Type">
                            <Select
                              value={item.item_type}
                              onChange={v => updateItem(idx, 'item_type', v)}
                              options={REQUISITION_TYPES}
                              aria-label="Item type"
                              className="w-full min-w-0"
                              triggerClassName={lineSelectTrigger}
                            />
                          </LineField>

                          <LineField label={catalogLabelForType(item.item_type)} required={req('material')}>
                            <Select
                              value={item.product_id}
                              onChange={v => updateItem(idx, 'product_id', v)}
                              options={[
                                { value: '', label: item.item_type === 'service' ? 'Select service…' : 'Select product…' },
                                ...catalogOptions,
                              ]}
                              aria-label={catalogLabelForType(item.item_type)}
                              className="w-full min-w-0"
                              showSelectedHint={false}
                              triggerClassName={lineSelectTrigger}
                            />
                          </LineField>

                          <LineField label="Variant">
                            {(item.item_type === 'product' || item.item_type === 'consumption') ? (
                              loadingVariants ? (
                                <div className="flex h-8 items-center gap-1.5 text-[11px] text-gray-400">
                                  <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                                </div>
                              ) : hasVariants ? (
                                <Select
                                  value={item.variant_id}
                                  onChange={v => updateItem(idx, 'variant_id', v)}
                                  options={selectOptionsWithBlank('— Select —', variants.map(v => ({ value: v.id, label: v.name, hint: v.sku || undefined })))}
                                  aria-label="Variant"
                                  className="w-full min-w-0"
                                  showSelectedHint={false}
                                  triggerClassName={`${lineSelectTrigger} ${!item.variant_id ? 'border-amber-300 bg-amber-50' : ''}`}
                                />
                              ) : (
                                <div className={dashedBoxCls}>{item.product_id ? '—' : 'Select product first'}</div>
                              )
                            ) : (
                              <div className={dashedBoxCls}>—</div>
                            )}
                          </LineField>

                          <LineField label={QTY_LABELS[item.item_type]} required={req('quantity')}>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              className={`${lineInputCls} font-semibold`}
                              placeholder="0"
                              value={item.quantity}
                              onChange={e => updateItem(idx, 'quantity', e.target.value)}
                              onWheel={e => (e.target as HTMLInputElement).blur()}
                              required
                            />
                          </LineField>

                          <LineField label={`Cost (${currency})`} required={req('net_price')}>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className={`${lineInputCls} font-semibold`}
                              placeholder="0.00"
                              value={item.unit_cost}
                              onChange={e => updateItem(idx, 'unit_cost', e.target.value)}
                              onWheel={e => (e.target as HTMLInputElement).blur()}
                              required
                            />
                          </LineField>

                          {show('tax_code') ? (
                            <LineField label="Tax Code" required={req('tax_code')}>
                              <Select
                                value={item.tax_code}
                                onChange={v => updateItem(idx, 'tax_code', v)}
                                options={[
                                  {
                                    value: '',
                                    label: taxCodesUnavailable
                                      ? '⚠ Unavailable'
                                      : activeTaxCodes.length
                                        ? '— No tax —'
                                        : 'No tax codes',
                                  },
                                  ...activeTaxCodes.map(c => ({
                                    value: c.code,
                                    label: `${c.code} · ${Number(c.rate) || 0}%`,
                                    hint: taxSplitLabel(c, intraState) || (c.tax_type || '').toUpperCase(),
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
                          ) : (
                            <div className="hidden lg:block" />
                          )}
                        </div>

                        {/* Row 2 — UoM + master codes / service period (no empty gaps) */}
                        <div className={LINE_ROW_GRID}>
                          {show('unit') ? (
                            <LineField label="UoM">
                              <Select
                                value={item.unit_of_measure}
                                onChange={v => updateItem(idx, 'unit_of_measure', v)}
                                options={[
                                  { value: '', label: '—' },
                                  ...UOM_OPTIONS.map(u => ({ value: u.value, label: u.label, group: u.group })),
                                  ...(item.unit_of_measure && !UOM_OPTIONS.some(u => u.value === item.unit_of_measure)
                                    ? [{ value: item.unit_of_measure, label: uomLabel(item.unit_of_measure) }]
                                    : []),
                                ]}
                                aria-label="UoM"
                                className="w-full min-w-0"
                                triggerClassName={lineSelectTrigger}
                              />
                            </LineField>
                          ) : (
                            <LineField label="UoM">
                              <div className={dashedBoxCls}>—</div>
                            </LineField>
                          )}

                          {item.item_type === 'service' ? (
                            <>
                              <LineField label="Service From">
                                <Input
                                  type="date"
                                  value={item.service_period_from}
                                  onChange={e => updateItem(idx, 'service_period_from', e.target.value)}
                                  className={lineInputCls}
                                />
                              </LineField>
                              <LineField label="Service To">
                                <Input
                                  type="date"
                                  value={item.service_period_to}
                                  onChange={e => updateItem(idx, 'service_period_to', e.target.value)}
                                  className={lineInputCls}
                                />
                              </LineField>
                              {SERVICE_MASTER_SLOTS.map(label => (
                                <LineField key={label} label={label}>
                                  <div className={`${readonlyBoxCls} font-mono tabular-nums`} title="From service master">
                                    {getMasterFactValue(masterFacts, label) || '—'}
                                  </div>
                                </LineField>
                              ))}
                            </>
                          ) : item.item_type === 'product' || item.item_type === 'consumption' ? (
                            PRODUCT_MASTER_SLOTS.map(label => (
                              <LineField key={label} label={label}>
                                <div className={`${readonlyBoxCls} font-mono tabular-nums`} title="From product master">
                                  {loadingVariants && item.product_id
                                    ? 'Loading…'
                                    : (getMasterFactValue(masterFacts, label) || '—')}
                                </div>
                              </LineField>
                            ))
                          ) : item.item_type === 'asset' ? (
                            <>
                              <LineField label="Asset Tag">
                                <Input
                                  value={item.asset_tag}
                                  onChange={e => updateItem(idx, 'asset_tag', e.target.value)}
                                  placeholder="Optional"
                                  className={lineInputCls}
                                />
                              </LineField>
                              <LineField label="Department">
                                <Select
                                  value={item.cost_center_id}
                                  onChange={v => updateItem(idx, 'cost_center_id', v)}
                                  options={selectOptionsWithBlank(
                                    costCentersLoading ? 'Loading…' : 'Select cost center…',
                                    activeCostCenters.map(cc => ({ value: cc.id, label: `${cc.code} · ${cc.name}` })),
                                  )}
                                  placeholder={costCentersLoading ? 'Loading…' : 'Select cost center…'}
                                  disabled={costCentersLoading}
                                  className="w-full min-w-0"
                                  triggerClassName={lineSelectTrigger}
                                  aria-label="Cost center"
                                />
                              </LineField>
                              <LineField label="Priority">
                                <Select
                                  value={item.priority}
                                  onChange={v => updateItem(idx, 'priority', v)}
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
                                  onChange={e => updateItem(idx, 'needed_by_date', e.target.value)}
                                  className={lineInputCls}
                                />
                              </LineField>
                              <div className="hidden lg:block" aria-hidden />
                            </>
                          ) : showAcct ? (
                            <>
                              <LineField label="Acct Assign">
                                <Select
                                  value={item.account_assignment}
                                  onChange={v => updateItem(idx, 'account_assignment', v)}
                                  options={[
                                    { value: '', label: 'None' },
                                    { value: 'cost_center', label: 'Cost Center' },
                                    { value: 'project', label: 'Project / WBS' },
                                    { value: 'asset', label: 'Asset' },
                                    { value: 'gl_account', label: 'GL Account' },
                                  ]}
                                  aria-label="Acct Assign"
                                  className="w-full min-w-0"
                                  triggerClassName={lineSelectTrigger}
                                />
                              </LineField>
                              {item.account_assignment && item.account_assignment !== 'cost_center' && ACCT_ASSIGN_META[item.account_assignment] ? (
                                <LineField label={ACCT_ASSIGN_META[item.account_assignment].label}>
                                  <Input
                                    className={lineInputCls}
                                    placeholder={ACCT_ASSIGN_META[item.account_assignment].placeholder}
                                    value={item.account_assignment_value}
                                    onChange={e => updateItem(idx, 'account_assignment_value', e.target.value)}
                                    aria-label={ACCT_ASSIGN_META[item.account_assignment].label}
                                  />
                                </LineField>
                              ) : (
                                <div className="hidden lg:block" aria-hidden />
                              )}
                              <LineField label="Department">
                                <Select
                                  value={item.cost_center_id}
                                  onChange={v => updateItem(idx, 'cost_center_id', v)}
                                  options={selectOptionsWithBlank(
                                    costCentersLoading ? 'Loading…' : 'Select cost center…',
                                    activeCostCenters.map(cc => ({ value: cc.id, label: `${cc.code} · ${cc.name}` })),
                                  )}
                                  placeholder={costCentersLoading ? 'Loading…' : 'Select cost center…'}
                                  disabled={costCentersLoading}
                                  className="w-full min-w-0"
                                  triggerClassName={lineSelectTrigger}
                                  aria-label="Cost center"
                                />
                              </LineField>
                              <LineField label="Priority">
                                <Select
                                  value={item.priority}
                                  onChange={v => updateItem(idx, 'priority', v)}
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
                                  onChange={e => updateItem(idx, 'needed_by_date', e.target.value)}
                                  className={lineInputCls}
                                />
                              </LineField>
                            </>
                          ) : null}
                        </div>

                        {/* Row 3 — ops + note for product/service */}
                        {(item.item_type === 'product' || item.item_type === 'consumption' || item.item_type === 'service') ? (
                          <div className={LINE_ROW_GRID}>
                            <LineField label="Department">
                              <Select
                                value={item.cost_center_id}
                                onChange={v => updateItem(idx, 'cost_center_id', v)}
                                options={selectOptionsWithBlank(
                                  costCentersLoading ? 'Loading…' : 'Select cost center…',
                                  activeCostCenters.map(cc => ({ value: cc.id, label: `${cc.code} · ${cc.name}` })),
                                )}
                                placeholder={costCentersLoading ? 'Loading…' : 'Select cost center…'}
                                disabled={costCentersLoading}
                                className="w-full min-w-0"
                                triggerClassName={lineSelectTrigger}
                                aria-label="Cost center"
                              />
                            </LineField>
                            <LineField label="Priority">
                              <Select
                                value={item.priority}
                                onChange={v => updateItem(idx, 'priority', v)}
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
                                onChange={e => updateItem(idx, 'needed_by_date', e.target.value)}
                                className={lineInputCls}
                              />
                            </LineField>
                            {showNote ? (
                              <LineField label="Note" required={req('item_text')} className="col-span-2 sm:col-span-3 lg:col-span-3">
                                <div className="relative">
                                  <FileText className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
                                  <Textarea
                                    rows={1}
                                    className="min-h-8 h-8 w-full resize-y overflow-auto rounded-md border-gray-200 bg-white py-1.5 pl-7 pr-2 text-xs leading-snug shadow-none placeholder:text-gray-300"
                                    placeholder={req('item_text') ? 'Required note…' : 'Optional note…'}
                                    value={item.item_note}
                                    onChange={e => updateItem(idx, 'item_note', e.target.value)}
                                    required={req('item_text')}
                                  />
                                </div>
                              </LineField>
                            ) : (
                              <div className="col-span-2 sm:col-span-3 lg:col-span-3" aria-hidden />
                            )}
                          </div>
                        ) : showNote ? (
                          <LineField label="Note" required={req('item_text')}>
                            <div className="relative">
                              <FileText className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
                              <Textarea
                                rows={1}
                                className="min-h-8 h-8 w-full resize-y overflow-auto rounded-md border-gray-200 bg-white py-1.5 pl-7 pr-2 text-xs leading-snug shadow-none placeholder:text-gray-300"
                                placeholder={req('item_text') ? 'Required note…' : 'Optional note…'}
                                value={item.item_note}
                                onChange={e => updateItem(idx, 'item_note', e.target.value)}
                                required={req('item_text')}
                              />
                            </div>
                          </LineField>
                        ) : null}
                      </div>

                      <div className="flex w-[9.5rem] shrink-0 flex-col gap-2 pt-5 sm:w-[10.5rem]">
                        <div
                          className="rounded-md border border-blue-100 bg-blue-50/70 px-2 py-1.5 text-right dark:border-blue-900/40 dark:bg-blue-950/20"
                          title={`${formatCurrency(lineTotal, currency)}${lineTax.amount > 0 ? ` (+${formatCurrency(lineTax.amount, currency)} tax)` : ''}`}
                        >
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-blue-500/80 leading-none">Total</p>
                          <p className="mt-0.5 text-xs font-semibold tabular-nums leading-snug text-blue-800 dark:text-blue-200">
                            {formatCurrency(lineTotal, currency)}
                          </p>
                          {lineTax.amount > 0 && (
                            <p className="text-[10px] tabular-nums leading-snug text-blue-600/70 dark:text-blue-300/70">
                              +{formatCurrency(lineTax.amount, currency)} tax
                            </p>
                          )}
                        </div>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            aria-label="Remove line"
                            className="ml-auto flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Footer: add item + totals */}
              <div className="flex items-center justify-between gap-4 border-t border-gray-100 bg-gray-50/80 px-4 py-2 dark:border-gray-700 dark:bg-gray-800/40">
                <button type="button" onClick={addItem} className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700">
                  <Plus className="h-3 w-3" /> Add another line
                </button>
                <div className="flex flex-col items-end gap-0 text-sm leading-5">
                  <div className="flex items-center justify-end gap-3">
                    <span className="text-xs font-medium text-gray-500">Subtotal</span>
                    <span className="min-w-[6.5rem] text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(subtotal, currency)}</span>
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <span className="text-xs font-medium text-gray-500">Tax</span>
                    <span className="min-w-[6.5rem] text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(taxTotal, currency)}</span>
                  </div>
                  <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-0.5 dark:border-gray-700">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Total</span>
                    <span className="min-w-[6.5rem] text-right font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(grandTotal, currency)}</span>
                  </div>
                </div>
              </div>
            </Section>

            {/* ══ APPROVAL ROUTING ═══════════════════════════════════════════ */}
            {showWf('approver') && (
              <Section title="Approval Routing">
                <div className="p-5">
                  <ProcurementApproverFields
                    compact
                    primaryApproverId={primaryApproverId}
                    secondaryApproverId={secondaryApproverId}
                    approverMessage={approverMessage}
                    onPrimaryChange={id => { setPrimaryApproverId(id); if (id === secondaryApproverId) setSecondaryApproverId('') }}
                    onSecondaryChange={setSecondaryApproverId}
                    onMessageChange={setApproverMessage}
                  />
                </div>
              </Section>
            )}

            <div className="h-4" />
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Discard changes?"
        description="You have unsaved input. Leave anyway and lose your changes?"
        confirmLabel="Discard & Leave"
        cancelLabel="Keep editing"
        variant="warning"
        onCancel={cancelConfirm}
        onConfirm={forceClose}
      />
    </div>
  )
}
