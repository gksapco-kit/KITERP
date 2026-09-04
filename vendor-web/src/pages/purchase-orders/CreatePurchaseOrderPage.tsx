import { useState, useCallback, useEffect, useMemo, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import {
  PoDestinationFields,
  emptyPoDestination,
  poDestinationFromLine,
  poDestinationToPayload,
  type PoDestinationValue,
} from '@/components/procurement/PoDestinationFields'
import { ProcurementApproverFields } from '@/components/procurement/ProcurementApproverFields'
import {
  useCreatePurchaseOrder, useSuppliers, useProducts, useServices,
  useCreateSupplier, useRequisitions,
} from '@/hooks/useVendor'
import { useTaxCodes } from '@/hooks/useFinance'
import { useVendorStore } from '@/stores/vendorStore'
import { vendorApi } from '@/api/vendor'
import { formatCurrency } from '@/lib/utils'
import { buildTaxCodeMap, resolveLineTax, type TaxCode } from '@/lib/procurementTax'
import { dedupeSuppliers, findExistingSupplier } from '@/lib/supplierUtils'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { UOM_OPTIONS, uomLabel } from '@/lib/uomOptions'
import { normalizeUom } from '@/lib/procurementProductContext'
import type { Product, Service, PurchaseRequisition } from '@/types'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useGuardedClose } from '@/hooks/useGuardedClose'
import { useProcurementFieldConfig } from '@/hooks/useProcurementFieldConfig'
import { buildPrToPoPrefill, type PrToPoPrefill } from '@/lib/prToPoPrefill'
import { toast } from 'sonner'
import {
  ArrowLeft, Loader2, Plus, X, Trash2,
  UserPlus, Building2, ExternalLink,
  Landmark, FileText,
} from 'lucide-react'

const PO_FROM_PR_KEY = 'po_from_pr'
const PO_FROM_INVENTORY_KEY = 'po_from_inventory'
const PO_PENDING_SUPPLIER_KEY = 'po_pending_supplier'
const PO_BARCODE_PREFILL_KEY = 'po_barcode_prefill'

let _itemUid = 0
interface ItemRow {
  uid: number
  product_id: string; variant_id: string; quantity: string; unit_cost: string
  item_note: string; unit_of_measure: string; item_category: string
  tax_code: string; account_assignment: string; account_assignment_value: string; pr_item_id?: string
}

const ACCT_ASSIGN_META: Record<string, { label: string; placeholder: string }> = {
  cost_center: { label: 'Cost Center', placeholder: 'e.g. CC-ADMIN-01' },
  project:     { label: 'Project / WBS Element', placeholder: 'e.g. PRJ-2024-001' },
  asset:       { label: 'Asset Number / Category', placeholder: 'e.g. AST-00123' },
  gl_account:  { label: 'GL Account', placeholder: 'e.g. 6100-0001' },
}
interface CatalogItem {
  id: string; name: string; sku?: string; cost_price?: number; price?: number
  uom?: string
  type: 'product' | 'service'
  variants?: { id: string; name: string; sku?: string; barcode?: string; cost_price?: number; price?: number; uom?: string }[]
}
interface BarcodePrefill {
  productId: string; variantId?: string; productName: string
  variantName?: string; unitCost?: number; prefillQty?: number
}
interface InventoryAlertPrefill { productId: string; variantId?: string; productName: string; quantity: number }

