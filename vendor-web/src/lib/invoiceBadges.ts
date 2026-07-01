/** Shared invoice list/detail badge + link styles — distinct hues for type vs status vs links. */

export type InvoiceBadge = { className: string; label: string }

const badgeBase = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium'

export function invoiceBadgeClass(badge: InvoiceBadge) {
  return `${badgeBase} ${badge.className}`
}

/** Payment / workflow status */
export const invoiceStatusBadge: Record<string, InvoiceBadge> = {
  draft: {
    className: 'bg-muted text-muted-foreground ring-1 ring-border/60',
    label: 'Draft',
  },
  sent: {
    className: 'bg-sky-500/12 text-sky-800 ring-1 ring-sky-500/25 dark:text-sky-300',
    label: 'Sent',
  },
  paid: {
    className: 'bg-emerald-500/12 text-emerald-800 ring-1 ring-emerald-500/25 dark:text-emerald-300',
    label: 'Paid',
  },
  partially_paid: {
    className: 'bg-amber-500/12 text-amber-800 ring-1 ring-amber-500/25 dark:text-amber-300',
    label: 'Partially Paid',
  },
  overdue: {
    className: 'bg-red-500/12 text-red-800 ring-1 ring-red-500/25 dark:text-red-300',
    label: 'Overdue',
  },
  cancelled: {
    className: 'bg-muted text-muted-foreground ring-1 ring-border/60',
    label: 'Cancelled',
  },
}

/** Document category — neutral / semantic colors (not link blue) */
export const invoiceTypeBadge: Record<string, InvoiceBadge> = {
  estimate: {
    className: 'bg-violet-500/12 text-violet-800 ring-1 ring-violet-500/20 dark:text-violet-300',
    label: 'Estimate',
  },
  invoice: {
    className: 'bg-slate-500/10 text-slate-700 ring-1 ring-slate-500/20 dark:bg-slate-500/20 dark:text-slate-200',
    label: 'Invoice',
  },
  receipt: {
    className: 'bg-emerald-500/12 text-emerald-800 ring-1 ring-emerald-500/20 dark:text-emerald-300',
    label: 'Receipt',
  },
  credit_note: {
    className: 'bg-rose-500/12 text-rose-800 ring-1 ring-rose-500/20 dark:text-rose-300',
    label: 'Credit Note',
  },
}

/** Primary row identifier — invoice number */
export const invoiceNumberLinkClass =
  'font-semibold text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors'

/** Secondary cross-reference — linked order or booking */
export const invoiceRefLinkClass =
  'inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/35 px-2 py-0.5 text-xs font-mono text-muted-foreground transition-colors hover:border-primary/35 hover:bg-primary/5 hover:text-primary [&_svg]:shrink-0 [&_svg]:text-muted-foreground/75 hover:[&_svg]:text-primary'
