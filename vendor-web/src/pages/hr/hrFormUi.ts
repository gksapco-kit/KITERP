/** Shared dark-mode form chrome for HR pages. */
export const hrInputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring [color-scheme:dark]'

export const hrSelectClass =
  'h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring [color-scheme:dark]'

export const hrInfoBannerClass =
  'rounded-lg border border-primary/25 bg-primary/10 px-3 py-2.5 text-xs text-foreground sm:text-sm'

export const hrTabActiveClass =
  'border-primary bg-primary/10 text-primary'

export const hrTabInactiveClass =
  'border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground'

export const hrTableHeadClass = 'border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground'

export const hrStatIconClass: Record<string, string> = {
  blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  green: 'bg-green-500/15 text-green-600 dark:text-green-400',
  yellow: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  purple: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
}

export const hrStatusBadge: Record<string, string> = {
  active: 'bg-green-500/15 text-green-700 dark:text-green-300',
  on_notice: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  exited: 'bg-red-500/15 text-red-600 dark:text-red-300',
  probation: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-green-500/15 text-green-700 dark:text-green-300',
  archived: 'bg-muted/80 text-muted-foreground',
  open: 'bg-green-500/15 text-green-700 dark:text-green-300',
  on_hold: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  closed: 'bg-muted text-muted-foreground',
  scheduled: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  completed: 'bg-green-500/15 text-green-700 dark:text-green-300',
  cancelled: 'bg-muted text-muted-foreground',
  enrolled: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  in_progress: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  failed: 'bg-red-500/15 text-red-600 dark:text-red-300',
  overdue: 'bg-red-500/15 text-red-600 dark:text-red-300',
}

export const hrLabelClass = 'text-xs font-medium uppercase text-muted-foreground'

export const hrEmptyStateClass = 'rounded-xl border border-border bg-card p-12 text-center'

export const hrCardClass = 'rounded-xl border border-border bg-card text-foreground shadow-sm'
