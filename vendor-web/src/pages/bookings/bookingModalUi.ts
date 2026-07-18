/** New Booking modal — semantic tokens for light, dark, and all KIT themes. */
import { focusRingClassName } from '@/lib/utils'

export const bookingModalUi = {
  shell: 'bg-card rounded-xl shadow-2xl border border-border text-foreground',
  colMuted: 'bg-muted/20',
  colMain: 'bg-card',
  dragHandle: 'bg-transparent',
  dragHandleMain: 'bg-transparent',
  sectionTitle: 'text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2',
  fieldLabel: 'text-[10px] font-medium text-muted-foreground uppercase tracking-wide',
  input:
    'w-full h-8 px-2.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring',
  inputSearch:
    `w-full h-8 pl-7 pr-2.5 rounded-md border border-input bg-background text-xs text-foreground ${focusRingClassName}`,
  inputTime:
    'flex-1 h-7 px-2 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring',
  textarea:
    'w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring',
  dropdown:
    'absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-40 overflow-y-auto text-popover-foreground',
  dropdownItem:
    'w-full text-left px-2.5 py-1.5 hover:bg-accent flex items-center gap-2 border-b border-border/40 last:border-0',
  nameText: 'text-xs font-semibold text-foreground truncate',
  nameTextSm: 'text-[11px] font-medium text-foreground truncate',
  metaText: 'text-[10px] text-muted-foreground truncate',
  hint: 'text-[10px] text-muted-foreground',
  iconMuted: 'text-muted-foreground',
  checklist: 'rounded-lg bg-muted/25 px-2.5 py-2 space-y-1',
  checklistTitle: 'text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1',
  checklistPending: 'w-3 h-3 rounded-full shrink-0 border border-border bg-muted/60',
  checklistDone: 'w-3 h-3 rounded-full flex items-center justify-center shrink-0 bg-emerald-500',
  checklistTextDone: 'text-[10px] text-foreground font-medium',
  checklistTextPending: 'text-[10px] text-muted-foreground',
  footer: 'bg-muted/15 px-4 py-2 flex items-center gap-2 shrink-0',
  summaryPill:
    'flex items-center gap-1 text-[10px] text-foreground bg-muted/35 rounded-full px-2 py-0.5',
  readyDotDone: 'w-2 h-2 rounded-full bg-emerald-500 shrink-0',
  readyDotPending: 'w-2 h-2 rounded-full bg-muted-foreground/25 shrink-0',
  emptyCol: 'flex flex-col items-center justify-center py-6 text-center text-muted-foreground',
  emptyColIcon: 'w-8 h-8 mb-1.5 text-muted-foreground/40',
  timeline: 'relative h-7 bg-muted/40 rounded-lg overflow-hidden border border-border/60',
  timelineTick: 'absolute top-0 bottom-0 w-px bg-border/60',
  timelineLabel: 'text-[10px] text-muted-foreground',
  filterBtnInactive:
    'bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
  filterBtnActive: 'bg-primary text-primary-foreground',
  badgeClear: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  badgeBusy: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  emptyStateIcon: 'w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center mb-1',
  slotPickerShell:
    'bg-card rounded-xl shadow-2xl border border-border w-full max-w-2xl overflow-hidden max-h-[min(92dvh,calc(100vh-1.5rem))] flex flex-col text-foreground',
  slotPickerLegend: 'flex items-center gap-3 px-3 py-1.5 bg-muted/20',
  slotPickerFooter: 'px-3 py-2 bg-muted/15 flex items-center justify-between',
  slotConflictBadge: 'border-red-500/40 bg-red-500/10',
  slotAvailableBadge: 'border-emerald-500/40 bg-emerald-500/10',
  slotTriggerEmpty:
    'border-dashed border-border bg-muted/25 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-muted/40',
  slotTriggerDisabled:
    'border-dashed border-border/60 bg-muted/15 text-muted-foreground/50 cursor-not-allowed',
  slotTriggerOk: 'border-primary/50 bg-accent text-primary',
  slotTriggerConflict: 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300',
  slotGridAvailable:
    'bg-emerald-500/12 border-emerald-500/35 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 cursor-pointer',
  slotGridConflict:
    'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400 cursor-not-allowed opacity-70',
  slotGridOther:
    'bg-amber-500/12 border-amber-500/35 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 cursor-pointer',
  slotGridPast: 'bg-muted/40 border-border text-muted-foreground/50 cursor-not-allowed',
  rowOverdue: 'border-orange-500/40 bg-orange-500/10',
  rowDimmed: 'border-border bg-muted/25 opacity-60',
  rowDefault: 'border-border bg-card hover:bg-accent/50',
  iconBtn:
    'p-1 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-50 transition-colors',
  iconBtnDanger:
    'p-1 rounded-md text-red-400 hover:bg-red-500/15 hover:text-red-500 disabled:opacity-50 transition-colors',
  iconBtnInfo:
    'p-1 rounded-md text-primary/70 hover:bg-primary/15 hover:text-primary disabled:opacity-50 transition-colors',
  statusPending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  statusConfirmed: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  statusInProgress: 'bg-primary/12 text-primary',
  statusCompleted: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  statusDefault: 'bg-muted text-muted-foreground',
  externalBadge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35',
  conflictAlert: 'bg-red-500/10 border-red-500/40',
  availableAlert: 'bg-emerald-500/10 border-emerald-500/40',
  conflictTitle: 'text-red-600 dark:text-red-400',
  availableTitle: 'text-emerald-600 dark:text-emerald-400',
  conflictBody: 'text-red-700 dark:text-red-300',
  availableBody: 'text-emerald-700 dark:text-emerald-300',
  conflictHint: 'text-red-500/80 dark:text-red-400',
  availableHint: 'text-emerald-600 dark:text-emerald-400',
} as const
