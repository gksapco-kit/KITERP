/** Shared dark/light-safe tokens for commission module pages (all themes & templates). */

export const commissionPageTitle = 'text-xl font-semibold text-foreground'
export const commissionPageSub = 'text-sm text-muted-foreground mt-0.5'

export const commissionFilterPanel =
  'bg-card border border-border rounded-xl p-4 mb-4 space-y-4'

export const commissionFilterBtn =
  'flex items-center gap-2 border border-border px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors'

export const commissionTableShell = 'bg-card rounded-xl border border-border overflow-hidden'
export const commissionTableShellScroll =
  'bg-card rounded-xl border border-border overflow-x-auto'

export const commissionThead = 'bg-muted/40 border-b border-border'
export const commissionTh =
  'text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide'
export const commissionTbody = 'divide-y divide-border'
export const commissionRowHover = 'hover:bg-muted/30 transition-colors'
export const commissionEmptyCell = 'text-center py-12 text-muted-foreground'

export const commissionFieldInput =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring [color-scheme:light] dark:[color-scheme:dark]'

export const commissionInfoBanner =
  'text-xs text-amber-900 dark:text-amber-200 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 dark:border-amber-500/30 rounded-md px-2 py-1.5 mt-2 max-w-3xl'

export const commissionCard = 'bg-card rounded-xl border border-border p-5'

export const commissionStatusActive =
  'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
export const commissionStatusInactive = 'bg-muted text-muted-foreground'

export const commissionPaginationActive =
  'px-3 py-1 rounded text-sm bg-primary text-primary-foreground'
export const commissionPaginationInactive =
  'px-3 py-1 rounded text-sm border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'

export const commissionTableIconBtn =
  'rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/70'

export const commissionBucketActive = 'px-3 py-1 rounded text-xs font-medium capitalize bg-primary text-primary-foreground'
export const commissionBucketInactive =
  'px-3 py-1 rounded text-xs font-medium capitalize text-muted-foreground hover:bg-muted hover:text-foreground'

export const ACCRUAL_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  accrued: 'bg-primary/15 text-primary',
  approved: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  paid: 'bg-primary/12 text-primary',
  reversed: 'bg-red-500/15 text-red-800 dark:text-red-300',
  disputed: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
}

export const PAYOUT_STATUS_COLORS: Record<string, string> = {
  open: 'bg-primary/15 text-primary',
  approved: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  paid: 'bg-primary/12 text-primary',
  cancelled: 'bg-muted text-muted-foreground',
}

export function commissionChartColors(dark: boolean) {
  return {
    grid: dark ? 'hsl(215 20% 22%)' : 'hsl(214 22% 90%)',
    tick: dark ? 'hsl(215 14% 65%)' : 'hsl(215 14% 45%)',
  }
}
