/**
 * Unified Purchase Requisition create/edit form.
 *
 * - layout="page"  → full-page Fiori-style layout with sticky top bar
 * - layout="modal" → compact card/dialog layout
 *
 * Handles both create and edit modes via the `editingPR` prop.
 * Callers provide `onSuccess` / `onCancel` for navigation / close logic.
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  useCreateRequisition, useUpdateRequisition, useSubmitRequisition,
  useStores, useRequisition, useRequisitions,
} from '@/hooks/useVendor'
import { useCostCenters, useTaxCodes } from '@/hooks/useFinance'
import type { CostCenter } from '@/types/finance'
import { ProcurementLineItemForm } from '@/components/procurement/ProcurementLineItemForm'
import { ProcurementApproverFields } from '@/components/procurement/ProcurementApproverFields'
import {
  PoDestinationFields,
  emptyPoDestination,
  poDestinationFromLine,
  poDestinationToPayload,
  type PoDestinationValue,
} from '@/components/procurement/PoDestinationFields'
import {
  ProcurementPRHeaderFields,
  type ProcurementSource,
  type BUScope,
} from '@/components/procurement/ProcurementPRHeaderFields'
import {
  emptyItem,
  isItemValid,
  buildItemNotes,
  findFirstPrSubmitLineIssue,
  type ItemRow,
} from '@/components/procurement/procurementLineItemTypes'
import { LineItemsExpandAllActions } from '@/components/procurement/LineItemExpandHeader'
import { CopyFromDocumentField } from '@/components/procurement/CopyFromDocumentField'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useGuardedClose } from '@/hooks/useGuardedClose'
import { formatCurrency } from '@/lib/utils'
import { buildTaxCodeMap, resolveLineTax, type TaxCode } from '@/lib/procurementTax'
import {
  PR_FROM_INVENTORY_KEY,
  type InventoryAlertPrefill,
} from '@/lib/prToPoPrefill'
import {
  PR_COPY_FROM_ID_KEY,
  parsePrTitleNotes,
  prToCopyItemRows,
} from '@/lib/copyDocument'
import { vendorApi } from '@/api/vendor'
import { extractApiError } from '@/lib/errorMessages'
import { actionDocMessage, createdDocMessage } from '@/lib/documentToast'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Plus, ClipboardList, Send, AlertCircle, Save, UserCheck, X } from 'lucide-react'
import type { PurchaseRequisition } from '@/types'

// ── Fiori-style section wrapper (page layout) ─────────────────────────────────

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

function FL({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 select-none">
      {children}
    </p>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PurchaseRequisitionFormProps {
  /** Null/undefined = create mode. Provide a PR to edit it. */
  editingPR?: PurchaseRequisition | null
  /** Pre-fill from an inventory reorder / low-stock alert. */
  inventoryPrefill?: InventoryAlertPrefill | null
  /** Called after a successful create or update. */
  onSuccess: () => void
  /** Called when the user clicks Cancel / Back. */
  onCancel: () => void
  /** Page layout = full-screen Fiori; modal layout = compact card. */
  layout?: 'page' | 'modal'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PurchaseRequisitionForm({
  editingPR,
  inventoryPrefill: inventoryPrefillProp,
  onSuccess,
  onCancel,
  layout = 'page',
}: PurchaseRequisitionFormProps) {
  const isEditMode = Boolean(editingPR)

  const createPR = useCreateRequisition()
  const updatePR = useUpdateRequisition()
  const submitPR = useSubmitRequisition()
  const { data: loadedPR } = useRequisition(editingPR?.id ?? null)
  const sourcePR = loadedPR ?? editingPR ?? null
  const { data: costCenters = [], isLoading: costCentersLoading } = useCostCenters()
  const { data: storesData, isLoading: storesLoading } = useStores()
  const { data: copyDocs, isLoading: copyDocsLoading } = useRequisitions({ size: 100 })
  const { data: taxCodesData } = useTaxCodes()
  const taxCodeMap = useMemo(() => buildTaxCodeMap(taxCodesData as TaxCode[] | undefined), [taxCodesData])

  const copySuggestions = useMemo(() => {
    const items = (copyDocs?.items ?? []) as PurchaseRequisition[]
    return items.map(r => {
      const { title } = parsePrTitleNotes(r.notes)
      return {
        number: r.pr_number,
        title: title || undefined,
        hint: [r.status?.replace(/_/g, ' '), r.department].filter(Boolean).join(' · ') || undefined,
      }
    })
  }, [copyDocs])

  const activeStores = useMemo(
    () => (storesData?.stores ?? []).filter((s: Record<string, unknown>) => s.is_active !== false),
    [storesData?.stores],
  )
  const defaultStoreId = useMemo(
    () => (activeStores.find((s: Record<string, unknown>) => s.is_default) as { id: string } | undefined)?.id ?? (activeStores[0] as { id: string } | undefined)?.id ?? '',
    [activeStores],
  )
  const activeCostCenters = useMemo(
    () => (costCenters as CostCenter[]).filter(cc => cc.is_active),
    [costCenters],
  )

  // ── Session-storage pre-fills (page layout only) ───────────────────────────

  const [inventoryPrefill, setInventoryPrefill] = useState<InventoryAlertPrefill | null>(inventoryPrefillProp ?? null)

  useEffect(() => {
    if (layout !== 'page' || isEditMode) return
    const raw = sessionStorage.getItem(PR_FROM_INVENTORY_KEY)
    if (!raw) return
    sessionStorage.removeItem(PR_FROM_INVENTORY_KEY)
    try { setInventoryPrefill(JSON.parse(raw)) } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Form state ────────────────────────────────────────────────────────────

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [storeId, setStoreId] = useState('')
  const [procurementSource, setProcurementSource] = useState<ProcurementSource>('supplier')
  const [buScope, setBuScope] = useState<BUScope>('within_bu')
  const [fromStoreId, setFromStoreId] = useState('')
  const [toStoreId, setToStoreId] = useState('')
  const [headerSupplierId, setHeaderSupplierId] = useState('')
  const [primaryApproverId, setPrimaryApproverId] = useState('')
  const [secondaryApproverId, setSecondaryApproverId] = useState('')
  const [approverMessage, setApproverMessage] = useState('')
  const [items, setItems] = useState<ItemRow[]>(() => {
    if (!isEditMode && inventoryPrefillProp) {
      return [{
        ...emptyItem('product'),
        reference_id: inventoryPrefillProp.productId,
        variant_id: inventoryPrefillProp.variantId || '',
        quantity: inventoryPrefillProp.quantity,
        description: inventoryPrefillProp.productName,
      }]
    }
    return [emptyItem()]
  })
  const [collapsedLineIndexes, setCollapsedLineIndexes] = useState<Set<number>>(() => new Set())
  const [dest, setDest] = useState<PoDestinationValue>(() => emptyPoDestination(inventoryPrefillProp?.storeId || ''))
  const [lineFieldError, setLineFieldError] = useState<{ lineIndex: number; field: keyof ItemRow } | null>(null)
  const [formLoaded, setFormLoaded] = useState(!isEditMode)
  const [copiedFromNumber, setCopiedFromNumber] = useState<string | null>(null)
  const [copyLoading, setCopyLoading] = useState(false)

  // ── Inventory-prefill effect ───────────────────────────────────────────────

  useEffect(() => {
    if (!inventoryPrefill || isEditMode) return
    const sourceLabel = inventoryPrefill.source === 'reorder' ? 'Reorder alert' : 'Low stock alert'
    setTitle(`${sourceLabel}: ${inventoryPrefill.productName}`)
    if (inventoryPrefill.storeId) {
      setStoreId(inventoryPrefill.storeId)
      setFromStoreId(inventoryPrefill.storeId)
      setDest(emptyPoDestination(inventoryPrefill.storeId))
    }
    setItems([{
      ...emptyItem('product'),
      reference_id: inventoryPrefill.productId,
      variant_id: inventoryPrefill.variantId || '',
      quantity: inventoryPrefill.quantity,
      description: inventoryPrefill.productName,
    }])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryPrefill])

  // ── Edit-mode loading ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!sourcePR || formLoaded) return
    const { title: parsedTitle, internalNotes } = parsePrTitleNotes(sourcePR.notes)
    setTitle(parsedTitle || sourcePR.title || '')
    setNotes(internalNotes)
    setStoreId(sourcePR.store_id || '')
    setProcurementSource(sourcePR.procurement_source || 'supplier')
    setBuScope(sourcePR.bu_scope || 'within_bu')
    setFromStoreId(sourcePR.from_store_id || sourcePR.store_id || '')
    setToStoreId(sourcePR.to_store_id || sourcePR.store_id || '')
    setHeaderSupplierId(sourcePR.header_supplier_id || '')
    setApproverMessage(sourcePR.approver_message || '')
    const approvals = [...(sourcePR.approvals ?? [])].sort((a, b) => a.level - b.level)
    setPrimaryApproverId(approvals.find(a => a.level === 1)?.approver_id || '')
    setSecondaryApproverId(approvals.find(a => a.level === 2)?.approver_id || '')
    setItems(prToCopyItemRows(sourcePR))
    const first = sourcePR.items?.[0]
    setDest(poDestinationFromLine(
      { plant_id: first?.plant_id, storage_location_id: first?.storage_location_id },
      sourcePR.store_id || '',
    ))
    setFormLoaded(true)
  }, [sourcePR, formLoaded])

  // Back-fill cost centers when loaded after the edit data ─────────────────

  useEffect(() => {
    if (!sourcePR || !activeCostCenters.length) return
    const dept = sourcePR.department
    if (!dept) return
    setItems(prev => prev.map(it => {
      if (it.cost_center_id) return it
      const match = activeCostCenters.find(cc => `${cc.code} · ${cc.name}` === dept)
      return match ? { ...it, cost_center_id: match.id } : it
    }))
  }, [sourcePR, activeCostCenters])

  // Default store on create ─────────────────────────────────────────────────

  useEffect(() => {
    if (isEditMode) return
    if (defaultStoreId && !storeId) {
      setStoreId(defaultStoreId)
      setFromStoreId(defaultStoreId)
      setDest(d => (d.storeId ? d : emptyPoDestination(defaultStoreId)))
    }
  }, [defaultStoreId, storeId, isEditMode])

  // Session-storage copy-from (page layout, create mode) ────────────────────

  const applyCopiedPr = useCallback((pr: PurchaseRequisition) => {
    const { title: t, internalNotes } = parsePrTitleNotes(pr.notes)
    setTitle(t || pr.title || '')
    setNotes(internalNotes)
    if (pr.store_id) {
      setStoreId(pr.store_id)
      setFromStoreId(pr.from_store_id || pr.store_id)
      setToStoreId(pr.to_store_id || pr.store_id)
    }
    setProcurementSource(pr.procurement_source || 'supplier')
    setBuScope(pr.bu_scope || 'within_bu')
    setHeaderSupplierId(pr.header_supplier_id || '')
    setApproverMessage(pr.approver_message || '')
    setItems(prToCopyItemRows(pr))
    const first = pr.items?.[0]
    setDest(poDestinationFromLine(
      { plant_id: first?.plant_id, storage_location_id: first?.storage_location_id },
      pr.store_id || storeId || defaultStoreId,
    ))
    setCopiedFromNumber(pr.pr_number)
    toast.success(`Copied from ${pr.pr_number}. A new PR number is assigned when you save.`)
  }, [storeId, defaultStoreId])

  useEffect(() => {
    if (layout !== 'page' || isEditMode) return
    const id = sessionStorage.getItem(PR_COPY_FROM_ID_KEY)
    if (!id) return
    sessionStorage.removeItem(PR_COPY_FROM_ID_KEY)
    vendorApi.getRequisition(id)
      .then(pr => applyCopiedPr(pr as PurchaseRequisition))
      .catch(() => toast.error('Could not copy that purchase requisition'))
  }, [applyCopiedPr, layout, isEditMode])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSourceChange = (source: ProcurementSource) => {
    setProcurementSource(source)
    if (source === 'internal') {
      setHeaderSupplierId('')
      setBuScope('within_bu')
      setFromStoreId(storeId)
      setToStoreId(storeId)
    } else {
      setFromStoreId('')
      setToStoreId('')
    }
  }

  const handleScopeChange = (scope: BUScope) => {
    setBuScope(scope)
    if (scope === 'within_bu') { setFromStoreId(storeId); setToStoreId(storeId) }
    else { setFromStoreId(storeId); setToStoreId('') }
  }

  const handleStoreChange = (id: string) => {
    setStoreId(id)
    setDest(d => ({ ...d, storeId: id, scope: { kind: '' }, storageLocationId: '' }))
    if (procurementSource === 'internal' && buScope === 'within_bu') {
      setFromStoreId(id); setToStoreId(id)
    } else if (procurementSource === 'internal' && buScope === 'cross_bu' && !fromStoreId) {
      setFromStoreId(id)
    }
  }

  const handleDestChange = (next: PoDestinationValue) => {
    setDest(next)
    if (next.storeId && next.storeId !== storeId) {
      setStoreId(next.storeId)
      if (procurementSource === 'internal' && buScope === 'within_bu') {
        setFromStoreId(next.storeId); setToStoreId(next.storeId)
      }
    }
  }

  const handleSuggestDestination = useCallback((plantId: string, storageLocationId?: string) => {
    setDest(prev => {
      if (prev.scope.kind === 'plant' && prev.scope.id) return prev
      return poDestinationFromLine(
        { plant_id: plantId, storage_location_id: storageLocationId },
        prev.storeId || storeId || defaultStoreId,
      )
    })
  }, [storeId, defaultStoreId])

  const addItem = () => setItems(prev => [...prev, emptyItem()])

  const removeItem = (i: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== i))
    setCollapsedLineIndexes(prev => {
      const next = new Set<number>()
      for (const idx of prev) {
        if (idx === i) continue
        next.add(idx > i ? idx - 1 : idx)
      }
      return next
    })
  }

  const toggleLineExpanded = (i: number) => {
    setCollapsedLineIndexes(prev => {
      const next = new Set(prev)
      if (next.has(i)) { next.delete(i) } else { next.add(i) }
      return next
    })
  }

  const updateItem = (i: number, field: keyof ItemRow, value: string | number) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))
    setLineFieldError(prev => (prev?.lineIndex === i && prev.field === field ? null : prev))
  }

  const patchItem = useCallback((i: number, patch: Partial<ItemRow>) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it))
    setLineFieldError(prev => {
      if (!prev || prev.lineIndex !== i) return prev
      return prev.field in patch ? null : prev
    })
  }, [])

  // ── Totals ────────────────────────────────────────────────────────────────

  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.estimated_price) || 0), 0)
  const taxTotal = items.reduce((s, i) => {
    const lineTotal = (Number(i.quantity) || 0) * (Number(i.estimated_price) || 0)
    return s + resolveLineTax(lineTotal, i.tax_code, taxCodeMap, false).amount
  }, 0)
  const grandTotal = subtotal + taxTotal

  // ── Validation ────────────────────────────────────────────────────────────

  const validateDraft = () => {
    if (!storeId) { toast.error('Select a business unit'); return false }
    if (!items.filter(it => isItemValid(it)).length) {
      toast.error('Complete at least one line item to save a draft'); return false
    }
    return true
  }

  const validateSubmit = () => {
    if (!storeId) { toast.error('Select a business unit in Header Details'); return false }
    if (!items.length) { toast.error('Add at least one line item'); return false }
    const lineIssue = findFirstPrSubmitLineIssue(items)
    if (lineIssue) {
      toast.error(lineIssue.message, { duration: 7000 })
      setLineFieldError({ lineIndex: lineIssue.lineIndex, field: lineIssue.field })
      setCollapsedLineIndexes(prev => { const n = new Set(prev); n.delete(lineIssue.lineIndex); return n })
      return false
    }
    if (procurementSource === 'internal' && buScope === 'cross_bu') {
      if (!fromStoreId || !toStoreId) { toast.error('Select both From BU and To BU for cross-BU requisitions'); return false }
      if (fromStoreId === toStoreId) { toast.error('From BU and To BU must be different'); return false }
    }
    if (secondaryApproverId && secondaryApproverId === primaryApproverId) {
      toast.error('Secondary approver must be different from primary approver'); return false
    }
    setLineFieldError(null)
    return true
  }

  // ── Build payload ─────────────────────────────────────────────────────────

  const buildPayload = (forSubmit: boolean) => {
    const firstItem = items[0]
    const selectedCostCenter = activeCostCenters.find(cc => cc.id === firstItem?.cost_center_id)
    const requiredDate = items.map(it => it.needed_by_date).filter(Boolean).sort()[0]
    const noteParts = [title.trim(), notes.trim()].filter(Boolean)
    const validItems = items.filter(it => isItemValid(it))
    const destPayload = poDestinationToPayload(dest)
    const approvers = primaryApproverId
      ? [{ approver_id: primaryApproverId, level: 1 }, ...(secondaryApproverId ? [{ approver_id: secondaryApproverId, level: 2 }] : [])]
      : []
    return {
      requisition_type: firstItem?.item_type || 'product',
      department: selectedCostCenter ? `${selectedCostCenter.code} · ${selectedCostCenter.name}` : undefined,
      priority: firstItem?.priority || 'medium',
      required_date: requiredDate || undefined,
      store_id: storeId || dest.storeId || undefined,
      procurement_source: procurementSource,
      bu_scope: procurementSource === 'internal' ? buScope : undefined,
      from_store_id: procurementSource === 'internal' && buScope === 'cross_bu' ? fromStoreId : storeId,
      to_store_id: procurementSource === 'internal' ? (buScope === 'cross_bu' ? toStoreId : storeId) : undefined,
      header_supplier_id: procurementSource === 'supplier' ? headerSupplierId || undefined : undefined,
      notes: noteParts.length ? noteParts.join('\n\n') : undefined,
      approver_message: approverMessage.trim() || undefined,
      approvers: forSubmit ? approvers : (approvers.length ? approvers : []),
      items: validItems.map(it => ({
        item_type: it.item_type,
        product_id: ['product', 'consumption'].includes(it.item_type) ? it.reference_id : undefined,
        service_id: it.item_type === 'service' ? it.reference_id : undefined,
        variant_id: it.variant_id || undefined,
        description: ['asset', 'other'].includes(it.item_type) ? it.description : undefined,
        asset_category_id: it.item_type === 'asset' && it.reference_id ? it.reference_id : undefined,
        quantity: Number(it.quantity),
        unit_of_measure: it.uom,
        estimated_price: it.item_type === 'consumption' ? undefined : (it.estimated_price ? Number(it.estimated_price) : undefined),
        needed_by_date: it.needed_by_date || undefined,
        plant_id: destPayload.plant_id,
        storage_location_id: destPayload.storage_location_id,
        tax_code: it.tax_code || undefined,
        notes: buildItemNotes(it),
      })),
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  const saving = createPR.isPending || updatePR.isPending || submitPR.isPending

  const handleSave = async (submitAfter: boolean) => {
    if (submitAfter ? !validateSubmit() : !validateDraft()) return
    const payload = buildPayload(submitAfter)
    const alreadyOpenOrSubmitted = editingPR && ['open', 'submitted'].includes(editingPR.status)
    try {
      let prId = editingPR?.id
      let prNumber = editingPR?.pr_number
      if (editingPR) {
        const updated = await updatePR.mutateAsync({ id: editingPR.id, data: payload }) as PurchaseRequisition
        prNumber = updated?.pr_number || editingPR.pr_number
        toast.success(submitAfter && !alreadyOpenOrSubmitted
          ? actionDocMessage('Requisition', prNumber, 'updated')
          : actionDocMessage('Requisition', prNumber, 'changes saved'))
      } else {
        const created = await createPR.mutateAsync(payload) as PurchaseRequisition
        prId = created.id
        prNumber = created.pr_number
        toast.success(submitAfter
          ? createdDocMessage('Requisition', prNumber)
          : actionDocMessage('Requisition', prNumber, 'saved as draft'))
      }
      if (submitAfter && prId && !alreadyOpenOrSubmitted) {
        const result = await submitPR.mutateAsync(prId) as PurchaseRequisition
        toast.success(
          result?.status === 'open'
            ? actionDocMessage('Requisition', result?.pr_number || prNumber, 'opened — no approval required')
            : actionDocMessage('Requisition', result?.pr_number || prNumber, 'submitted for approval'),
        )
      }
      onSuccess()
    } catch { /* hooks show error toast */ }
  }

  const handleSubmit = () => { void handleSave(true) }
  const handleSaveDraft = () => { void handleSave(false) }

  // ── Copy-from handler ─────────────────────────────────────────────────────

  const handleCopyFromNumber = async (number: string) => {
    if (isEditMode) return
    setCopyLoading(true)
    try {
      const pr = await vendorApi.lookupRequisition(number) as PurchaseRequisition
      applyCopiedPr(pr)
    } catch (err) {
      toast.error(extractApiError(err, 'No purchase requisition found with that number'))
      throw err
    } finally {
      setCopyLoading(false)
    }
  }

  // ── Dirty / guard ─────────────────────────────────────────────────────────

  const isDirty = !!(
    title.trim() || notes.trim() || primaryApproverId || secondaryApproverId ||
    approverMessage.trim() || items.some(i => i.reference_id || i.description.trim() || i.notes.trim())
  ) || isEditMode

  const { handleClose, confirmOpen, cancelConfirm, forceClose } = useGuardedClose(onCancel, isDirty)

  // ── Shared field sections ─────────────────────────────────────────────────

  const submitLabel = isEditMode
    ? (editingPR && ['open', 'submitted'].includes(editingPR.status)
        ? 'Save Changes'
        : primaryApproverId ? 'Submit for Approval' : 'Open Requisition')
    : (primaryApproverId ? 'Create & Submit' : 'Create & Open')

  const headerSection = (
    <div className="grid grid-cols-12 gap-x-4 gap-y-3">
      <div className="col-span-12 sm:col-span-6 lg:col-span-4">
        {layout === 'page' ? <FL>Title / Purpose</FL> : <Label className="text-[11px] leading-tight text-gray-500">Title / Purpose</Label>}
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Office stationery Q3"
          className={layout === 'page' ? 'h-8 w-full rounded-md border-gray-200 text-sm' : 'mt-0.5 h-8 text-xs py-0 px-2.5'}
        />
      </div>
      <ProcurementPRHeaderFields
        inline
        storeId={storeId}
        procurementSource={procurementSource}
        buScope={buScope}
        fromStoreId={fromStoreId}
        toStoreId={toStoreId}
        headerSupplierId={headerSupplierId}
        stores={activeStores}
        storesLoading={storesLoading}
        onStoreChange={handleStoreChange}
        onSourceChange={handleSourceChange}
        onScopeChange={handleScopeChange}
        onFromStoreChange={id => { setFromStoreId(id); if (toStoreId === id) setToStoreId('') }}
        onToStoreChange={setToStoreId}
        onHeaderSupplierChange={setHeaderSupplierId}
      />
    </div>
  )

  const destinationSection = (
    <PoDestinationFields value={dest} onChange={handleDestChange} compact={layout === 'modal'} />
  )

  const lineItemsSection = (
    <>
      {!costCentersLoading && activeCostCenters.length === 0 && (
        <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-5 py-2 text-xs text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          No cost centers configured — add them under Finance → Cost Centers.
        </div>
      )}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {items.map((item, i) => (
          <ProcurementLineItemForm
            key={i}
            item={item}
            lineNumber={i + 1}
            canRemove={items.length > 1}
            expanded={!collapsedLineIndexes.has(i)}
            onToggleExpand={() => toggleLineExpanded(i)}
            costCenters={activeCostCenters}
            costCentersLoading={costCentersLoading}
            storeId={storeId || defaultStoreId}
            destinationPlantId={dest.scope.kind === 'plant' ? dest.scope.id : null}
            onSuggestDestination={handleSuggestDestination}
            onChange={(field, value) => updateItem(i, field, value)}
            onPatch={patch => patchItem(i, patch)}
            onRemove={() => removeItem(i)}
            errorField={lineFieldError?.lineIndex === i ? lineFieldError.field : null}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-gray-100 bg-gray-50/80 px-5 py-2.5 dark:border-gray-700 dark:bg-gray-800/40">
        <button type="button" onClick={addItem}
          className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700">
          <Plus className="h-3 w-3" /> Add another line
        </button>
        <div className="flex flex-col items-end gap-0 text-sm leading-5">
          <div className="flex items-center justify-end gap-3">
            <span className="text-xs font-medium text-gray-500">Subtotal</span>
            <span className="min-w-[6.5rem] text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-end gap-3">
            <span className="text-xs font-medium text-gray-500">Tax</span>
            <span className="min-w-[6.5rem] text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(taxTotal)}</span>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-0.5 dark:border-gray-700">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Total</span>
            <span className="min-w-[6.5rem] text-right font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>
    </>
  )

  const approvalSection = (
    <>
      {!primaryApproverId && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
          <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Select a <strong>Primary Approver</strong> to route this requisition for approval.
            Leave blank to open it directly without an approval workflow.
          </span>
        </div>
      )}
      <div className="grid grid-cols-12 gap-x-4 gap-y-3">
        <ProcurementApproverFields
          inline
          primaryApproverId={primaryApproverId}
          secondaryApproverId={secondaryApproverId}
          approverMessage={approverMessage}
          onPrimaryChange={id => { setPrimaryApproverId(id); if (id === secondaryApproverId) setSecondaryApproverId('') }}
          onSecondaryChange={setSecondaryApproverId}
          onMessageChange={setApproverMessage}
        />
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          {layout === 'page' ? <FL>Internal Notes</FL> : <Label className="text-[11px] leading-tight text-gray-500">Internal Notes</Label>}
          <Input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any internal notes…"
            className={layout === 'page' ? 'h-8 w-full rounded-md border-gray-200 text-sm' : 'mt-0.5 h-8 text-xs py-0 px-2.5'}
          />
        </div>
      </div>
    </>
  )

  const confirmDialog = (
    <ConfirmDialog
      open={confirmOpen}
      title="Discard changes?"
      description={layout === 'page'
        ? 'You have unsaved input. Leave anyway and lose your changes?'
        : 'You have unsaved input. Close anyway and lose your changes?'}
      confirmLabel={layout === 'page' ? 'Discard & Leave' : 'Discard & Close'}
      cancelLabel="Keep editing"
      variant="warning"
      onCancel={cancelConfirm}
      onConfirm={forceClose}
    />
  )

  // ── Page layout ───────────────────────────────────────────────────────────

  if (layout === 'page') {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-[#f5f6f7] dark:bg-gray-950">
        {/* Sticky top action bar */}
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
            <h1 className="flex items-center gap-2 truncate text-base font-semibold text-gray-900 dark:text-gray-100">
              <ClipboardList className="h-4 w-4 shrink-0 text-blue-600" />
              {copiedFromNumber ? `Copy of ${copiedFromNumber}` : 'New Purchase Requisition'}
            </h1>
            <p className="text-[11px] text-gray-400">
              {copiedFromNumber
                ? `Copied from ${copiedFromNumber} — a new PR number is assigned on save`
                : 'Fill in header details and line items, then save as draft or submit for approval'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <CopyFromDocumentField
              placeholder="Search PR number or title…"
              onCopy={handleCopyFromNumber}
              loading={copyLoading}
              copiedFrom={copiedFromNumber}
              suggestions={copySuggestions}
              suggestionsLoading={copyDocsLoading}
            />
            <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={saving}
              className="h-8 rounded-full border-gray-300 px-4 text-xs font-medium text-gray-600">
              Cancel
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={handleSaveDraft} disabled={saving}
              className="h-8 rounded-full px-4 text-xs font-medium gap-1.5">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save Draft
            </Button>
            <Button type="button" size="sm" onClick={handleSubmit} disabled={saving}
              className="h-8 rounded-full px-5 text-xs font-semibold gap-1.5">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              {submitLabel}
            </Button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-auto px-3 py-4 sm:px-4 lg:px-5">
          <div className="w-full space-y-4">
            <Section title="Header Details">
              <div className="p-5 space-y-4">{headerSection}</div>
            </Section>

            <Section title="Destination / Plant">
              <div className="p-5">{destinationSection}</div>
            </Section>

            <Section
              title="Line Items *"
              action={
                <div className="flex items-center gap-2">
                  <LineItemsExpandAllActions
                    onExpandAll={() => setCollapsedLineIndexes(new Set())}
                    onCollapseAll={() => setCollapsedLineIndexes(new Set(items.map((_, i) => i)))}
                  />
                  <Button variant="outline" size="sm" onClick={addItem}
                    className="h-6 gap-1 rounded-full border-blue-200 px-3 text-[11px] text-blue-600 hover:bg-blue-50">
                    <Plus className="w-3 h-3" /> Add Item
                  </Button>
                </div>
              }
            >
              {lineItemsSection}
            </Section>

            <Section title="Approval Routing">
              <div className="p-5">{approvalSection}</div>
            </Section>

            <div className="h-4" />
          </div>
        </div>

        {confirmDialog}
      </div>
    )
  }

  // ── Modal layout ──────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <Card className="flex max-h-[92vh] w-[min(96vw,100rem)] flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            {editingPR ? `Edit ${editingPR.pr_number}` : 'New Purchase Requisition'}
          </h2>
          <Button variant="ghost" size="icon" onClick={handleClose}><X className="w-4 h-4" /></Button>
        </div>

        {/* Scrollable body */}
        <CardContent className="flex flex-col flex-1 min-h-0 p-5 gap-4 overflow-y-auto">
          {/* Header fields */}
          <div className="space-y-3 shrink-0">
            {headerSection}
            <div className="rounded-md border border-gray-200 bg-gray-50/60 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/30">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-400">
                Destination / Plant
              </p>
              {destinationSection}
            </div>
          </div>

          {/* Line items */}
          <div className="shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm text-gray-800 dark:text-gray-200">Line Items</h3>
              <div className="flex items-center gap-2">
                <LineItemsExpandAllActions
                  onExpandAll={() => setCollapsedLineIndexes(new Set())}
                  onCollapseAll={() => setCollapsedLineIndexes(new Set(items.map((_, i) => i)))}
                />
                <Button variant="outline" size="sm" onClick={addItem} className="gap-1.5 h-8 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </Button>
              </div>
            </div>
            <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
              {lineItemsSection}
            </div>
          </div>

          {/* Approval routing */}
          <div className="shrink-0">
            <h3 className="font-medium text-sm text-gray-800 dark:text-gray-200 mb-2">Approval Routing</h3>
            {approvalSection}
          </div>
        </CardContent>

        {/* Footer actions */}
        <div className="flex justify-end gap-2.5 px-5 py-3.5 border-t shrink-0">
          {!isEditMode && (
            <CopyFromDocumentField
              placeholder="Search PR number or title…"
              onCopy={handleCopyFromNumber}
              loading={copyLoading}
              copiedFrom={copiedFromNumber}
              suggestions={copySuggestions}
              suggestionsLoading={copyDocsLoading}
            />
          )}
          <Button variant="outline" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button variant="secondary" onClick={handleSaveDraft} disabled={saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Draft
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </Card>
      {confirmDialog}
    </div>
  )
}
