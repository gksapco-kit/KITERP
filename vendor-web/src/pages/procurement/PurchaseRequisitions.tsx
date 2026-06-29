import { useState, useMemo, useCallback, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { ResizableTable } from '@/components/table/ResizableTable'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useCostCenters } from '@/hooks/useFinance'
import type { CostCenter } from '@/types/finance'
import {
  useRequisitions, useRequisition, useCreateRequisition, useUpdateRequisition, useSubmitRequisition,
  useApproveRequisition, useCancelRequisition, useMyMembership, useStores,
} from '@/hooks/useVendor'
import { ProcurementLineItemForm } from '@/components/procurement/ProcurementLineItemForm'
import { ProcurementApproverFields } from '@/components/procurement/ProcurementApproverFields'
import {
  ProcurementPRHeaderFields,
  type ProcurementSource,
  type BUScope,
} from '@/components/procurement/ProcurementPRHeaderFields'
import {
  type RequisitionType,
  type ItemRow,
  emptyItem,
  itemTypeLabel,
  isItemValid,
  buildItemNotes,
} from '@/components/procurement/procurementLineItemTypes'
import { formatDate, formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import type { PurchaseRequisition, PurchaseRequisitionItem } from '@/types'
import {
  Loader2, Plus, X, ClipboardList, CheckCircle, XCircle, Send, Pencil,
} from 'lucide-react'

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  draft:               { bg: 'bg-gray-100 dark:bg-gray-800',       text: 'text-gray-700 dark:text-gray-300',   label: 'Draft' },
  submitted:           { bg: 'bg-blue-50 dark:bg-blue-950/50',     text: 'text-blue-700 dark:text-blue-300',   label: 'Submitted' },
  approved:            { bg: 'bg-green-50 dark:bg-green-950/50',   text: 'text-green-700 dark:text-green-300', label: 'Approved' },
  rejected:            { bg: 'bg-red-50 dark:bg-red-950/50',       text: 'text-red-700 dark:text-red-300',     label: 'Rejected' },
  partially_converted: { bg: 'bg-amber-50 dark:bg-amber-950/50',   text: 'text-amber-700 dark:text-amber-300', label: 'Partial' },
  converted:           { bg: 'bg-purple-50 dark:bg-purple-950/50', text: 'text-purple-700 dark:text-purple-300', label: 'Converted' },
  cancelled:           { bg: 'bg-red-50 dark:bg-red-950/50',       text: 'text-red-700 dark:text-red-300',     label: 'Cancelled' },
}

