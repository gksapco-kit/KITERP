import { useState, useMemo, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { ResizableTable } from '@/components/table/ResizableTable'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import {
  useRequisitions, useRequisition, useSubmitRequisition,
  useApproveRequisition, useCancelRequisition, useMyMembership, useCreatePurchaseOrder,
  useConvertPRToPO,
} from '@/hooks/useVendor'
import { itemTypeLabel } from '@/components/procurement/procurementLineItemTypes'
import { formatDate, formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import type { PurchaseRequisition, PurchaseRequisitionItem } from '@/types'
import { askConfirm } from '@/components/common/ConfirmProvider'
import { PO_FROM_PR_KEY, PR_FROM_INVENTORY_KEY, buildPrToPoPrefill, buildPoCreatePayloadFromPr, type InventoryAlertPrefill } from '@/lib/prToPoPrefill'
import { PR_COPY_FROM_ID_KEY } from '@/lib/copyDocument'
import { actionDocMessage } from '@/lib/documentToast'
import { uomLabel } from '@/lib/uomOptions'
import { vendorApi } from '@/api/vendor'
import {
  Loader2, Plus, X, CheckCircle, XCircle, Send, Pencil, Clock, ArrowRightLeft, FilePlus, CopyPlus,
} from 'lucide-react'
import {
  DocumentStatusBadge,
  PR_STATUS_MAP,
} from '@/components/document/DocumentStatusBadge'
import { ApprovalChainPanel } from '@/components/document/ApprovalChainPanel'
import { PurchaseRequisitionForm } from '@/components/procurement/PurchaseRequisitionForm'
import { LineCollapsedGlimpse } from '@/components/procurement/LineCollapsedGlimpse'
import { LineItemExpandHeader, LineItemsExpandAllActions } from '@/components/procurement/LineItemExpandHeader'

const PRIORITY_BADGE: Record<string, string> = {
  low:    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  high:   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

const STATUSES = ['', 'draft', 'submitted', 'open', 'approved', 'rejected', 'partially_converted', 'converted', 'cancelled']

function itemDisplayName(item: PurchaseRequisition['items'][number]): string {
  if (item.product_name) return item.product_name
  if (item.service_name) return item.service_name
  if (item.description) return item.description
  return item.product_id ? item.product_id.slice(0, 8) : '—'
}

function canConvertPrToPo(pr: PurchaseRequisition): boolean {
  return ['open', 'approved', 'partially_converted'].includes(pr.status)
    && (pr.items ?? []).some(it => !it.is_converted && Boolean(it.product_id || it.service_id))
}

/** Editable until an approver has approved (or the PR is converted / cancelled). */
function canEditPr(pr: PurchaseRequisition): boolean {
  return ['draft', 'submitted', 'open'].includes(pr.status)
}

/** Open existing PO create form (editable draft). Fetches full PR so prices/destinations copy correctly. */
async function startCreateEditablePo(
  pr: PurchaseRequisition,
  navigate: ReturnType<typeof useNavigate>,
): Promise<void> {
  let source = pr
  try {
    const full = await vendorApi.getRequisition(pr.id) as PurchaseRequisition
    if (full?.id) source = full
  } catch {
    // Fall back to the list/detail snapshot already in hand
  }
  const prefill = buildPrToPoPrefill(source)
  if (!prefill) {
    toast.error('No convertible product/service lines on this requisition')
    return
  }
  try {
    sessionStorage.setItem(PO_FROM_PR_KEY, JSON.stringify(prefill))
  } catch {
    toast.error('Could not prepare purchase order form')
    return
  }
  navigate('/purchase-orders/new')
}

const SOURCE_LABEL: Record<string, string> = {
  supplier: 'Supplier',
  internal: 'Internal',
}

const BU_SCOPE_LABEL: Record<string, string> = {
  within_bu: 'Within BU',
  cross_bu: 'Cross BU',
}

function DetailField({
  label,
  value,
  className = '',
  mono = false,
}: {
  label: string
  value?: ReactNode
  className?: string
  mono?: boolean
}) {
  const empty = value === null || value === undefined || value === ''
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <div className={`mt-0.5 break-words text-xs text-gray-900 dark:text-gray-100 ${mono ? 'font-mono' : 'font-medium'} ${empty ? 'text-gray-400' : ''}`}>
        {empty ? '—' : value}
      </div>
    </div>
  )
}

function PRDetailPanel({ pr: initialPr, onClose, onEdit }: { pr: PurchaseRequisition; onClose: () => void; onEdit?: (pr: PurchaseRequisition) => void }) {
  const navigate = useNavigate()
  const { data: fetchedPr, isLoading: prLoading } = useRequisition(initialPr.id)
  const pr = fetchedPr ?? initialPr

  const submitPR = useSubmitRequisition()
  const approvePR = useApproveRequisition()
  const cancelPR = useCancelRequisition()
  const createPO = useCreatePurchaseOrder()
  const convertMut = useConvertPRToPO()
  const { data: myMembership, isLoading: membershipLoading } = useMyMembership()
  const [approvalRemarks, setApprovalRemarks] = useState('')
  const [collapsedLineIds, setCollapsedLineIds] = useState<Set<string>>(() => new Set())
  const converting = canConvertPrToPo(pr)

  const toggleLineExpanded = (id: string) => {
    setCollapsedLineIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDirectConvert = async () => {
    const prefill = buildPrToPoPrefill(pr)
    if (!prefill?.items.length) {
      toast.error('No convertible product lines on this requisition')
      return
    }
    if (!prefill.supplierId) {
      toast.error('Add a supplier on the PR, or use Create PO to pick one')
      return
    }
    const ok = await askConfirm({
      title: `Convert ${pr.pr_number} to Purchase Order?`,
      description: 'This creates a draft PO immediately from the requisition lines. Type CONVERT to confirm.',
      confirmLabel: 'Convert',
      confirmPhrase: 'CONVERT',
      variant: 'warning',
    })
    if (!ok) return
    // Use the backend convert-to-po endpoint which atomically marks PR items as ordered
    convertMut.mutate(
      {
        id: pr.id,
        supplier_id: prefill.supplierId,
        item_ids: prefill.items.map((i) => i.prItemId),
        expected_delivery_date: prefill.expectedDate,
        notes: prefill.notes,
      },
      {
        onSuccess: (result: { po_id?: string }) => {
          onClose()
          if (result?.po_id) navigate(`/purchase-orders/${result.po_id}`)
          else navigate('/purchase-orders')
        },
      },
    )
  }

  const handleCreateEditablePo = async () => {
    const ok = await askConfirm({
      title: `Create editable PO from ${pr.pr_number}?`,
      description: 'Opens the Purchase Order form pre-filled from this requisition so you can edit before saving. Type CREATE to confirm.',
      confirmLabel: 'Create',
      confirmPhrase: 'CREATE',
      variant: 'default',
    })
    if (!ok) return
    await startCreateEditablePo(pr, navigate)
    onClose()
  }

  const pendingStep = [...(pr.approvals ?? [])]
    .filter(a => a.status === 'pending')
    .sort((a, b) => a.level - b.level)[0]
  const canActAsApprover = pr.status === 'submitted'
    && pendingStep
    && (!pendingStep.approver_id || pendingStep.approver_id === myMembership?.id)

  const handleApprove = async () => {
    const ok = await askConfirm({
      title: `Approve ${pr.pr_number}?`,
      description: 'This advances the requisition approval. Type APPROVE to confirm.',
      confirmLabel: 'Approve',
      confirmPhrase: 'APPROVE',
      variant: 'success',
    })
    if (!ok) return
    approvePR.mutate({ id: pr.id, data: { status: 'approved', comments: approvalRemarks || undefined } })
  }
  const handleReject = async () => {
    if (!approvalRemarks.trim()) { toast.error('Please enter rejection remarks'); return }
    const ok = await askConfirm({
      title: `Reject ${pr.pr_number}?`,
      description: 'This rejects the requisition. Type REJECT to confirm.',
      confirmLabel: 'Reject',
      confirmPhrase: 'REJECT',
      variant: 'danger',
    })
    if (!ok) return
    approvePR.mutate({ id: pr.id, data: { status: 'rejected', comments: approvalRemarks } })
  }

  const handleCancelPr = async () => {
    const ok = await askConfirm({
      title: `Cancel ${pr.pr_number}?`,
      description: 'This cancels the purchase requisition. Type CANCEL to confirm.',
      confirmLabel: 'Cancel',
      confirmPhrase: 'CANCEL',
      variant: 'danger',
    })
    if (!ok) return
    cancelPR.mutate({ id: pr.id })
  }

  const totalEstimate = pr.items.reduce((s: number, i: PurchaseRequisitionItem) => s + (i.quantity * (i.estimated_price ?? 0)), 0)
  const showApprovalFooter = pr.status === 'submitted' && pendingStep && !membershipLoading
  const canEdit = canEditPr(pr)
  const { title: parsedTitle, internalNotes } = parsePRNotes(pr.notes)
  const displayTitle = parsedTitle || pr.title || 'Purchase Requisition'
  const earliestNeedBy = pr.items
    .map(it => it.needed_by_date)
    .filter(Boolean)
    .sort()[0] as string | undefined

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-4xl max-h-[92vh] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-2 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="font-mono text-[11px] text-gray-500">{pr.pr_number}</p>
              <DocumentStatusBadge status={pr.status} map={PR_STATUS_MAP} />
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${PRIORITY_BADGE[pr.priority] || ''}`}>{pr.priority}</span>
            </div>
            <h2 className="mt-0.5 text-base font-semibold leading-snug">{displayTitle}</h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              {pr.store_name || '—'}
              {pr.header_supplier_name ? ` · ${pr.header_supplier_name}` : ''}
              {pr.department ? ` · ${pr.department}` : ''}
              <span className="font-semibold text-green-700 dark:text-green-400"> · {formatCurrency(totalEstimate)}</span>
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={() => {
                try {
                  sessionStorage.setItem(PR_COPY_FROM_ID_KEY, pr.id)
                } catch {
                  toast.error('Could not prepare a copy of this requisition')
                  return
                }
                onClose()
                navigate('/procurement/requisitions/new')
              }}
            >
              <CopyPlus className="w-3.5 h-3.5" /> Copy document
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>

        {prLoading && (
          <div className="flex shrink-0 items-center gap-2 border-b px-4 py-1.5 text-xs text-gray-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading full details…
          </div>
        )}

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">General information</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border bg-gray-50/80 p-3 sm:grid-cols-3 dark:bg-gray-800/40">
              <DetailField label="PR Number" value={pr.pr_number} mono />
              <DetailField label="Status" value={<DocumentStatusBadge status={pr.status} map={PR_STATUS_MAP} />} />
              <DetailField label="Priority" value={<span className="capitalize">{pr.priority}</span>} />
              <DetailField label="Title" value={parsedTitle || pr.title} className="col-span-2 sm:col-span-3" />
              <DetailField label="Business Unit" value={pr.store_name} />
              <DetailField label="Cost Center / Department" value={pr.department} />
              <DetailField label="Requisition Type" value={itemTypeLabel(pr.requisition_type)} />
              <DetailField label="Procurement Source" value={SOURCE_LABEL[pr.procurement_source || ''] || pr.procurement_source} />
              {pr.procurement_source === 'supplier' && (
                <DetailField label="Supplier" value={pr.header_supplier_name} className="col-span-2" />
              )}
              {pr.procurement_source === 'internal' && (
                <>
                  <DetailField label="BU Movement" value={BU_SCOPE_LABEL[pr.bu_scope || ''] || pr.bu_scope} />
                  <DetailField label="From BU" value={pr.from_store_name} />
                  <DetailField label="To BU" value={pr.to_store_name} />
                </>
              )}
              <DetailField label="Requested By" value={pr.requested_by_name} />
              <DetailField label="Submitted" value={pr.submitted_at ? formatDate(pr.submitted_at) : undefined} />
              <DetailField label="Approved" value={pr.approved_at ? formatDate(pr.approved_at) : undefined} />
              <DetailField label="Required By" value={(pr.required_date || earliestNeedBy) ? formatDate(pr.required_date || earliestNeedBy!) : undefined} />
              <DetailField label="Created" value={pr.created_at ? formatDate(pr.created_at) : undefined} />
              <DetailField label="Last Updated" value={pr.updated_at ? formatDate(pr.updated_at) : undefined} />
              <DetailField label="Estimated Total" value={formatCurrency(totalEstimate)} />
            </div>
          </section>

          {(internalNotes || pr.approver_message) && (
            <section className="grid gap-3 sm:grid-cols-2">
              {internalNotes && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/30">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">Internal notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-amber-950 dark:text-amber-100">{internalNotes}</p>
                </div>
              )}
              {pr.approver_message && (
                <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/25">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-300">Message for approver</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-blue-950 dark:text-blue-100">{pr.approver_message}</p>
                </div>
              )}
            </section>
          )}

          <ApprovalChainPanel
            approvals={pr.approvals ?? []}
            myMembershipId={myMembership?.id}
            compact
          />

          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Line items ({pr.items.length})
              </h3>
              {pr.items.length > 0 && (
                <LineItemsExpandAllActions
                  onExpandAll={() => setCollapsedLineIds(new Set())}
                  onCollapseAll={() => setCollapsedLineIds(new Set(pr.items.map(i => i.id)))}
                />
              )}
            </div>
            <div className="space-y-3">
              {pr.items.map((item: PurchaseRequisitionItem, idx: number) => {
                const lineTotal = item.quantity * (item.estimated_price ?? 0)
                const uom = item.unit_of_measure || item.uom || 'piece'
                const typeLabel = itemTypeLabel(item.item_type || pr.requisition_type)
                const displayName = itemDisplayName(item)
                const lineExpanded = !collapsedLineIds.has(item.id)
                const toggleLine = () => toggleLineExpanded(item.id)
                return (
                  <div key={item.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <LineItemExpandHeader
                          lineNumber={idx + 1}
                          typeLabel={displayName}
                          expanded={lineExpanded}
                          onToggle={toggleLine}
                        />
                      </div>
                      {item.is_converted ? (
                        <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                          Converted
                        </span>
                      ) : null}
                    </div>
                    {lineExpanded ? (
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
                        <DetailField label="Item Type" value={typeLabel} />
                        <DetailField label="Description / Catalog Item" value={displayName} className="col-span-2 sm:col-span-2" />
                        <DetailField label="SKU" value={item.product_sku} mono />
                        <DetailField label="Variant" value={item.variant_name} />
                        <DetailField label="Quantity" value={`${item.quantity} ${uomLabel(uom)}`} />
                        <DetailField label="Unit of Measure" value={uomLabel(uom)} />
                        <DetailField label="Estimated Price" value={item.estimated_price != null ? formatCurrency(item.estimated_price) : undefined} />
                        <DetailField label="Line Estimate" value={formatCurrency(lineTotal)} />
                        <DetailField label="Need By Date" value={item.needed_by_date ? formatDate(item.needed_by_date) : undefined} />
                        <DetailField label="Deliver to Plant" value={item.plant_name || item.plant_id} />
                        <DetailField label="Storage Location" value={item.storage_location_name || item.storage_location_id} />
                        <DetailField label="Suggested Supplier" value={item.suggested_supplier_name || item.suggested_supplier_id} />
                        <DetailField label="Qty Ordered" value={item.quantity_ordered != null ? String(item.quantity_ordered) : '0'} />
                        <DetailField label="Conversion Status" value={item.is_converted ? 'Converted to PO' : 'Not converted'} />
                        <DetailField
                          label="Linked PO"
                          className="col-span-2"
                          value={
                            item.purchase_order_id ? (
                              <button
                                type="button"
                                className="font-medium text-blue-600 hover:underline text-left"
                                onClick={() => {
                                  onClose()
                                  const lineQs = item.po_line_number ? `?line=${item.po_line_number}` : ''
                                  navigate(`/purchase-orders/${item.purchase_order_id}${lineQs}`)
                                }}
                              >
                                {item.po_number || 'Open purchase order'}
                                {item.po_line_number != null ? ` · Line ${item.po_line_number}` : ''}
                              </button>
                            ) : undefined
                          }
                        />
                        {item.notes && (
                          <DetailField label="Line Notes" value={<span className="whitespace-pre-wrap">{item.notes}</span>} className="col-span-2 sm:col-span-3 lg:col-span-4" />
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={toggleLine}
                        className="mt-1.5 flex w-full min-w-0 items-center gap-2 text-left hover:opacity-80"
                      >
                        <LineCollapsedGlimpse
                          typeLabel={typeLabel}
                          title={displayName}
                          quantity={item.quantity}
                          uom={uom}
                          unitPrice={item.estimated_price}
                          variantName={item.variant_name}
                          masterFacts={item.product_sku ? [{ label: 'SKU', value: item.product_sku }] : []}
                          extras={[
                            formatCurrency(lineTotal),
                            item.is_converted ? 'Converted' : null,
                            item.po_number || null,
                          ]}
                        />
                      </button>
                    )}
                  </div>
                )
              })}
              {!pr.items.length && (
                <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-gray-400">No line items</p>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        {showApprovalFooter && canActAsApprover && (
          <div className="shrink-0 border-t bg-green-50/80 px-3 py-2 dark:bg-green-950/25">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Remarks (required for rejection)"
                value={approvalRemarks}
                onChange={e => setApprovalRemarks(e.target.value)}
                className="h-8 min-w-[10rem] flex-1 bg-white text-xs dark:bg-gray-900"
              />
              {onEdit && canEdit && (
                <Button variant="outline" size="sm" onClick={() => onEdit(pr)} className="h-8 gap-1">
                  <Pencil className="w-3.5 h-3.5 text-green-600" /> Edit
                </Button>
              )}
              <Button size="sm" onClick={handleApprove} disabled={approvePR.isPending} className="h-8 gap-1 bg-green-600 px-3 hover:bg-green-700">
                {approvePR.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={handleReject} disabled={approvePR.isPending} className="h-8 gap-1 px-3">
                <XCircle className="w-3.5 h-3.5" /> Reject
              </Button>
              <Button variant="outline" size="sm" className="ml-auto h-8" onClick={onClose}>Close</Button>
            </div>
          </div>
        )}
        {showApprovalFooter && !canActAsApprover && (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
            <p className="flex-1 text-xs text-amber-900 dark:text-amber-200">
              Awaiting <span className="font-semibold">{pendingStep?.approver_name || 'designated approver'}</span> (Level {pendingStep?.level})
            </p>
            {onEdit && canEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit(pr)} className="h-8 gap-1">
                <Pencil className="w-3.5 h-3.5 text-green-600" /> Edit
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8" onClick={onClose}>Close</Button>
          </div>
        )}
        {pr.status === 'submitted' && membershipLoading && pendingStep && (
          <div className="shrink-0 border-t px-3 py-2 text-xs text-gray-500">
            <Loader2 className="mr-1.5 inline w-3.5 h-3.5 animate-spin" /> Checking approval permissions…
          </div>
        )}
        {pr.status === 'draft' && (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t px-3 py-2">
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit(pr)} className="h-8 gap-1">
                <Pencil className="w-3.5 h-3.5 text-green-600" /> Edit
              </Button>
            )}
            <Button size="sm" onClick={() => submitPR.mutate(pr.id, {
              onSuccess: (updated) => toast.success(
                (updated as PurchaseRequisition)?.status === 'open'
                  ? actionDocMessage('Requisition', (updated as PurchaseRequisition)?.pr_number || pr.pr_number, 'opened (no approval required)')
                  : actionDocMessage('Requisition', (updated as PurchaseRequisition)?.pr_number || pr.pr_number, 'submitted for approval'),
              ),
            })} disabled={submitPR.isPending} className="h-8 gap-1">
              {submitPR.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Submit
            </Button>
            <Button variant="destructive" size="sm" className="h-8" onClick={handleCancelPr}>Cancel</Button>
            <Button variant="outline" size="sm" className="ml-auto h-8" onClick={onClose}>Close</Button>
          </div>
        )}
        {pr.status === 'open' && (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t px-3 py-2">
            {onEdit && canEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit(pr)} className="h-8 gap-1">
                <Pencil className="w-3.5 h-3.5 text-green-600" /> Edit
              </Button>
            )}
            {converting && (
              <>
                <Button size="sm" className="h-8 gap-1" disabled={convertMut.isPending || createPO.isPending} onClick={handleDirectConvert}>
                  {convertMut.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <ArrowRightLeft className="w-3.5 h-3.5" />}
                  Convert to PO
                </Button>
                <Button size="sm" variant="outline" className="h-8 gap-1" disabled={convertMut.isPending || createPO.isPending} onClick={handleCreateEditablePo}>
                  <FilePlus className="w-3.5 h-3.5" /> Create PO
                </Button>
              </>
            )}
            <Button variant="destructive" size="sm" className="h-8" onClick={handleCancelPr}>Cancel</Button>
            <Button variant="outline" size="sm" className="ml-auto h-8" onClick={onClose}>Close</Button>
          </div>
        )}
        {pr.status === 'submitted' && !showApprovalFooter && !membershipLoading && (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t px-3 py-2">
            {onEdit && canEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit(pr)} className="h-8 gap-1">
                <Pencil className="w-3.5 h-3.5 text-green-600" /> Edit
              </Button>
            )}
            <Button variant="destructive" size="sm" className="h-8" onClick={handleCancelPr}>Cancel</Button>
            <Button variant="outline" size="sm" className="ml-auto h-8" onClick={onClose}>Close</Button>
          </div>
        )}
        {['approved', 'partially_converted'].includes(pr.status) && (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t px-3 py-2">
            {converting && (
              <>
                <Button
                  size="sm"
                  className="h-8 gap-1"
                  disabled={convertMut.isPending || createPO.isPending}
                  onClick={handleDirectConvert}
                >
                  {convertMut.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <ArrowRightLeft className="w-3.5 h-3.5" />}
                  Convert to PO
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1"
                  disabled={convertMut.isPending || createPO.isPending}
                  onClick={handleCreateEditablePo}
                >
                  <FilePlus className="w-3.5 h-3.5" /> Create PO
                </Button>
              </>
            )}
            {pr.status === 'approved' && (
              <Button variant="outline" size="sm" className="h-8 text-red-600 hover:text-red-700" onClick={handleCancelPr}>Cancel PR</Button>
            )}
            {pr.status === 'partially_converted' && (
              <span className="text-xs text-gray-400" title="Cancel the linked Purchase Order first — the requisition will be released automatically.">
                Cancel the PO to release this PR
              </span>
            )}
            <Button variant="outline" size="sm" className="ml-auto h-8" onClick={onClose}>Close</Button>
          </div>
        )}
        {!['draft', 'open', 'submitted', 'approved', 'partially_converted'].includes(pr.status) && (
          <div className="flex shrink-0 justify-end border-t px-3 py-2">
            <Button variant="outline" size="sm" className="h-8" onClick={onClose}>Close</Button>
          </div>
        )}
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

function PRFormModal({ editingPR, inventoryPrefill, onClose }: { editingPR?: PurchaseRequisition | null; inventoryPrefill?: InventoryAlertPrefill | null; onClose: () => void }) {
  return (
    <PurchaseRequisitionForm
      layout="modal"
      editingPR={editingPR}
      inventoryPrefill={inventoryPrefill}
      onSuccess={onClose}
      onCancel={onClose}
    />
  )
}

export default function PurchaseRequisitionsPage() {
  const navigate = useNavigate()
  const createPO = useCreatePurchaseOrder()
  const [viewMode, setViewMode] = useState<'all' | 'pending_my_approval'>('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showForm, setShowForm] = useState(false)
  const [editingPR, setEditingPR] = useState<PurchaseRequisition | null>(null)
  const [inventoryPrefill, setInventoryPrefill] = useState<InventoryAlertPrefill | null>(null)
  const [selectedPR, setSelectedPR] = useState<PurchaseRequisition | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)

  // Redirect to the full-screen creation page when navigated here from an inventory alert
  useEffect(() => {
    const raw = sessionStorage.getItem(PR_FROM_INVENTORY_KEY)
    if (!raw) return
    // Do NOT remove the key — let CreatePurchaseRequisitionPage consume it
    navigate('/procurement/requisitions/new', { replace: false })
  }, [])

  const handleDirectConvert = async (pr: PurchaseRequisition) => {
    const payload = buildPoCreatePayloadFromPr(pr)
    if (!payload) {
      toast.error('Add a supplier on the PR, or use Create PO to pick one')
      return
    }
    const ok = await askConfirm({
      title: `Convert ${pr.pr_number} to Purchase Order?`,
      description: 'This creates a draft PO immediately from the requisition lines. Type CONVERT to confirm.',
      confirmLabel: 'Convert',
      confirmPhrase: 'CONVERT',
      variant: 'warning',
    })
    if (!ok) return
    setConvertingId(pr.id)
    createPO.mutate(payload, {
      onSuccess: (po: { id?: string }) => {
        setConvertingId(null)
        if (po?.id) navigate(`/purchase-orders/${po.id}`)
        else navigate('/purchase-orders')
      },
      onError: () => setConvertingId(null),
    })
  }

  const handleCreateEditablePo = async (pr: PurchaseRequisition) => {
    const ok = await askConfirm({
      title: `Create editable PO from ${pr.pr_number}?`,
      description: 'Opens the Purchase Order form pre-filled from this requisition so you can edit before saving. Type CREATE to confirm.',
      confirmLabel: 'Create',
      confirmPhrase: 'CREATE',
      variant: 'default',
    })
    if (!ok) return
    await startCreateEditablePo(pr, navigate)
  }

  const openCreateForm = () => {
    navigate('/procurement/requisitions/new')
  }

  const openEditForm = (pr: PurchaseRequisition) => {
    setEditingPR(pr)
    setShowForm(true)
    setSelectedPR(null)
  }

  const params: Record<string, unknown> =
    viewMode === 'pending_my_approval'
      ? { pending_my_approval: true }
      : (statusFilter ? { status: statusFilter } : {})

  const { data, isLoading } = useRequisitions(params)
  const { data: pendingMeta } = useRequisitions({ pending_my_approval: true, size: 1 })
  const pendingCount = pendingMeta?.total ?? 0
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
    { key: 'pr_number',     label: 'PR Number',   width: 120 },
    { key: 'title',         label: 'Title',        width: 160 },
    { key: 'department',    label: 'Department',   width: 150 },
    { key: 'priority',      label: 'Priority',     width: 90 },
    { key: 'status',        label: 'Status',       width: 110 },
    { key: 'item_count',    label: 'Items',        width: 70 },
    { key: 'required_date', label: 'Required By',  width: 110 },
    { key: 'created_at',    label: 'Created',      width: 110 },
    { key: 'actions',       label: 'Actions',      width: 250 },
  ]

  return (
    <div className="space-y-6">
      {showForm && (
        <PRFormModal
          editingPR={editingPR}
          inventoryPrefill={inventoryPrefill}
          onClose={() => { setShowForm(false); setEditingPR(null); setInventoryPrefill(null) }}
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
          <p className="text-sm text-gray-500 mt-0.5">
            {viewMode === 'pending_my_approval'
              ? 'Requisitions waiting for your approval decision'
              : 'Internal demand requests before converting to Purchase Orders'}
          </p>
        </div>
        <Button className="gap-2" onClick={openCreateForm}>
          <Plus className="w-4 h-4" /> New Requisition
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setViewMode('all')}
          className={`px-4 py-2 rounded-lg text-sm border ${
            viewMode === 'all'
              ? 'bg-primary text-white border-primary'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
          }`}
        >
          All Requisitions
        </button>
        <button
          type="button"
          onClick={() => setViewMode('pending_my_approval')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm border ${
            viewMode === 'pending_my_approval'
              ? 'bg-primary text-white border-primary'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending My Approval
          {pendingCount > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
              viewMode === 'pending_my_approval' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
            }`}>
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Stats */}
      {viewMode === 'all' && (
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', count: items.length, color: 'text-gray-700' },
          { label: 'Open', count: items.filter(r => r.status === 'open').length, color: 'text-sky-600' },
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
      )}

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
              viewMode === 'all' ? (
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                options={selectOptionsWithBlank(
                  'All Statuses',
                  STATUSES.filter(Boolean).map(s => ({ value: s, label: PR_STATUS_MAP[s]?.label ?? s })),
                )}
                className="w-36 text-sm"
              />
              ) : null
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
            <p className="font-medium">
              {viewMode === 'pending_my_approval' ? 'No requisitions awaiting your approval' : 'No requisitions found'}
            </p>
            <p className="text-sm mt-1">
              {viewMode === 'pending_my_approval'
                ? 'Submitted PRs assigned to you will appear here'
                : 'Create your first purchase requisition to get started'}
            </p>
          </div>
        ) : (
          <ResizableTable tableId="procurement-requisitions-v3" defaultWidths={cols.map(c => c.width)}>
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
                const totalEst = r.items.reduce((s, i) => s + (i.quantity * (i.estimated_price ?? 0)), 0)
                return (
                  <tr
                    key={r.id}
                    className="border-t cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    onClick={onClickableTableRow(() => setSelectedPR(r))}
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
                      <DocumentStatusBadge status={r.status} map={PR_STATUS_MAP} />
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">{r.items.length}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{r.required_date ? formatDate(r.required_date) : '—'}</td>
                    <td className="px-3 py-2 text-sm text-gray-500">{formatDate(r.created_at)}</td>
                    <td className="px-3 py-2 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      {canConvertPrToPo(r) ? (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs shrink-0"
                            disabled={convertingId === r.id}
                            onClick={() => handleDirectConvert(r)}
                          >
                            {convertingId === r.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <ArrowRightLeft className="w-3 h-3 shrink-0" />}
                            Convert to PO
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2 text-xs shrink-0"
                            disabled={convertingId === r.id}
                            onClick={() => handleCreateEditablePo(r)}
                          >
                            <FilePlus className="w-3 h-3 shrink-0" />
                            Create PO
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
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
