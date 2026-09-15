/**
 * Shared map-driven status badge used across procurement and inventory document screens.
 *
 * Usage:
 *   import { DocumentStatusBadge } from '@/components/document/DocumentStatusBadge'
 *   <DocumentStatusBadge status={doc.status} map={MY_STATUS_MAP} />
 *
 * Each map entry: { label: string; cls: string }
 * where `cls` is a Tailwind bg+text class pair, e.g. 'bg-blue-100 text-blue-700'
 */

import { cn } from '@/lib/utils'

export type StatusMap = Record<string, { label: string; cls: string }>

interface DocumentStatusBadgeProps {
  status: string
  map: StatusMap
  className?: string
}

export function DocumentStatusBadge({ status, map, className }: DocumentStatusBadgeProps) {
  const cfg = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        cfg.cls,
        className,
      )}
    >
      {cfg.label}
    </span>
  )
}

// ── Standard status maps shared between document types ────────────────────────

/** Procurement document statuses shared by PR, Invoice, Return. */
export const PROCUREMENT_APPROVAL_STATUS_MAP: StatusMap = {
  pending:  { label: 'Pending',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  skipped:  { label: 'Skipped',  cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
}

export const PR_STATUS_MAP: StatusMap = {
  draft:               { label: 'Draft',     cls: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  submitted:           { label: 'Submitted', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  open:                { label: 'Open',      cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  approved:            { label: 'Approved',  cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  rejected:            { label: 'Rejected',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  partially_converted: { label: 'Partial',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  converted:           { label: 'Converted', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  cancelled:           { label: 'Cancelled', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
}

export const PO_STATUS_MAP: StatusMap = {
  draft:             { label: 'Draft',             cls: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  pending_approval:  { label: 'Pending Approval',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  approved:          { label: 'Approved',           cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  sent:              { label: 'Sent',               cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  partial_received:  { label: 'Partially Received', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  received:          { label: 'Received',           cls: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' },
  invoiced:          { label: 'Invoiced',           cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  closed:            { label: 'Closed',             cls: 'bg-green-200 text-green-800 dark:bg-green-900/60 dark:text-green-200' },
  cancelled:         { label: 'Cancelled',          cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
}

export const GRN_STATUS_MAP: StatusMap = {
  draft:     { label: 'Draft',     cls: 'bg-gray-100 text-gray-700' },
  posted:    { label: 'Posted',    cls: 'bg-green-100 text-green-700' },
  closed:    { label: 'Closed',    cls: 'bg-green-200 text-green-800' },
  reversed:  { label: 'Reversed',  cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-700' },
}

export const PURCHASE_RETURN_STATUS_MAP: StatusMap = {
  draft:              { label: 'Draft',      cls: 'bg-gray-100 text-gray-700' },
  approved:           { label: 'Approved',   cls: 'bg-blue-100 text-blue-700' },
  goods_dispatched:   { label: 'Dispatched', cls: 'bg-yellow-100 text-yellow-700' },
  supplier_confirmed: { label: 'Confirmed',  cls: 'bg-green-100 text-green-700' },
  closed:             { label: 'Closed',     cls: 'bg-green-200 text-green-800' },
  cancelled:          { label: 'Cancelled',  cls: 'bg-red-100 text-red-700' },
}

export const VENDOR_INVOICE_STATUS_MAP: StatusMap = {
  draft:     { label: 'Draft',    cls: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  submitted: { label: 'Pending Approval', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  approved:  { label: 'Approved', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  posted:    { label: 'Posted',   cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  matched:   { label: 'Matched',  cls: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' },
  paid:      { label: 'Paid',     cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
}

export const RFQ_STATUS_MAP: StatusMap = {
  draft:       { label: 'Draft',       cls: 'bg-gray-100 text-gray-700' },
  issued:      { label: 'Issued',      cls: 'bg-blue-100 text-blue-700' },
  bids_closed: { label: 'Bids Closed', cls: 'bg-yellow-100 text-yellow-700' },
  awarded:     { label: 'Awarded',     cls: 'bg-green-100 text-green-700' },
  cancelled:   { label: 'Cancelled',   cls: 'bg-red-100 text-red-700' },
}

export const STO_STATUS_MAP: StatusMap = {
  draft:      { label: 'Draft',       cls: 'bg-gray-100 text-gray-700' },
  submitted:  { label: 'Submitted',   cls: 'bg-blue-100 text-blue-700' },
  dispatched: { label: 'In-Transit',  cls: 'bg-amber-100 text-amber-700' },
  received:   { label: 'Received',    cls: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'Cancelled',   cls: 'bg-red-100 text-red-700' },
}

export const STOCK_COUNT_STATUS_MAP: StatusMap = {
  draft:        { label: 'Draft',        cls: 'bg-gray-100 text-gray-600' },
  in_progress:  { label: 'In Progress',  cls: 'bg-blue-100 text-blue-700' },
  counting:     { label: 'Counting',     cls: 'bg-amber-100 text-amber-700' },
  under_review: { label: 'Under Review', cls: 'bg-purple-100 text-purple-700' },
  completed:    { label: 'Completed',    cls: 'bg-green-100 text-green-700' },
  cancelled:    { label: 'Cancelled',    cls: 'bg-red-100 text-red-500' },
}