const PRIORITY_BADGE: Record<string, string> = {
  low:    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  high:   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

const STATUSES = ['', 'draft', 'submitted', 'approved', 'rejected', 'partially_converted', 'converted', 'cancelled']

function itemDisplayName(item: PurchaseRequisition['items'][number]): string {
  if (item.product_name) return item.product_name
  if (item.service_name) return item.service_name
  if (item.description) return item.description
  return item.product_id ? item.product_id.slice(0, 8) : '—'
}

const APPROVAL_STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  skipped: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

function PRDetailPanel({ pr: initialPr, onClose, onEdit }: { pr: PurchaseRequisition; onClose: () => void; onEdit?: (pr: PurchaseRequisition) => void }) {
  const { data: fetchedPr, isLoading: prLoading } = useRequisition(initialPr.id)
  const pr = fetchedPr ?? initialPr

  const submitPR = useSubmitRequisition()
  const approvePR = useApproveRequisition()
  const cancelPR = useCancelRequisition()
  const { data: myMembership } = useMyMembership()
  const [approvalRemarks, setApprovalRemarks] = useState('')

  const pendingStep = [...(pr.approvals ?? [])]
    .filter(a => a.status === 'pending')
    .sort((a, b) => a.level - b.level)[0]
  const canActAsApprover = pr.status === 'submitted'
    && pendingStep
    && (!pendingStep.approver_id || pendingStep.approver_id === myMembership?.id)

  const handleApprove = () => {
    approvePR.mutate({ id: pr.id, data: { status: 'approved', comments: approvalRemarks || undefined } })
  }
  const handleReject = () => {
    if (!approvalRemarks.trim()) { toast.error('Please enter rejection remarks'); return }
    approvePR.mutate({ id: pr.id, data: { status: 'rejected', comments: approvalRemarks } })
  }

  const badge = STATUS_BADGE[pr.status] ?? STATUS_BADGE.draft
  const totalEstimate = pr.items.reduce((s: number, i: PurchaseRequisitionItem) => s + (i.quantity * (i.estimated_price ?? 0)), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-2xl h-full bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div>
            <p className="text-xs text-gray-500 font-mono">{pr.pr_number}</p>
            <h2 className="text-lg font-semibold">{pr.title || 'Purchase Requisition'}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {prLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading requisition details…
            </div>
          )}
          {/* Header details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-gray-500">Business Unit</p><p className="font-medium">{pr.store_name || '—'}</p></div>
            <div><p className="text-gray-500">Source</p><p className="font-medium capitalize">{pr.procurement_source || 'supplier'}</p></div>
            {pr.procurement_source === 'supplier' && (
              <div><p className="text-gray-500">Supplier</p><p className="font-medium">{pr.header_supplier_name || '—'}</p></div>
            )}
            {pr.procurement_source === 'internal' && (
              <>
                <div><p className="text-gray-500">BU Movement</p><p className="font-medium">{pr.bu_scope === 'cross_bu' ? 'Cross BU' : 'Within BU'}</p></div>
                {pr.bu_scope === 'cross_bu' && (
                  <>
                    <div><p className="text-gray-500">From BU</p><p className="font-medium">{pr.from_store_name || '—'}</p></div>
                    <div><p className="text-gray-500">To BU</p><p className="font-medium">{pr.to_store_name || '—'}</p></div>
                  </>
                )}
              </>
            )}
            <div><p className="text-gray-500">Department</p><p className="font-medium">{pr.department || '—'}</p></div>
            <div><p className="text-gray-500">Priority</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[pr.priority] || ''}`}>{pr.priority}</span>
            </div>
            <div><p className="text-gray-500">Required By</p><p className="font-medium">{pr.required_date ? formatDate(pr.required_date) : '—'}</p></div>
            <div><p className="text-gray-500">Type</p><p className="font-medium">{itemTypeLabel(pr.requisition_type)}</p></div>
            <div><p className="text-gray-500">Submitted</p><p className="font-medium">{pr.submitted_at ? formatDate(pr.submitted_at) : '—'}</p></div>
            <div><p className="text-gray-500">Created</p><p className="font-medium">{formatDate(pr.created_at)}</p></div>
            <div><p className="text-gray-500">Est. Total</p><p className="font-semibold text-green-700">{formatCurrency(totalEstimate)}</p></div>
          </div>
          {pr.notes && <div className="bg-amber-50 dark:bg-amber-950/30 rounded p-3 text-sm text-amber-800 dark:text-amber-300">{pr.notes}</div>}

          {/* Approvers */}
          {(pr.approvals?.length ?? 0) > 0 && (
            <div>
              <h3 className="font-medium mb-2 text-sm text-gray-700">Approval Chain</h3>
              {pr.approver_message && (
                <div className="mb-2 rounded-lg border border-blue-100 bg-blue-50/60 dark:bg-blue-950/20 px-3 py-2 text-sm text-blue-900 dark:text-blue-200">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-0.5">Message from requester</p>
                  <p className="whitespace-pre-wrap">{pr.approver_message}</p>
                </div>
              )}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      {['Level', 'Approver', 'Status', 'Decision'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...(pr.approvals ?? [])].sort((a, b) => a.level - b.level).map(step => (
                      <tr key={step.id} className="border-t">
                        <td className="px-3 py-2 text-gray-500">{step.level}</td>
                        <td className="px-3 py-2 font-medium">{step.approver_name || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${APPROVAL_STATUS_BADGE[step.status] ?? ''}`}>
                            {step.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 text-xs">
                          {step.comments || step.remarks || '—'}
                          {(step.actioned_at || step.decided_at) && (
                            <span className="block text-gray-400 mt-0.5">
                              {formatDate(step.actioned_at || step.decided_at!)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Items */}
          <div>
            <h3 className="font-medium mb-2 text-sm text-gray-700">Items ({pr.items.length})</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    {['#', 'Description', 'Qty', 'UoM', 'Est. Price', 'Needed By'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pr.items.map((item: PurchaseRequisitionItem, idx: number) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium">
                        {itemDisplayName(item)}
                      </td>
                      <td className="px-3 py-2">{item.quantity} </td>
                      <td className="px-3 py-2 text-gray-500">{item.unit_of_measure || item.uom || 'PCS'}</td>
                      <td className="px-3 py-2">{item.estimated_price ? formatCurrency(item.estimated_price) : '—'}</td>
                      <td className="px-3 py-2 text-gray-500">{item.needed_by_date ? formatDate(item.needed_by_date) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Approval actions */}
          {pr.status === 'draft' && (
            <div className="flex gap-2">
              {onEdit && (
                <Button variant="outline" onClick={() => onEdit(pr)} className="gap-2">
                  <Pencil className="w-4 h-4" /> Edit
                </Button>
              )}
              <Button onClick={() => submitPR.mutate(pr.id, { onSuccess: () => toast.success('Submitted for approval') })} disabled={submitPR.isPending} className="gap-2">
                {submitPR.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                <Send className="w-4 h-4" /> Submit for Approval
              </Button>
              <Button variant="destructive" size="sm" onClick={() => cancelPR.mutate({ id: pr.id })}>Cancel PR</Button>
            </div>
          )}
          {pr.status === 'submitted' && canActAsApprover && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-medium text-sm">Approval Decision</h3>
              {pendingStep?.approver_name && (
                <p className="text-xs text-gray-500">
                  You are approving as <span className="font-medium text-gray-700">{pendingStep.approver_name}</span> (Level {pendingStep.level})
                </p>
              )}
              <div>
                <Label className="text-xs">Remarks</Label>
                <Input
                  placeholder="Enter remarks (required for rejection)"
                  value={approvalRemarks}
                  onChange={e => setApprovalRemarks(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleApprove} disabled={approvePR.isPending} className="gap-2 bg-green-600 hover:bg-green-700">
                  {approvePR.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <CheckCircle className="w-4 h-4" /> Approve
                </Button>
                <Button variant="destructive" onClick={handleReject} disabled={approvePR.isPending} className="gap-2">
                  <XCircle className="w-4 h-4" /> Reject
                </Button>
              </div>
            </div>
          )}
          {pr.status === 'submitted' && !canActAsApprover && pendingStep && (
            <div className="border-t pt-4 text-sm text-gray-500">
              Awaiting approval from <span className="font-medium text-gray-700">{pendingStep.approver_name || 'designated approver'}</span> (Level {pendingStep.level})
            </div>
          )}
          {['approved', 'partially_converted'].includes(pr.status) && (
            <div className="flex gap-2 border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => cancelPR.mutate({ id: pr.id })}>Cancel PR</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function parsePRNotes(notes?: string | null): { title: string; internalNotes: string } {
  if (!notes?.trim()) return { title: '', internalNotes: '' }
  const idx = notes.indexOf('\n\n')
  if (idx === -1) return { title: notes.trim(), internalNotes: '' }
  return { title: notes.slice(0, idx).trim(), internalNotes: notes.slice(idx + 2).trim() }
}

function prToItemRows(pr: PurchaseRequisition): ItemRow[] {
  if (!pr.items?.length) return [emptyItem()]
  return pr.items.map(it => {
    const itemType = (it.item_type || pr.requisition_type || 'product') as RequisitionType
    return {
      item_type: itemType,
      cost_center_id: '',
      priority: pr.priority || 'medium',
      reference_id: it.product_id || it.service_id || it.asset_category_id || '',
      variant_id: it.variant_id || '',
      description: it.description || '',
      quantity: it.quantity,
      uom: it.unit_of_measure || it.uom || 'PCS',
      estimated_price: it.estimated_price != null ? String(it.estimated_price) : '',
      needed_by_date: it.needed_by_date || '',
      notes: it.notes || '',
      plant_id: it.plant_id || '',
      storage_location_id: it.storage_location_id || '',
      service_period_from: '',
      service_period_to: '',
      asset_tag: '',
      account_assignment: '',
    }
  })
}

function PRFormModal({ editingPR, onClose }: { editingPR?: PurchaseRequisition | null; onClose: () => void }) {
  const createPR = useCreateRequisition()
  const updatePR = useUpdateRequisition()
  const submitPR = useSubmitRequisition()
  const { data: loadedPR } = useRequisition(editingPR?.id ?? null)
  const sourcePR = loadedPR ?? editingPR ?? null
  const { data: costCenters = [], isLoading: costCentersLoading } = useCostCenters()
  const { data: storesData, isLoading: storesLoading } = useStores()
  const activeStores = useMemo(
    () => (storesData?.stores ?? []).filter(s => s.is_active !== false),
    [storesData?.stores],
  )
  const defaultStoreId = useMemo(
    () => activeStores.find(s => s.is_default)?.id ?? activeStores[0]?.id ?? '',
    [activeStores],
  )

  const activeCostCenters = useMemo(
    () => (costCenters as CostCenter[]).filter(cc => cc.is_active),
    [costCenters],
  )

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
  const [formLoaded, setFormLoaded] = useState(!editingPR)

  useEffect(() => {
    if (!sourcePR || formLoaded) return
    const { title: parsedTitle, internalNotes } = parsePRNotes(sourcePR.notes)
    setTitle(parsedTitle)
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
    setItems(prToItemRows(sourcePR))
    setExpandedItems(new Set([0]))
    setFormLoaded(true)
  }, [sourcePR, formLoaded])

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

  useEffect(() => {
    if (editingPR) return
    if (defaultStoreId && !storeId) {
      setStoreId(defaultStoreId)
      setFromStoreId(defaultStoreId)
    }
  }, [defaultStoreId, storeId, editingPR])

  useEscapeToClose(onClose, true)

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
    if (scope === 'within_bu') {
      setFromStoreId(storeId)
      setToStoreId(storeId)
    } else {
      setFromStoreId(storeId)
      setToStoreId('')
    }
  }

  const handleStoreChange = (id: string) => {
    setStoreId(id)
    if (procurementSource === 'internal' && buScope === 'within_bu') {
      setFromStoreId(id)
      setToStoreId(id)
    } else if (procurementSource === 'internal' && buScope === 'cross_bu' && !fromStoreId) {
      setFromStoreId(id)
    }
  }

  const toggleExpand = (i: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
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
      prev.forEach(idx => {
        if (idx < i) next.add(idx)
        else if (idx > i) next.add(idx - 1)
      })
      if (next.size === 0) next.add(0)
      return next
    })
  }

  const updateItem = (i: number, field: keyof ItemRow, value: string | number) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))
  const patchItem = useCallback((i: number, patch: Partial<ItemRow>) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it)), [])

  const buildPayload = (forSubmit: boolean) => {
    const firstItem = items[0]
    const selectedCostCenter = activeCostCenters.find(cc => cc.id === firstItem?.cost_center_id)
    const requiredDate = items.map(it => it.needed_by_date).filter(Boolean).sort()[0]
    const noteParts = [title.trim(), notes.trim()].filter(Boolean)
    const validItems = items.filter(it => isItemValid(it))
    const approvers = primaryApproverId
      ? [
          { approver_id: primaryApproverId, level: 1 },
          ...(secondaryApproverId ? [{ approver_id: secondaryApproverId, level: 2 }] : []),
        ]
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
      to_store_id: procurementSource === 'internal'
        ? (buScope === 'cross_bu' ? toStoreId : storeId)
        : undefined,
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

  const validateDraft = () => {
    if (!storeId) {
      toast.error('Select a business unit')
      return false
    }
    const validItems = items.filter(it => isItemValid(it))
    if (!validItems.length) {
      toast.error('Complete at least one line item to save a draft')
      return false
    }
    return true
  }

  const validateSubmit = () => {
    const validItems = items.filter(it => isItemValid(it))
    if (!validItems.length) {
      toast.error('Complete at least one line item (product, service, or description)')
      return false
    }
    if (items.some(it => !isItemValid(it))) {
      toast.error('Each line item must be completed')
      return false
    }
    if (items.some(it => !it.cost_center_id)) {
      toast.error('Select a cost center for each line item')
      return false
    }
    if (!storeId) {
      toast.error('Select a business unit')
      return false
    }
    if (procurementSource === 'internal' && buScope === 'cross_bu') {
      if (!fromStoreId || !toStoreId) {
        toast.error('Select both From BU and To BU for cross-BU requisitions')
        return false
      }
      if (fromStoreId === toStoreId) {
        toast.error('From BU and To BU must be different')
        return false
      }
    }
    if (!primaryApproverId) {
      toast.error('Select a primary approver before submitting')
      return false
    }
    if (secondaryApproverId && secondaryApproverId === primaryApproverId) {
      toast.error('Secondary approver must be different from primary approver')
      return false
    }
    return true
  }

  const saving = createPR.isPending || updatePR.isPending || submitPR.isPending

  const handleSave = async (submitAfter: boolean) => {
    if (submitAfter ? !validateSubmit() : !validateDraft()) return

    const payload = buildPayload(submitAfter)
    try {
      let prId = editingPR?.id
      if (editingPR) {
        await updatePR.mutateAsync({ id: editingPR.id, data: payload })
        toast.success(submitAfter ? 'Requisition updated' : 'Draft saved')
      } else {
        const created = await createPR.mutateAsync(payload) as PurchaseRequisition
        prId = created.id
        toast.success(submitAfter ? 'Requisition created' : 'Draft saved')
      }
      if (submitAfter && prId) {
        await submitPR.mutateAsync(prId)
        toast.success('Submitted for approval')
      }
      onClose()
    } catch {
      // hook shows error toast
    }
  }

  const handleSubmit = () => { void handleSave(true) }
  const handleSaveDraft = () => { void handleSave(false) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            {editingPR ? `Edit ${editingPR.pr_number}` : 'New Purchase Requisition'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <CardContent className="flex flex-col flex-1 min-h-0 p-5 gap-3">
          <div className="shrink-0 space-y-2.5">
            <div className="grid grid-cols-12 gap-x-3 gap-y-2.5">
              <div className="col-span-12 lg:col-span-4">
                <Label className="text-[11px] leading-tight text-gray-500">Title / Purpose</Label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Office stationery Q3"
                  className="mt-0.5 h-8 text-xs py-0 px-2.5"
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
                onFromStoreChange={id => {
                  setFromStoreId(id)
                  if (toStoreId === id) setToStoreId('')
                }}
                onToStoreChange={setToStoreId}
                onHeaderSupplierChange={setHeaderSupplierId}
              />
            </div>

            <div className="grid grid-cols-12 gap-x-3 gap-y-2.5">
              <ProcurementApproverFields
                inline
                primaryApproverId={primaryApproverId}
                secondaryApproverId={secondaryApproverId}
                approverMessage={approverMessage}
                onPrimaryChange={id => {
                  setPrimaryApproverId(id)
                  if (id === secondaryApproverId) setSecondaryApproverId('')
                }}
                onSecondaryChange={setSecondaryApproverId}
                onMessageChange={setApproverMessage}
              />
              <div className="col-span-12 sm:col-span-6 lg:col-span-3">
                <Label className="text-[11px] leading-tight text-gray-500">Internal Notes</Label>
                <Input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any internal notes…"
                  className="mt-0.5 h-8 text-xs py-0 px-2.5"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col flex-1 min-h-0 border-t pt-3">
            <div className="flex items-center justify-between mb-2.5 shrink-0">
              <h3 className="font-medium text-sm text-gray-800 dark:text-gray-200">Line Items</h3>
              <Button variant="outline" size="sm" onClick={addItem} className="gap-1.5 h-8 text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </Button>
            </div>
            {!costCentersLoading && activeCostCenters.length === 0 && (
              <p className="text-xs text-amber-600 mb-2 shrink-0">
                No cost centers — add them under Finance → Cost Centers.
              </p>
            )}
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
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
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t shrink-0">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button variant="secondary" onClick={handleSaveDraft} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Draft
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingPR ? 'Submit for Approval' : 'Create & Submit'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function PurchaseRequisitionsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showForm, setShowForm] = useState(false)
  const [editingPR, setEditingPR] = useState<PurchaseRequisition | null>(null)
  const [selectedPR, setSelectedPR] = useState<PurchaseRequisition | null>(null)

  const openCreateForm = () => {
    setEditingPR(null)
    setShowForm(true)
  }

  const openEditForm = (pr: PurchaseRequisition) => {
    setEditingPR(pr)
    setShowForm(true)
    setSelectedPR(null)
  }

  const params: Record<string, unknown> = {}
  if (statusFilter) params.status = statusFilter

  const { data, isLoading } = useRequisitions(params)
  const items: PurchaseRequisition[] = data?.items ?? []

  const displayItems = useMemo(() => {
    const filtered = search
      ? items.filter(r =>
          r.pr_number.toLowerCase().includes(search.toLowerCase()) ||
          (r.title || '').toLowerCase().includes(search.toLowerCase()) ||
          (r.department || '').toLowerCase().includes(search.toLowerCase())
        )
      : items
    return processRows(
      filtered,
      '',
      () => [],
      sortKey,
      sortDir,
      {
        pr_number: r => r.pr_number,
        title: r => r.title || '',
        status: r => r.status,
        priority: r => r.priority,
        department: r => r.department || '',
        required_date: r => r.required_date || '',
        created_at: r => r.created_at,
        item_count: r => r.items.length,
      },
    )
  }, [items, search, sortKey, sortDir])

  const totalEstimate = useMemo(() =>
    displayItems.reduce((s, r) => s + r.items.reduce((si, i) => si + (i.quantity * (i.estimated_price ?? 0)), 0), 0),
    [displayItems]
  )

  const cols = [
    { key: 'pr_number',     label: 'PR Number',   width: 130 },
    { key: 'title',         label: 'Title',        width: 200 },
    { key: 'department',    label: 'Department',   width: 130 },
    { key: 'priority',      label: 'Priority',     width: 90 },
    { key: 'status',        label: 'Status',       width: 110 },
    { key: 'item_count',    label: 'Items',        width: 70 },
    { key: 'required_date', label: 'Required By',  width: 110 },
    { key: 'created_at',    label: 'Created',      width: 110 },
  ]

  return (
    <div className="space-y-6">
      {showForm && (
        <PRFormModal
          editingPR={editingPR}
          onClose={() => { setShowForm(false); setEditingPR(null) }}
        />
      )}
      {selectedPR && (
        <PRDetailPanel
          pr={selectedPR}
          onClose={() => setSelectedPR(null)}
          onEdit={openEditForm}
        />
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Purchase Requisitions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Internal demand requests before converting to Purchase Orders</p>
        </div>
        <Button className="gap-2" onClick={openCreateForm}>
          <Plus className="w-4 h-4" /> New Requisition
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', count: items.length, color: 'text-gray-700' },
          { label: 'Submitted', count: items.filter(r => r.status === 'submitted').length, color: 'text-blue-600' },
          { label: 'Approved', count: items.filter(r => r.status === 'approved').length, color: 'text-green-600' },
          { label: 'Est. Value', count: null, value: formatCurrency(totalEstimate), color: 'text-purple-600' },
        ].map(s => (
          <Card key={s.label} className="py-3 px-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.count !== null ? s.count : s.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="px-0">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search PR number, title, department…"
            sortOptions={[
              { value: 'created_at', label: 'Created' },
              { value: 'pr_number', label: 'PR Number' },
              { value: 'priority', label: 'Priority' },
              { value: 'required_date', label: 'Required By' },
            ]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
            leading={
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                options={selectOptionsWithBlank(
                  'All Statuses',
                  STATUSES.filter(Boolean).map(s => ({ value: s, label: STATUS_BADGE[s]?.label ?? s })),
                )}
                className="w-36 text-sm"
              />
            }
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : displayItems.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No requisitions found</p>
            <p className="text-sm mt-1">Create your first purchase requisition to get started</p>
          </div>
        ) : (
          <ResizableTable tableId="procurement-requisitions" defaultWidths={cols.map(c => c.width)}>
            <thead>
              <tr>
                {cols.map(c => (
                  <th key={c.key} className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase bg-gray-50 dark:bg-gray-800">
                    <TableColumnLabel>{c.label}</TableColumnLabel>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayItems.map(r => {
                const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.draft
                const totalEst = r.items.reduce((s, i) => s + (i.quantity * (i.estimated_price ?? 0)), 0)
                return (
                  <tr
                    key={r.id}
                    className="border-t cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    onClick={() => setSelectedPR(r)}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-blue-600 font-medium">{r.pr_number}</td>
                    <td className="px-3 py-2 font-medium text-sm truncate max-w-[200px]">{r.title || '—'}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{r.department || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[r.priority] || ''}`}>
                        {r.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">{r.items.length}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{r.required_date ? formatDate(r.required_date) : '—'}</td>
                    <td className="px-3 py-2 text-sm text-gray-500">{formatDate(r.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </ResizableTable>
        )}
      </Card>
    </div>
  )
}
