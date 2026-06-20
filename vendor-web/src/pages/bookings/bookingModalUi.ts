/** New Booking modal — semantic tokens for light, dark, and all KIT themes. */
export const bookingModalUi = {
  shell: 'bg-card rounded-2xl shadow-2xl border border-border text-foreground',
  colMuted: 'bg-muted/25',
  colMain: 'bg-card',
  dragHandle: 'border-x border-border bg-muted/25',
  dragHandleMain: 'border-x border-border bg-card',
  sectionTitle: 'text-xs font-bold uppercase tracking-widest text-foreground mb-4',
  fieldLabel: 'text-xs font-medium text-muted-foreground uppercase tracking-wide',
  input:
    'w-full h-9 px-3 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring',
  inputSearch:
    'w-full h-9 pl-8 pr-3 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
  inputTime:
    'flex-1 h-8 px-2 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring',
  textarea:
    'w-full px-3 py-2 rounded-lg border border-input bg-background text-xs text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring',
  dropdown:
    'absolute z-10 w-full mt-1 bg-popover border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto text-popover-foreground',
  dropdownItem:
    'w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2 border-b border-border/50 last:border-0',
  nameText: 'text-sm font-semibold text-foreground truncate',
  nameTextSm: 'text-xs font-medium text-foreground truncate',
  metaText: 'text-xs text-muted-foreground truncate',
  hint: 'text-xs text-muted-foreground',
  iconMuted: 'text-muted-foreground',
  checklist: 'rounded-xl border border-border bg-muted/30 p-3 space-y-1.5',
  checklistTitle: 'text-xs font-bold uppercase tracking-widest text-foreground mb-2',
  checklistPending: 'w-3.5 h-3.5 rounded-full shrink-0 border border-border bg-muted/60',
  checklistDone: 'w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 bg-emerald-500',
  checklistTextDone: 'text-xs text-foreground font-medium',
  checklistTextPending: 'text-xs text-muted-foreground',
  footer: 'border-t border-border bg-muted/25 px-6 py-3 flex items-center gap-3 shrink-0',
  summaryPill:
    'flex items-center gap-1.5 text-xs text-foreground bg-muted/40 border border-border rounded-full px-3 py-1',
  emptyCol: 'flex flex-col items-center justify-center py-16 text-center text-muted-foreground',
  emptyColIcon: 'w-12 h-12 mb-3 text-muted-foreground/40',
  timeline: 'relative h-10 bg-muted/50 rounded-xl overflow-hidden border border-border',
  timelineTick: 'absolute top-0 bottom-0 w-px bg-border/80',
  timelineLabel: 'text-xs text-muted-foreground',
  filterBtnInactive:
    'bg-muted/50 text-muted-foreground hover:bg-muted/70 hover:text-foreground dark:hover:bg-muted/65',
  filterBtnActive: 'bg-primary text-primary-foreground',
  badgeClear: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  badgeBusy: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  emptyStateIcon: 'w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center mb-2',
  slotPickerShell:
    'bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto text-foreground',
  slotPickerLegend: 'flex items-center gap-4 px-4 py-2 border-b border-border bg-muted/25',
  slotPickerFooter: 'px-4 py-2.5 border-t border-border bg-muted/25 flex items-center justify-between',
  slotConflictBadge: 'border-red-500/40 bg-red-500/10',
  slotAvailableBadge: 'border-emerald-500/40 bg-emerald-500/10',
  slotTriggerEmpty:
    'border-dashed border-border bg-muted/30 text-muted-foreground hover:border-primary/60 hover:text-primary hover:bg-muted/45',
  slotTriggerDisabled:
    'border-dashed border-border/60 bg-muted/20 text-muted-foreground/50 cursor-not-allowed',
  slotTriggerOk: 'border-primary/60 bg-accent text-primary',
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
