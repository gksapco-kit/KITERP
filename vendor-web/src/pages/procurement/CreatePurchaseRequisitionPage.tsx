import { useState, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateRequisition, useSubmitRequisition, useStores } from '@/hooks/useVendor'
import { useCostCenters } from '@/hooks/useFinance'
import type { CostCenter } from '@/types/finance'
import { ProcurementLineItemForm } from '@/components/procurement/ProcurementLineItemForm'
import { ProcurementApproverFields } from '@/components/procurement/ProcurementApproverFields'
import {
  ProcurementPRHeaderFields,
  type ProcurementSource,
  type BUScope,
} from '@/components/procurement/ProcurementPRHeaderFields'
import {
  emptyItem,
  isItemValid,
  buildItemNotes,
  type ItemRow,
} from '@/components/procurement/procurementLineItemTypes'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useGuardedClose } from '@/hooks/useGuardedClose'
import { PR_FROM_INVENTORY_KEY, type InventoryAlertPrefill } from '@/lib/prToPoPrefill'
import { toast } from 'sonner'
import {
  ArrowLeft, Loader2, Plus, ClipboardList, Send, AlertCircle,
  Save, UserCheck,
} from 'lucide-react'

// ─── Fiori-style section wrapper ────────────────────────────────────────────────
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

// ─── Fiori-style field label ─────────────────────────────────────────────────
function FL({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 select-none">
      {children}
    </p>
  )
}

