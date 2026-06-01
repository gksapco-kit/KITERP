import { X, ExternalLink } from 'lucide-react'
import { getStorefrontApiBaseUrl } from '@/lib/apiBase'

function mediaUrl(path: string) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const base = getStorefrontApiBaseUrl().replace(/\/api\/v1\/?$/, '')
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

const STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-600' },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
  approved:  { label: 'Approved',  color: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-700' },
  paid:      { label: 'Paid',      color: 'bg-emerald-100 text-emerald-700' },
}

export default function ExpenseClaimDetail({
  claim,
  onClose,
}: {
  claim: Record<string, unknown>
  onClose: () => void
}) {
  const status = String(claim.status ?? 'draft')
  const st = STATUS[status] ?? STATUS.draft
  const receipts = (claim.receipts as { url: string; name?: string }[] | undefined) ?? []

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-bold">Claim details</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {status === 'rejected' && claim.decision_note && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-medium text-red-800 uppercase tracking-wide mb-1">
                Rejection reason from HR
              </p>
              <p className="text-sm text-red-900 whitespace-pre-wrap">{String(claim.decision_note)}</p>
              <p className="text-xs text-red-700 mt-2">You can edit and resubmit this claim.</p>
            </div>
          )}
          <dl className="text-sm space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Claim #</dt>
              <dd className="font-mono">{String(claim.claim_number ?? '—')}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Title</dt>
              <dd className="font-medium text-right">{String(claim.title ?? '')}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Status</dt>
              <dd>
                <span className={`text-xs px-1.5 py-0.5 rounded ${st.color}`}>{st.label}</span>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Amount</dt>
              <dd className="font-semibold">
                {String(claim.currency ?? 'INR')} {Number(claim.amount ?? 0).toFixed(2)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Date</dt>
              <dd>{String(claim.expense_date ?? '—')}</dd>
            </div>
            {claim.description && (
              <div>
                <dt className="text-gray-500 text-xs">Description</dt>
                <dd className="mt-1 whitespace-pre-wrap">{String(claim.description)}</dd>
              </div>
            )}
            {claim.decided_at && status !== 'rejected' && claim.decision_note && (
              <div>
                <dt className="text-gray-500 text-xs">HR note</dt>
                <dd className="mt-1 whitespace-pre-wrap">{String(claim.decision_note)}</dd>
              </div>
            )}
          </dl>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Receipts / uploads</p>
            {receipts.length === 0 ? (
              <p className="text-sm text-gray-400">None attached</p>
            ) : (
              <ul className="space-y-2">
                {receipts.map((r, i) => (
                  <li key={`${r.url}-${i}`}>
                    <a
                      href={mediaUrl(r.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {r.name || `Attachment ${i + 1}`}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="p-4 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-sm font-medium border rounded-lg hover:bg-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
