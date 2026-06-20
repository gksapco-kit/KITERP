import { useEffect, useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Link } from 'react-router-dom'
import {
  X, Check, FileText, User, Receipt, ExternalLink, Loader2,
} from 'lucide-react'
import {
  useHRExpense, useHRExpenses, useDecideExpense, useMarkExpensePaid, useHREmployees,
} from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import { resolveMediaUrl } from '@/lib/printUtils'
import { onModalBackdropClick } from '@/lib/utils'
import { employeeDisplayName } from '@/lib/hrEmployeeDisplay'
import type { EmployeeDocument, EmployeeProfile, ExpenseClaim } from '@/types'

const STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-600' },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
  approved:  { label: 'Approved',  color: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-700' },
  paid:      { label: 'Paid',      color: 'bg-emerald-100 text-emerald-700' },
}

function ReceiptLinks({ receipts }: { receipts?: { url: string; name?: string }[] }) {
  if (!receipts?.length) {
    return <p className="text-sm text-gray-400">No receipts attached to this claim.</p>
  }
  return (
    <ul className="space-y-2">
      {receipts.map((r, i) => (
        <li key={`${r.url}-${i}`}>
          <a
            href={resolveMediaUrl(r.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            {r.name || `Receipt ${i + 1}`}
          </a>
        </li>
      ))}
    </ul>
  )
}

export default function ExpenseClaimDetailDrawer({
  claimId,
  onClose,
  onSelectClaim,
  onUpdated,
  openRejectForm,
}: {
  claimId: string
  onClose: () => void
  onSelectClaim?: (id: string) => void
  onUpdated?: () => void
  /** Open with reject reason form visible (e.g. from quick reject action). */
  openRejectForm?: boolean
}) {
  const { data: claim, isLoading, refetch } = useHRExpense(claimId)
  const c = claim as ExpenseClaim | undefined
  const employeeId = c?.employee_id ?? ''

  const { data: empData } = useHREmployees({ limit: 200 })
  const employees: EmployeeProfile[] = empData?.items ?? []
  const employee = employees.find(e => e.id === employeeId)

  const { data: empClaims = [] } = useHRExpenses(
    employeeId ? { employee_id: employeeId } : undefined,
  )
  const decide = useDecideExpense()
  const markPaid = useMarkExpensePaid()

  const [docs, setDocs] = useState<EmployeeDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [approveNote, setApproveNote] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  useEffect(() => {
    setShowRejectForm(false)
    setRejectNote('')
    if (openRejectForm && c?.status === 'submitted') setShowRejectForm(true)
  }, [openRejectForm, c?.status, claimId])

  useEffect(() => {
    if (!employeeId) return
    setDocsLoading(true)
    vendorApi.hrListDocuments(employeeId)
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setDocsLoading(false))
  }, [employeeId])

  async function handleDecide(decision: 'approved' | 'rejected') {
    if (!c) return
    const note = decision === 'rejected' ? rejectNote.trim() : approveNote.trim() || undefined
    if (decision === 'rejected' && !note) return
    await decide.mutateAsync({ id: c.id, decision, note })
    setShowRejectForm(false)
    setRejectNote('')
    await refetch()
    onUpdated?.()
  }

  async function handleMarkPaid() {
    if (!c) return
    const ref = prompt('Payment reference (e.g. UTR / cheque #)?') ?? undefined
    await markPaid.mutateAsync({ id: c.id, payment_reference: ref })
    await refetch()
    onUpdated?.()
  }

  const st = c ? (STATUS[c.status] ?? STATUS.draft) : null
  const empName = employee ? employeeDisplayName(employee) : employeeId.slice(0, 8)

  return (
    <div data-kiterp-modal
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
      onClick={onModalBackdropClick(onClose)}
    >
      <div
        className="w-full max-w-lg h-full bg-card border-l border-border text-foreground shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Expense claim</h2>
            <p className="text-xs text-gray-500 font-mono">{c?.claim_number ?? claimId.slice(0, 8)}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {isLoading || !c ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Employee */}
            <section>
              <h3 className="text-xs font-bold uppercase text-gray-500 mb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Employee
              </h3>
              <div className="rounded-lg border bg-gray-50 px-3 py-2.5 text-sm">
                <p className="font-medium text-gray-900">{empName}</p>
                {employee?.employee_code && (
                  <p className="text-xs text-gray-500 mt-0.5">Code: {employee.employee_code}</p>
                )}
                <Link
                  to={{
                    pathname: `/hr/employees/${employeeId}`,
                    search: new URLSearchParams({
                      returnTo: '/hr/expenses',
                      claimId,
                    }).toString(),
                  }}
                  className="text-xs text-primary hover:underline mt-2 inline-block"
                >
                  Open employee profile →
                </Link>
              </div>
            </section>

            {/* Claim details */}
            <section>
              <h3 className="text-xs font-bold uppercase text-gray-500 mb-2 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" /> Claim details
              </h3>
              <dl className="rounded-lg border divide-y text-sm">
                <div className="flex justify-between px-3 py-2">
                  <dt className="text-gray-500">Title</dt>
                  <dd className="font-medium text-right max-w-[60%]">{c.title}</dd>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <dt className="text-gray-500">Status</dt>
                  <dd>
                    {st && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${st.color}`}>{st.label}</span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <dt className="text-gray-500">Amount</dt>
                  <dd className="font-semibold">{c.currency ?? 'INR'} {Number(c.amount).toFixed(2)}</dd>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <dt className="text-gray-500">Category</dt>
                  <dd className="capitalize">{c.category ?? '—'}</dd>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <dt className="text-gray-500">Expense date</dt>
                  <dd>{c.expense_date ?? '—'}</dd>
                </div>
                {c.description && (
                  <div className="px-3 py-2">
                    <dt className="text-gray-500 text-xs mb-1">Description</dt>
                    <dd className="text-gray-800 whitespace-pre-wrap">{c.description}</dd>
                  </div>
                )}
                {c.decision_note && (
                  <div className="px-3 py-2 bg-red-50/80">
                    <dt className="text-red-700 text-xs font-medium mb-1">
                      {c.status === 'rejected' ? 'Rejection reason' : 'Decision note'}
                    </dt>
                    <dd className="text-red-900 whitespace-pre-wrap">{c.decision_note}</dd>
                  </div>
                )}
                {c.payment_reference && (
                  <div className="flex justify-between px-3 py-2">
                    <dt className="text-gray-500">Payment ref</dt>
                    <dd className="font-mono text-xs">{c.payment_reference}</dd>
                  </div>
                )}
              </dl>
            </section>

            {/* Claim receipts */}
            <section>
              <h3 className="text-xs font-bold uppercase text-gray-500 mb-2">Claim receipts / uploads</h3>
              <ReceiptLinks receipts={c.receipts} />
            </section>

            {/* HR employee documents */}
            <section>
              <h3 className="text-xs font-bold uppercase text-gray-500 mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Employee documents (HR file)
              </h3>
              {docsLoading ? (
                <p className="text-sm text-gray-400">Loading documents…</p>
              ) : docs.length === 0 ? (
                <p className="text-sm text-gray-400">No documents on file.</p>
              ) : (
                <ul className="space-y-2">
                  {docs.map(d => (
                    <li key={d.id} className="flex items-center justify-between gap-2 text-sm border rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{d.document_name}</p>
                        <p className="text-xs text-gray-500 capitalize">{d.document_type?.replace('_', ' ')}</p>
                      </div>
                      {d.file_url && (
                        <a
                          href={resolveMediaUrl(d.file_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-blue-600 hover:underline text-xs"
                        >
                          View
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Other claims by employee */}
            <section>
              <h3 className="text-xs font-bold uppercase text-gray-500 mb-2">
                All expense claims ({(empClaims as ExpenseClaim[]).length})
              </h3>
              <div className="border rounded-lg divide-y max-h-40 overflow-y-auto text-sm">
                {(empClaims as ExpenseClaim[]).map(ec => {
                  const ecs = STATUS[ec.status] ?? STATUS.draft
                  return (
                    <button
                      key={ec.id}
                      type="button"
                      onClick={() => ec.id !== c.id && onSelectClaim?.(ec.id)}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex justify-between gap-2 ${
                        ec.id === c.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <span className="truncate">{ec.title}</span>
                      <span className={`text-xs px-1 py-0.5 rounded shrink-0 ${ecs.color}`}>{ecs.label}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>
        )}

        {/* Actions */}
        {c && (
          <div className="shrink-0 border-t p-4 bg-gray-50 space-y-3">
            {c.status === 'submitted' && !showRejectForm && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleDecide('approved')}
                  disabled={decide.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectForm(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
                >
                  <X className="w-4 h-4" /> Reject…
                </button>
              </div>
            )}
            {showRejectForm && c.status === 'submitted' && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700">
                  Rejection reason * <span className="text-gray-400 font-normal">(visible to employee in ESS)</span>
                </label>
                <textarea
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Explain why this claim was rejected…"
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowRejectForm(false); setRejectNote('') }}
                    className="btn-cancel px-3 py-2 text-sm border rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecide('rejected')}
                    disabled={decide.isPending || !rejectNote.trim()}
                    className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Confirm reject
                  </button>
                </div>
              </div>
            )}
            {c.status === 'approved' && (
              <button
                type="button"
                onClick={handleMarkPaid}
                disabled={markPaid.isPending}
                className="w-full px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                Mark as paid
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
