/** Builder side panels / menus — semantic tokens for light, dark, and all KIT themes. */
export const builderPanelUi = {
  shell: 'border-border bg-card text-foreground',
  popover: 'border-border bg-popover text-popover-foreground shadow-2xl',
  divider: 'border-border',
  eyebrow: 'text-[10px] font-bold uppercase tracking-wide text-muted-foreground',
  title: 'text-xs font-bold text-foreground',
  label: 'text-xs font-medium text-foreground',
  hint: 'text-[10px] leading-snug text-muted-foreground',
  hintXs: 'text-xs text-muted-foreground',
  mono: 'text-xs text-muted-foreground font-mono',
  mutedSurface: 'rounded-lg border border-border bg-muted/40',
  cardSurface: 'rounded-xl border border-border bg-card shadow-sm',
  cardSurfaceMuted: 'rounded-xl border border-border bg-muted/30',
  groupHeader: 'px-3 py-2.5 border-b border-border bg-muted/35',
  groupTitle: 'text-[11px] font-bold uppercase tracking-wide text-foreground',
  groupDesc: 'text-[10px] text-muted-foreground mt-0.5 leading-snug',
  btnSecondary:
    'inline-flex items-center gap-1.5 rounded-lg border border-border bg-background text-[11px] font-semibold text-foreground transition-colors hover:bg-muted/60',
  btnDanger:
    'inline-flex items-center justify-center gap-1.5 rounded-lg border border-destructive/35 bg-background text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 hover:border-destructive/50',
  btnGhost:
    'inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-[10px] font-semibold text-foreground transition-colors hover:bg-muted/55 dark:bg-muted/50 dark:hover:bg-muted/70 disabled:opacity-50',
  menuItem:
    'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs font-semibold text-foreground transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50',
  menuItemHint: 'block text-[10px] font-normal text-muted-foreground',
  tabInactive: 'text-gray-600 hover:text-gray-900 hover:bg-muted/40 dark:text-muted-foreground dark:hover:text-foreground',
  tabActive: 'text-primary border-b-2 border-primary bg-accent',
  /** Side-panel tab strip — tabs share width; no horizontal scroll. */
  tabStrip: 'flex min-w-0 shrink-0 items-stretch border-b border-border',
  tabStripTabs: 'flex min-w-0 flex-1 items-stretch',
  tabBtn:
    'flex min-w-0 flex-1 flex-col items-center justify-center gap-px px-0.5 py-1 text-[8px] font-medium leading-snug transition-colors',
  tabBtnLabel: 'w-full truncate text-center text-[8px] leading-snug',
  tabBtnIcon: 'h-3 w-3 shrink-0',
  tabCollapseBtn:
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-muted-foreground shadow-sm transition-colors hover:bg-muted/50 hover:text-foreground',
  /** Collapse / expand — straddles panel edge at tab-strip junction. */
  panelEdgeToggle:
    'absolute z-30 flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-muted-foreground shadow-sm transition-colors hover:bg-muted/50 hover:text-foreground',
  panelEdgeToggleTop: 'top-8 -translate-y-1/2',
  colorInput: 'w-9 h-9 shrink-0 cursor-pointer rounded-lg border border-border bg-background p-0.5',
  select: 'w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground',
  collapsible:
    'rounded-lg border border-border bg-card shadow-sm overflow-hidden transition-colors hover:border-border',
  collapsibleSummary: 'hover:bg-muted/40',
  collapsibleTitle: 'text-xs font-semibold text-foreground',
  /** Recently deleted — inset card (menu); subtle tint on standalone panel only. */
  trashSection:
    'mx-2 mb-2 mt-1.5 overflow-hidden rounded-lg border border-border bg-muted/25 dark:border-border dark:bg-muted/45',
  trashSectionHeader:
    'flex items-center gap-2.5 border-b border-border/50 px-3 py-2.5 dark:border-border/60',
  trashSectionBody: 'space-y-2 px-3 py-2.5',
  trashPanelStandalone:
    'rounded-xl border border-border bg-muted/25 px-3 py-2.5 dark:bg-muted/40',
  amberIcon: 'text-amber-600 dark:text-amber-400',
  amberBadge:
    'rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-amber-800 dark:bg-amber-400/12 dark:text-amber-300',
  trashListItem:
    'flex items-center gap-2 rounded-md border border-border bg-background/80 px-2 py-1.5 dark:bg-background/40',
  trashItemTitle: 'text-[11px] font-semibold text-foreground truncate',
  trashItemMeta: 'text-[10px] text-muted-foreground',
} as const