// ─── Fiori-style field label ───────────────────────────────────────────────────
function FL({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 select-none">
      {children}{required && <span className="ml-0.5 text-red-500">*</span>}
    </p>
  )
}

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

  const { getStatus } = useProcurementFieldConfig()
  const show   = useCallback((k: string) => getStatus('PO', k)    !== 'suppress', [getStatus])
  const req    = useCallback((k: string) => getStatus('PO', k)    === 'mandatory', [getStatus])
  const showWf = useCallback((k: string) => getStatus('WF_PO', k) !== 'suppress', [getStatus])

  // ── Prefill from sessionStorage ───────────────────────────────────────────────
  const [barcodePrefill, setBarcodePrefill] = useState<BarcodePrefill | undefined>()
  const [pendingSupplier, setPendingSupplier] = useState<{ id: string; name: string } | undefined>()
  const [prPrefill, setPrPrefill] = useState<PrToPoPrefill | undefined>()

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

  // ── Form state ────────────────────────────────────────────────────────────────
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

  const emptyItem = (): ItemRow => ({ uid: ++_itemUid, product_id: '', variant_id: '', quantity: '', unit_cost: '', item_note: '', unit_of_measure: '', item_category: '', tax_code: '', account_assignment: '', account_assignment_value: '' })
  const [items, setItems] = useState<ItemRow[]>([emptyItem()])

  useEffect(() => {
    if (prPrefill?.items?.length) {
      setLinkedRequisitionId(prPrefill.requisitionId || ''); setLinkedPrNumber(prPrefill.prNumber || '')
      if (prPrefill.supplierId) setSupplierId(prPrefill.supplierId)
      if (prPrefill.expectedDate) setExpectedDate(prPrefill.expectedDate)
      if (prPrefill.notes) setNotes(prPrefill.notes)
      setItems(prPrefill.items.map(i => ({ ...emptyItem(), product_id: i.productId, variant_id: i.variantId || '', quantity: String(Math.max(1, Math.round(i.quantity))), unit_cost: String(i.unitCost ?? 0), item_note: i.note || '', pr_item_id: i.prItemId })))
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

  const products: CatalogItem[] = (productsData?.items || []).map((p: Product) => ({ id: p.id, name: p.name, sku: p.sku, cost_price: p.cost_price, price: p.price, uom: p.uom, type: 'product' as const }))
  const services: CatalogItem[] = (servicesData?.items || []).map((s: Service) => ({ id: s.id, name: s.name, cost_price: s.price, price: s.price, uom: s.uom, type: 'service' as const }))
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
          variants: (full.variants || []).map((v: any) => ({
            id: v.id, name: v.name, sku: v.sku, barcode: v.barcode,
            cost_price: v.cost_price, price: v.price, uom: v.uom,
          })),
        },
      }))
    } catch { /**/ }
  }, [productDetails])

  useEffect(() => {
    if (barcodePrefill?.productId) fetchProductDetails(barcodePrefill.productId)
    for (const item of items) if (item.product_id) fetchProductDetails(item.product_id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcodePrefill?.productId, items])

  // Backfill UoM + category from product/service master when catalog arrives (PR/barcode prefills, late list load)
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
      if (field === 'product_id' && value !== cur.product_id) {
        // Reset line-specific fields; seed UoM + category from product/service master
        const c = catalogMap.get(value)
        const masterUom = normalizeUom(c?.uom || '') || ''
        const masterCategory = c?.type === 'service' ? 'service' : value ? 'standard' : ''
        updated[idx] = {
          ...updated[idx],
          variant_id: '',
          unit_of_measure: masterUom,
          item_category: masterCategory,
          tax_code: '',
          account_assignment: '',
          account_assignment_value: '',
        }
        const keepCost = Boolean(cur.pr_item_id) && parseFloat(cur.unit_cost) > 0
        if (!keepCost) {
          if (c?.cost_price) updated[idx].unit_cost = String(c.cost_price)
          else if (c?.price) updated[idx].unit_cost = String(c.price)
        }
        if (value) fetchProductDetails(value)
      }
      if (field === 'variant_id' && value !== cur.variant_id) {
        const v = productDetails[updated[idx].product_id]?.variants?.find(vr => vr.id === value)
        // Prefer variant UoM when present; otherwise keep product-level UoM
        if (v?.uom) updated[idx].unit_of_measure = normalizeUom(v.uom) || updated[idx].unit_of_measure
        const keepCost = Boolean(cur.pr_item_id) && parseFloat(cur.unit_cost) > 0
        if (value && !keepCost) {
          if (v?.cost_price) updated[idx].unit_cost = String(v.cost_price)
          else if (v?.price) updated[idx].unit_cost = String(v.price)
        }
      }
      if (field === 'account_assignment') {
        // Clear the value field whenever the category changes
        updated[idx].account_assignment_value = ''
      }
      return updated
    })
  }

  const applyRequisition = useCallback((pr: PurchaseRequisition) => {
    const prefill = buildPrToPoPrefill(pr); if (!prefill) { toast.error('No convertible product/service lines on this requisition'); return }
    setLinkedRequisitionId(prefill.requisitionId); setLinkedPrNumber(prefill.prNumber)
    if (prefill.supplierId) setSupplierId(prefill.supplierId); if (prefill.expectedDate) setExpectedDate(prefill.expectedDate); if (prefill.notes) setNotes(prefill.notes)
    setItems(prefill.items.map(i => ({ ...emptyItem(), product_id: i.productId, variant_id: i.variantId || '', quantity: String(Math.max(1, Math.round(i.quantity))), unit_cost: String(i.unitCost ?? 0), item_note: i.note || '', pr_item_id: i.prItemId })))
    const first = prefill.items[0]; setDest(poDestinationFromLine({ plant_id: first?.plantId, storage_location_id: first?.storageLocationId }, prefill.storeId || selectedStore?.id || ''))
    toast.success(`Loaded lines from ${prefill.prNumber}`)
  }, [selectedStore?.id])

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

  const { data: taxCodesData } = useTaxCodes()
  const taxCodeMap = useMemo(() => buildTaxCodeMap(taxCodesData as TaxCode[] | undefined), [taxCodesData])
  const activeTaxCodes = useMemo(
    () => ((taxCodesData as TaxCode[] | undefined) ?? []).filter(c => c.is_active !== false),
    [taxCodesData],
  )

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_cost) || 0), 0)
  const taxTotal = items.reduce((s, i) => {
    const lineTotal = (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_cost) || 0)
    return s + resolveLineTax(lineTotal, i.tax_code, taxCodeMap).amount
  }, 0)
  const grandTotal = subtotal + taxTotal

  const canSubmit = Boolean(
    supplierId && items.every(i => {
      const pd = productDetails[i.product_id]
      const isProduct = catalogMap.get(i.product_id)?.type === 'product'
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

  const isDirty = !!(supplierId || notes.trim() || expectedDate || paymentTerms.trim() || primaryApproverId || approverMessage.trim() || items.some(i => i.product_id || i.item_note?.trim()))

  const goBack = useCallback(() => navigate('/purchase-orders'), [navigate])
  const { handleClose, confirmOpen, cancelConfirm, forceClose } = useGuardedClose(goBack, isDirty, false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault(); if (!canSubmit) return
    try {
      const prItemIds = items.map(i => i.pr_item_id).filter(Boolean) as string[]
      const approvers = primaryApproverId ? [{ approver_id: primaryApproverId, level: 1 }, ...(secondaryApproverId ? [{ approver_id: secondaryApproverId, level: 2 }] : [])] : []
      const destPayload = poDestinationToPayload(dest)
      const po = await createMut.mutateAsync({
        supplier_id: supplierId,
        items: items.map(i => ({
          product_id: i.product_id, variant_id: i.variant_id || undefined, quantity: parseInt(i.quantity), unit_cost: parseFloat(i.unit_cost),
          description: show('item_text') ? (i.item_note || undefined) : undefined,
          unit_of_measure: show('unit') ? (i.unit_of_measure || undefined) : undefined,
          item_category: show('item_category') ? (i.item_category || undefined) : undefined,
          tax_code: show('tax_code') ? (i.tax_code || undefined) : undefined,
          account_assignment: show('account_assignment_category') ? (i.account_assignment || undefined) : undefined,
          account_assignment_value: show('account_assignment_category') ? (i.account_assignment_value?.trim() || undefined) : undefined,
          plant_id: show('plant') ? destPayload.plant_id : undefined,
          storage_location_id: show('storage_location') ? destPayload.storage_location_id : undefined,
        })),
        expected_delivery_date: show('delivery_date') ? (expectedDate || undefined) : undefined,
        notes: show('header_text') ? (notes || undefined) : undefined,
        currency: show('currency') ? (currency || undefined) : undefined,
        payment_terms: show('payment_terms') ? (paymentTerms.trim() || undefined) : undefined,
        requisition_id: linkedRequisitionId || prPrefill?.requisitionId || undefined,
        pr_item_ids: prItemIds.length ? prItemIds : undefined,
        approvers, approver_message: approverMessage.trim() || undefined,
      })
      navigate(`/purchase-orders/${po.id}`)
    } catch { /**/ }
  }, [canSubmit, supplierId, items, expectedDate, notes, currency, paymentTerms, dest, createMut, navigate, linkedRequisitionId, prPrefill?.requisitionId, primaryApproverId, secondaryApproverId, approverMessage, show])

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
            {linkedRequisitionId || prPrefill ? 'Create PO from Requisition' : 'New Purchase Order'}
          </h1>
          <p className="text-[11px] text-gray-400">
            {linkedPrNumber || prPrefill?.prNumber
              ? `From ${linkedPrNumber || prPrefill?.prNumber}`
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
                {/* Row 1: PR Ref | Supplier | Expected Delivery | Currency */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <FL>Purchase Requisition</FL>
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
                      triggerClassName="h-8 text-sm rounded-md border-gray-200"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <FL required={req('supplier')}>Supplier</FL>
                      <button type="button" onClick={() => setShowQuickSupplier(v => !v)} className="flex items-center gap-0.5 text-[10px] font-medium text-blue-600 hover:text-blue-700">
                        <UserPlus className="h-2.5 w-2.5" /> Add
                      </button>
                    </div>
                    <Select
                      value={supplierId}
                      onChange={setSupplierId}
                      options={selectOptionsWithBlank('Select supplier...', dedupeSuppliers(suppliersData?.items ?? []).map(s => ({ value: s.id, label: s.name })))}
                      aria-label="Supplier"
                      className="w-full"
                      triggerClassName="h-8 text-sm rounded-md border-gray-200"
                    />
                  </div>

                  {show('delivery_date') && (
                    <div>
                      <FL required={req('delivery_date')}>Expected Delivery</FL>
                      <Input type="date" className="h-8 w-full rounded-md border-gray-200 text-sm" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} required={req('delivery_date')} />
                    </div>
                  )}

                  {show('currency') && (
                    <div>
                      <FL required={req('currency')}>Currency</FL>
                      <Select
                        value={currency} onChange={setCurrency}
                        options={[
                          { value: 'INR', label: 'INR — Indian Rupee' }, { value: 'USD', label: 'USD — US Dollar' },
                          { value: 'EUR', label: 'EUR — Euro' },         { value: 'GBP', label: 'GBP — British Pound' },
                          { value: 'AED', label: 'AED — UAE Dirham' },   { value: 'SGD', label: 'SGD — Singapore Dollar' },
                        ]}
                        aria-label="Currency" className="w-full" triggerClassName="h-8 text-sm rounded-md border-gray-200"
                      />
                    </div>
                  )}
                </div>

                {/* Row 2: Payment Terms | Notes */}
                {(show('payment_terms') || show('header_text')) && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {show('payment_terms') && (
                      <div>
                        <FL required={req('payment_terms')}>Payment Terms</FL>
                        <Input className="h-8 w-full rounded-md border-gray-200 text-sm" placeholder="e.g. Net 30" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} />
                      </div>
                    )}
                    {show('header_text') && (
                      <div className="lg:col-span-2">
                        <FL required={req('header_text')}>Notes / Remarks</FL>
                        <Input className="h-8 w-full rounded-md border-gray-200 text-sm" placeholder="Internal notes…" value={notes} onChange={e => setNotes(e.target.value)} required={req('header_text')} />
                      </div>
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
              {/* Table header */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1010px] table-fixed border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-gray-50/80 text-left dark:bg-gray-800/60">
                      <th className="w-9 sticky left-0 z-10 bg-gray-50/80 border-b border-r border-gray-200 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap dark:border-gray-700 dark:bg-gray-800/60">#</th>
                      {/* No width — absorbs all remaining space so long names get room */}
                      <th className="border-b border-gray-200 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 truncate dark:border-gray-700">Product / Service</th>
                      <th className="w-32 border-b border-gray-200 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap dark:border-gray-700">Variant</th>
                      <th className="w-20 border-b border-gray-200 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap dark:border-gray-700">Qty{req('quantity') ? <span className="text-red-400">*</span> : ''}</th>
                      <th className="w-28 border-b border-gray-200 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap dark:border-gray-700">Unit Cost ({currency}){req('net_price') ? <span className="text-red-400">*</span> : ''}</th>
                      {show('unit') && <th className="w-24 border-b border-gray-200 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap dark:border-gray-700">UoM</th>}
                      {show('item_category') && <th className="w-28 border-b border-gray-200 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap dark:border-gray-700">Category</th>}
                      {show('tax_code') && <th className="w-24 border-b border-gray-200 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap dark:border-gray-700">Tax Code</th>}
                      <th className="w-28 sticky right-9 z-10 bg-gray-50/80 border-b border-l border-gray-200 px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap dark:border-gray-700 dark:bg-gray-800/60">Total</th>
                      <th className="w-9 sticky right-0 z-10 bg-gray-50/80 border-b border-gray-200 px-2 py-2 dark:border-gray-700 dark:bg-gray-800/60" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const pd = productDetails[item.product_id]
                      const variants = pd?.variants || []
                      const isProduct = catalogMap.get(item.product_id)?.type === 'product'
                      const hasVariants = isProduct && variants.length > 0
                      const loadingVariants = isProduct && !!item.product_id && !pd
                      const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0)
                      const lineTax = resolveLineTax(lineTotal, item.tax_code, taxCodeMap)
                      const isEven = idx % 2 === 0
                      const showSubRow = show('account_assignment_category') || show('item_text')
                      const optionalColCount = [show('unit'), show('item_category'), show('tax_code')].filter(Boolean).length

                      return (
                        <Fragment key={item.uid}>
                          <tr className={isEven ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/40 dark:bg-gray-800/20'}>
                            {/* # — sticky left */}
                            <td className={`border-b border-r border-gray-100 px-2 py-1.5 sticky left-0 z-[1] dark:border-gray-800 ${isEven ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/40 dark:bg-gray-800/20'}`}>
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{idx + 1}</span>
                            </td>
                            {/* Product / Service */}
                            <td className="border-b border-gray-100 px-2 py-1.5 dark:border-gray-800 min-w-0">
                              <Select
                                value={item.product_id}
                                onChange={v => updateItem(idx, 'product_id', v)}
                                options={[
                                  { value: '', label: 'Select product or service…' },
                                  ...products.map(p => ({ value: p.id, label: p.name, hint: p.sku || undefined, group: 'Products' })),
                                  ...services.map(s => ({ value: s.id, label: s.name, group: 'Services' })),
                                ]}
                                aria-label="Product or service"
                                className="w-full min-w-0"
                                showSelectedHint={false}
                                triggerClassName="h-8 text-xs border-gray-200 bg-white rounded-md shadow-none"
                              />
                            </td>
                            {/* Variant — main row */}
                            <td className="border-b border-gray-100 px-2 py-1.5 dark:border-gray-800 min-w-0">
                              {loadingVariants ? (
                                <div className="flex h-8 items-center gap-1.5 text-[11px] text-gray-400">
                                  <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                                </div>
                              ) : hasVariants ? (
                                <Select
                                  value={item.variant_id}
                                  onChange={v => updateItem(idx, 'variant_id', v)}
                                  options={selectOptionsWithBlank('— Select variant —', variants.map(v => ({ value: v.id, label: v.name, hint: v.sku || undefined })))}
                                  aria-label="Variant"
                                  className="w-full min-w-0"
                                  showSelectedHint={false}
                                  triggerClassName={`h-8 text-xs rounded-md shadow-none ${!item.variant_id ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}
                                />
                              ) : (
                                <span className="flex h-8 items-center px-2 text-xs text-gray-300">—</span>
                              )}
                            </td>
                            {/* Qty */}
                            <td className="border-b border-gray-100 px-2 py-1.5 dark:border-gray-800">
                              <Input type="number" min={1} step={1} className="h-8 w-full rounded-md border-gray-200 bg-white text-sm font-semibold shadow-none focus:border-blue-400 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" placeholder="0" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} onWheel={e => (e.target as HTMLInputElement).blur()} required />
                            </td>
                            {/* Unit Cost */}
                            <td className="border-b border-gray-100 px-2 py-1.5 dark:border-gray-800">
                              <Input type="number" min={0} step="0.01" className="h-8 w-full rounded-md border-gray-200 bg-white text-sm font-semibold shadow-none focus:border-blue-400 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" placeholder="0.00" value={item.unit_cost} onChange={e => updateItem(idx, 'unit_cost', e.target.value)} onWheel={e => (e.target as HTMLInputElement).blur()} required />
                            </td>
                            {show('unit') && (
                              <td className="border-b border-gray-100 px-2 py-1.5 dark:border-gray-800">
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
                                  triggerClassName="h-8 text-xs border-gray-200 bg-white rounded-md shadow-none"
                                />
                              </td>
                            )}
                            {show('item_category') && (
                              <td className="border-b border-gray-100 px-2 py-1.5 dark:border-gray-800">
                                <Select value={item.item_category} onChange={v => updateItem(idx, 'item_category', v)}
                                  options={[
                                    { value: '', label: '—' },
                                    { value: 'standard', label: 'Product / Goods' },
                                    { value: 'service', label: 'Service' },
                                    { value: 'subcontract', label: 'Subcontract' },
                                    { value: 'consignment', label: 'Consignment' },
                                    { value: 'third_party', label: 'Third Party' },
                                  ]}
                                  aria-label="Category" triggerClassName="h-8 text-xs border-gray-200 bg-white rounded-md shadow-none" />
                              </td>
                            )}
                            {show('tax_code') && (
                              <td className="border-b border-gray-100 px-2 py-1.5 dark:border-gray-800 min-w-0">
                                <Select
                                  value={item.tax_code}
                                  onChange={v => updateItem(idx, 'tax_code', v)}
                                  options={[
                                    { value: '', label: activeTaxCodes.length ? '— No tax —' : 'No tax codes set up' },
                                    ...activeTaxCodes.map(c => ({
                                      value: c.code,
                                      label: c.code,
                                      hint: `${Number(c.rate) || 0}% ${(c.tax_type || '').toUpperCase()}`,
                                    })),
                                    // Keep an unrecognised saved code selectable rather than silently clearing it
                                    ...(item.tax_code && !taxCodeMap.has(item.tax_code.trim().toUpperCase())
                                      ? [{ value: item.tax_code, label: item.tax_code, hint: 'unknown' }]
                                      : []),
                                  ]}
                                  aria-label="Tax code"
                                  className="w-full min-w-0"
                                  showSelectedHint={false}
                                  triggerClassName={`h-8 text-xs rounded-md shadow-none ${
                                    item.tax_code && !taxCodeMap.has(item.tax_code.trim().toUpperCase())
                                      ? 'border-amber-300 bg-amber-50'
                                      : 'border-gray-200 bg-white'
                                  }`}
                                />
                              </td>
                            )}
                            {/* Total — sticky right */}
                            <td className={`border-b border-l border-gray-100 px-2 py-1.5 text-right sticky right-9 z-[1] dark:border-gray-800 ${isEven ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/40 dark:bg-gray-800/20'}`}>
                              <div className="text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-200">{formatCurrency(lineTotal, currency)}</div>
                              {lineTax.amount > 0 && (
                                <div className="text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
                                  +{formatCurrency(lineTax.amount, currency)} tax
                                </div>
                              )}
                            </td>
                            {/* Delete — sticky right-0 */}
                            <td className={`border-b border-gray-100 px-2 py-1.5 sticky right-0 z-[1] dark:border-gray-800 ${isEven ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/40 dark:bg-gray-800/20'}`}>
                              {items.length > 1 && (
                                <button type="button" onClick={() => removeItem(idx)} aria-label="Remove line" className="flex h-6 w-6 items-center justify-center rounded text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                          {/* ── Sub-row: account assignment + note ── */}
                          {showSubRow && (
                            <tr className="bg-gray-50/70 dark:bg-gray-800/30">
                              <td className="border-b border-r border-gray-100 px-2 py-1.5 sticky left-0 z-[1] bg-gray-50/70 dark:border-gray-800 dark:bg-gray-800/30">
                                <div className="flex justify-center">
                                  <div className="h-4 w-3 border-b-2 border-l-2 border-gray-200 rounded-bl-md dark:border-gray-600" />
                                </div>
                              </td>
                              <td
                                className="border-b border-gray-100 px-2 py-1.5 dark:border-gray-800"
                                colSpan={4 + optionalColCount}
                              >
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">

                                  {/* Account assignment category + value */}
                                  {show('account_assignment_category') && (
                                    <>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 shrink-0">
                                          <Landmark className="h-3 w-3" /> Acct Assign
                                        </span>
                                        <Select
                                          value={item.account_assignment}
                                          onChange={v => updateItem(idx, 'account_assignment', v)}
                                          options={[{ value: '', label: 'None' }, { value: 'cost_center', label: 'Cost Center' }, { value: 'project', label: 'Project / WBS' }, { value: 'asset', label: 'Asset' }, { value: 'gl_account', label: 'GL Account' }]}
                                          aria-label="Acct Assign"
                                          className="w-40"
                                          triggerClassName="h-8 text-xs border-gray-200 bg-white rounded-md shadow-none"
                                        />
                                      </div>
                                      {item.account_assignment && ACCT_ASSIGN_META[item.account_assignment] && (
                                        <div className="flex items-center gap-2 shrink-0">
                                          <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 shrink-0">
                                            {ACCT_ASSIGN_META[item.account_assignment].label}
                                          </span>
                                          <Input
                                            className="h-8 w-44 rounded-md border-blue-200 bg-white text-xs shadow-none placeholder:text-gray-300 focus:border-blue-400"
                                            placeholder={ACCT_ASSIGN_META[item.account_assignment].placeholder}
                                            value={item.account_assignment_value}
                                            onChange={e => updateItem(idx, 'account_assignment_value', e.target.value)}
                                          />
                                        </div>
                                      )}
                                    </>
                                  )}

                                  {/* Item note */}
                                  {show('item_text') && (
                                    <div className="flex flex-1 items-center gap-2 min-w-[200px]">
                                      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 shrink-0">
                                        <FileText className="h-3 w-3" /> Note
                                      </span>
                                      <Input
                                        className="h-8 flex-1 rounded-md border-gray-200 bg-white text-xs shadow-none placeholder:text-gray-300"
                                        placeholder={req('item_text') ? 'Required note…' : 'Optional note…'}
                                        value={item.item_note}
                                        onChange={e => updateItem(idx, 'item_note', e.target.value)}
                                        required={req('item_text')}
                                      />
                                    </div>
                                  )}

                                </div>
                              </td>
                              <td className="border-b border-l border-gray-100 sticky right-9 z-[1] bg-gray-50/70 dark:border-gray-800 dark:bg-gray-800/30" />
                              <td className="border-b border-gray-100 sticky right-0 z-[1] bg-gray-50/70 dark:border-gray-800 dark:bg-gray-800/30" />
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table footer: add item + totals */}
              <div className="flex items-start justify-between gap-4 border-t border-gray-100 bg-gray-50/80 px-5 py-2.5 dark:border-gray-700 dark:bg-gray-800/40">
                <button type="button" onClick={addItem} className="flex items-center gap-1 pt-1 text-[11px] font-medium text-blue-600 hover:text-blue-700">
                  <Plus className="h-3 w-3" /> Add another line
                </button>
                <div className="flex flex-col items-end gap-0.5 text-sm">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs font-medium text-gray-500">Subtotal</span>
                    <span className="w-28 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(subtotal, currency)}</span>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs font-medium text-gray-500">Tax</span>
                    <span className="w-28 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(taxTotal, currency)}</span>
                  </div>
                  <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-1 dark:border-gray-700">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Total</span>
                    <span className="w-28 text-right font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(grandTotal, currency)}</span>
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
