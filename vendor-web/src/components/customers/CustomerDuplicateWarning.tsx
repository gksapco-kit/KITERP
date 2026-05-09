/**
 * CustomerDuplicateWarning
 *
 * Compact, scrollable list of existing customers that share the same phone
 * or email the user just typed.  Each row has:
 *   • Avatar + name + contact snippet (left)
 *   • "Use" button (right)
 *   • Link icon to add as a new linked name
 *
 * The parent form must:
 *  1. Call vendorApi.checkCustomerDuplicates({ email, phone }) debounced.
 *  2. Pass the `matches` array here.
 *  3. Handle `onSelectExisting`, `onLinkTo`, `onDismiss`.
 */

import { AlertTriangle, UserCheck, Link2, X, Phone, Mail } from 'lucide-react'
import type { CustomerDuplicateMatch } from '@/types'

interface Props {
  matches: CustomerDuplicateMatch[]
  onSelectExisting: (match: CustomerDuplicateMatch) => void
  onLinkTo: (match: CustomerDuplicateMatch) => void
  onDismiss: () => void
}

export function CustomerDuplicateWarning({ matches, onSelectExisting, onLinkTo, onDismiss }: Props) {
  if (!matches.length) return null

  const ownMatches = matches.filter(m => m.is_own_vendor)
  const otherMatches = matches.filter(m => !m.is_own_vendor)

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-200">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <p className="flex-1 text-[11px] font-semibold text-amber-800 leading-tight">
          {matches.length === 1
            ? '1 existing customer has the same contact'
            : `${matches.length} existing customers share these contact details`}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="text-amber-400 hover:text-amber-700 transition-colors shrink-0 p-0.5 rounded"
          title="Dismiss — create as independent contact"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scrollable match list — max ~3 rows visible */}
      <div className="overflow-y-auto max-h-44 divide-y divide-amber-100">
        {ownMatches.length > 0 && (
          <>
            {ownMatches.length > 0 && otherMatches.length > 0 && (
              <p className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-500 bg-amber-50/80">
                In your customer list
              </p>
            )}
            {ownMatches.map(m => (
              <MatchRow key={m.id} match={m} onSelectExisting={onSelectExisting} onLinkTo={onLinkTo} />
            ))}
          </>
        )}
        {otherMatches.length > 0 && (
          <>
            <p className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-500 bg-amber-50/80">
              Known to other vendors
            </p>
            {otherMatches.map(m => (
              <MatchRow key={m.id} match={m} onSelectExisting={onSelectExisting} onLinkTo={onLinkTo} crossVendor />
            ))}
          </>
        )}
      </div>

      {/* Footer — create new anyway */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-amber-200 bg-amber-50">
        <p className="text-[10px] text-amber-600">Or dismiss to create independently</p>
        <button
          type="button"
          onClick={onDismiss}
          className="text-[10px] font-semibold text-amber-700 hover:text-amber-900 hover:underline transition-colors"
        >
          Create new anyway →
        </button>
      </div>
    </div>
  )
}

function MatchRow({
  match,
  onSelectExisting,
  onLinkTo,
  crossVendor = false,
}: {
  match: CustomerDuplicateMatch
  onSelectExisting: (m: CustomerDuplicateMatch) => void
  onLinkTo: (m: CustomerDuplicateMatch) => void
  crossVendor?: boolean
}) {
  const initial = match.full_name.charAt(0).toUpperCase()
  const avatarColor = crossVendor
    ? 'bg-gray-200 text-gray-600'
    : 'bg-amber-200 text-amber-800'

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 bg-white hover:bg-amber-50/60 transition-colors">
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor}`}>
        {initial}
      </div>

      {/* Identity */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-gray-900 truncate">{match.full_name}</p>
          {crossVendor
            ? <span className="text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-500 font-medium shrink-0">External</span>
            : <span className="text-[9px] px-1 py-0.5 rounded bg-green-100 text-green-700 font-medium shrink-0">Yours</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {match.phone && (
            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
              <Phone className="w-2.5 h-2.5" /> {match.phone}
            </span>
          )}
          {match.email && (
            <span className="text-[10px] text-gray-400 flex items-center gap-0.5 truncate max-w-[120px]">
              <Mail className="w-2.5 h-2.5 shrink-0" /> {match.email}
            </span>
          )}
          {match.total_orders > 0 && (
            <span className="text-[10px] text-gray-300">{match.total_orders} orders</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Link as new name */}
        <button
          type="button"
          onClick={() => onLinkTo(match)}
          title={crossVendor ? 'Create a linked record' : 'Add as new linked name under this contact'}
          className="p-1.5 rounded-lg text-amber-500 hover:text-amber-700 hover:bg-amber-100 transition-colors"
        >
          <Link2 className="w-3.5 h-3.5" />
        </button>

        {/* Use this record */}
        {!crossVendor && (
          <button
            type="button"
            onClick={() => onSelectExisting(match)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold transition-colors"
          >
            <UserCheck className="w-3 h-3" />
            Use
          </button>
        )}
        {crossVendor && (
          <button
            type="button"
            onClick={() => onLinkTo(match)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-semibold transition-colors"
          >
            Link
          </button>
        )}
      </div>
    </div>
  )
}