export default function CreatePurchaseRequisitionPage() {
  const navigate = useNavigate()
  const createPR = useCreateRequisition()
  const submitPR = useSubmitRequisition()
  const { data: costCenters = [], isLoading: costCentersLoading } = useCostCenters()
  const { data: storesData, isLoading: storesLoading } = useStores()

  const activeStores = useMemo(
    () => (storesData?.stores ?? []).filter((s: any) => s.is_active !== false),
    [storesData?.stores],
  )
  const defaultStoreId = useMemo(
    () => activeStores.find((s: any) => s.is_default)?.id ?? activeStores[0]?.id ?? '',
    [activeStores],
  )
  const activeCostCenters = useMemo(
    () => (costCenters as CostCenter[]).filter(cc => cc.is_active),
    [costCenters],
  )

  const [inventoryPrefill, setInventoryPrefill] = useState<InventoryAlertPrefill | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem(PR_FROM_INVENTORY_KEY)
    if (!raw) return
    sessionStorage.removeItem(PR_FROM_INVENTORY_KEY)
    try { setInventoryPrefill(JSON.parse(raw)) } catch { /* ignore */ }
  }, [])

  // ── Form state ────────────────────────────────────────────────────────────────
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
  const [items, setItems] = useState<ItemRow[]>([emptyItem()])
  const [expandedItems, setExpandedItems] = useState<Set<number>>(() => new Set([0]))

  useEffect(() => {
    if (!inventoryPrefill) return
    const sourceLabel = inventoryPrefill.source === 'reorder' ? 'Reorder alert' : 'Low stock alert'
    setTitle(`${sourceLabel}: ${inventoryPrefill.productName}`)
    if (inventoryPrefill.storeId) { setStoreId(inventoryPrefill.storeId); setFromStoreId(inventoryPrefill.storeId) }
    setItems([{ ...emptyItem('product'), reference_id: inventoryPrefill.productId, variant_id: inventoryPrefill.variantId || '', quantity: inventoryPrefill.quantity, description: inventoryPrefill.productName }])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryPrefill])

  useEffect(() => {
    if (defaultStoreId && !storeId) { setStoreId(defaultStoreId); setFromStoreId(defaultStoreId) }
  }, [defaultStoreId, storeId])

  const handleSourceChange = (source: ProcurementSource) => {
    setProcurementSource(source)
    if (source === 'internal') { setHeaderSupplierId(''); setBuScope('within_bu'); setFromStoreId(storeId); setToStoreId(storeId) }
    else { setFromStoreId(''); setToStoreId('') }
  }

  const handleScopeChange = (scope: BUScope) => {
    setBuScope(scope)
    if (scope === 'within_bu') { setFromStoreId(storeId); setToStoreId(storeId) }
    else { setFromStoreId(storeId); setToStoreId('') }
  }

  const handleStoreChange = (id: string) => {
    setStoreId(id)
    if (procurementSource === 'internal' && buScope === 'within_bu') { setFromStoreId(id); setToStoreId(id) }
    else if (procurementSource === 'internal' && buScope === 'cross_bu' && !fromStoreId) setFromStoreId(id)
  }

  const toggleExpand = (i: number) => {
    setExpandedItems(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next })
  }

  const addItem = () => {
    setItems(prev => {
      const nextIndex = prev.length
      setExpandedItems(exp => new Set([...exp, nextIndex]))
      return [...prev, emptyItem()]
    })
  }

  const removeItem = (i: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== i))
    setExpandedItems(prev => {
      const next = new Set<number>()
      prev.forEach(idx => { if (idx < i) next.add(idx); else if (idx > i) next.add(idx - 1) })
      if (next.size === 0) next.add(0)
      return next
    })
  }

  const updateItem = (i: number, field: keyof ItemRow, value: string | number) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))

  const patchItem = useCallback((i: number, patch: Partial<ItemRow>) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it)), [])

  const validateDraft = () => {
    if (!storeId) { toast.error('Select a business unit'); return false }
    if (!items.filter(it => isItemValid(it)).length) { toast.error('Complete at least one line item to save a draft'); return false }
    return true
  }

  const validateSubmit = () => {
    const validItems = items.filter(it => isItemValid(it))
    if (!validItems.length) { toast.error('Complete at least one line item (product, service, or description)'); return false }
    if (items.some(it => !isItemValid(it))) { toast.error('Each line item must be completed'); return false }
    if (items.some(it => !it.cost_center_id)) { toast.error('Select a cost center for each line item'); return false }
    if (!storeId) { toast.error('Select a business unit'); return false }
    if (procurementSource === 'internal' && buScope === 'cross_bu') {
      if (!fromStoreId || !toStoreId) { toast.error('Select both From BU and To BU for cross-BU requisitions'); return false }
      if (fromStoreId === toStoreId) { toast.error('From BU and To BU must be different'); return false }
    }
    if (secondaryApproverId && secondaryApproverId === primaryApproverId) { toast.error('Secondary approver must be different from primary approver'); return false }
    return true
  }

  const buildPayload = (forSubmit: boolean) => {
    const firstItem = items[0]
    const selectedCostCenter = activeCostCenters.find(cc => cc.id === firstItem?.cost_center_id)
    const requiredDate = items.map(it => it.needed_by_date).filter(Boolean).sort()[0]
    const noteParts = [title.trim(), notes.trim()].filter(Boolean)
    const validItems = items.filter(it => isItemValid(it))
    const approvers = primaryApproverId
      ? [{ approver_id: primaryApproverId, level: 1 }, ...(secondaryApproverId ? [{ approver_id: secondaryApproverId, level: 2 }] : [])]
      : []
    return {
      requisition_type: firstItem?.item_type || 'product',
      department: selectedCostCenter ? `${selectedCostCenter.code} · ${selectedCostCenter.name}` : undefined,
      priority: firstItem?.priority || 'medium',
      required_date: requiredDate || undefined,
      store_id: storeId || undefined,
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
        plant_id: it.plant_id || undefined,
        storage_location_id: it.storage_location_id || undefined,
        notes: buildItemNotes(it),
      })),
    }
  }

  const saving = createPR.isPending || submitPR.isPending

  const handleSave = async (submitAfter: boolean) => {
    if (submitAfter ? !validateSubmit() : !validateDraft()) return
    const payload = buildPayload(submitAfter)
    try {
      const created = await createPR.mutateAsync(payload) as { id?: string; status?: string }
      const prId = created.id
      if (!submitAfter) toast.success('Draft saved')
      if (submitAfter && prId) {
        const result = await submitPR.mutateAsync(prId) as { status?: string }
        toast.success(result?.status === 'open' ? 'Requisition opened — no approval required' : 'Submitted for approval')
      }
      navigate('/procurement/requisitions')
    } catch { /* hook shows error toast */ }
  }

  const handleSubmit = () => void handleSave(true)
  const handleSaveDraft = () => void handleSave(false)

  const isDirty = !!(
    title.trim() || notes.trim() || primaryApproverId || secondaryApproverId ||
    approverMessage.trim() || items.some(i => i.reference_id || i.description.trim() || i.notes.trim())
  )

  const goBack = useCallback(() => navigate('/procurement/requisitions'), [navigate])
  const { handleClose, confirmOpen, cancelConfirm, forceClose } = useGuardedClose(goBack, isDirty)

  const submitLabel = primaryApproverId ? 'Create & Submit' : 'Create & Open'

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
          <h1 className="flex items-center gap-2 truncate text-base font-semibold text-gray-900 dark:text-gray-100">
            <ClipboardList className="h-4 w-4 shrink-0 text-blue-600" />
            New Purchase Requisition
          </h1>
          <p className="text-[11px] text-gray-400">
            Fill in header details and line items, then save as draft or submit for approval
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
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

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-5 py-5 md:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl space-y-4">

          {/* ══ HEADER DETAILS ═════════════════════════════════════════════ */}
          <Section title="Header Details">
            <div className="p-5 space-y-4">
              {/* 12-col grid — child components emit col-span-* classes into this grid */}
              <div className="grid grid-cols-12 gap-x-4 gap-y-3">
                <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                  <FL>Title / Purpose</FL>
                  <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Office stationery Q3"
                    className="h-8 w-full rounded-md border-gray-200 text-sm"
                  />
                </div>

                {/* PR header fields (BU, source, scope) injected inline */}
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

            </div>
          </Section>

          {/* ══ LINE ITEMS ═════════════════════════════════════════════════ */}
          <Section
            title="Line Items *"
            action={
              <Button variant="outline" size="sm" onClick={addItem}
                className="h-6 gap-1 rounded-full border-blue-200 px-3 text-[11px] text-blue-600 hover:bg-blue-50">
                <Plus className="w-3 h-3" /> Add Item
              </Button>
            }
          >
            {/* No cost center warning */}
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
                  expanded={expandedItems.has(i)}
                  onToggleExpand={() => toggleExpand(i)}
                  costCenters={activeCostCenters}
                  costCentersLoading={costCentersLoading}
                  storeId={storeId || defaultStoreId}
                  onChange={(field, value) => updateItem(i, field, value)}
                  onPatch={patch => patchItem(i, patch)}
                  onRemove={() => removeItem(i)}
                />
              ))}
            </div>

            {/* Footer: add link */}
            <div className="border-t border-gray-100 bg-gray-50/80 px-5 py-2.5 dark:border-gray-700 dark:bg-gray-800/40">
              <button type="button" onClick={addItem}
                className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700">
                <Plus className="h-3 w-3" /> Add another line
              </button>
            </div>
          </Section>

          {/* ══ APPROVAL ROUTING ═══════════════════════════════════════════ */}
          <Section title="Approval Routing">
            <div className="p-5">
              {/* Info hint when no approver selected */}
              {!primaryApproverId && (
                <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
                  <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Select a <strong>Primary Approver</strong> to route this requisition for approval.
                    Leave blank to open it directly without an approval workflow.
                  </span>
                </div>
              )}
              {/* 12-col grid — matches the col-span-* scheme used by ProcurementApproverFields inline */}
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
                  <FL>Internal Notes</FL>
                  <Input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Any internal notes…"
                    className="h-8 w-full rounded-md border-gray-200 text-sm"
                  />
                </div>
              </div>
            </div>
          </Section>

          <div className="h-4" />
        </div>
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
