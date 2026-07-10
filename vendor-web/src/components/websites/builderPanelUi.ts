import { cn } from '@/lib/utils'

/** Panel "Link" CTA — connect fields, layers, or sections to URLs. */
export function builderLinkBtn(linked = false, size: 'sm' | 'md' = 'md') {
  const sizeCls =
    size === 'sm'
      ? 'gap-1 rounded-lg px-2 py-1 text-[9px]'
      : 'gap-1.5 rounded-xl px-2.5 py-1.5 text-[10px]'
  return cn(
    'group relative inline-flex shrink-0 items-center font-semibold shadow-sm transition-all duration-200',
    'hover:-translate-y-px hover:shadow-md active:translate-y-0 active:shadow-sm',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
    sizeCls,
    linked
      ? 'border border-emerald-300/70 bg-emerald-50/95 text-emerald-700 shadow-emerald-500/10 hover:border-emerald-400 hover:bg-emerald-100 focus-visible:ring-emerald-400/40'
      : 'border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-background to-primary/[0.03] text-primary shadow-primary/5 hover:border-primary/45 hover:from-primary/[0.12] hover:via-primary/[0.05] focus-visible:ring-primary/35',
  )
}

export function builderLinkBtnIcon(linked = false, size: 'sm' | 'md' = 'md') {
  const box = size === 'sm' ? 'h-3.5 w-3.5 rounded' : 'h-4 w-4 rounded-md'
  return cn(
    'flex shrink-0 items-center justify-center transition-colors',
    box,
    linked
      ? 'bg-emerald-500/15 text-emerald-600'
      : 'bg-primary/10 text-primary group-hover:bg-primary/15',
  )
}

/** Side rails — above in-canvas sticky nav (z-50); keep below floating section chrome. */
export const BUILDER_PANEL_RAIL_Z = 160
/** Resize handles + edge toggles — above panel tab strips (same z-index would lose on the right rail). */
export const BUILDER_PANEL_RESIZE_Z = 170
/** Section toolbar / design bar portals — above side panels (matches pre-regression body portals). */
export const BUILDER_SECTION_CHROME_Z = 100000

/** Builder side panels / menus — semantic tokens for light, dark, and all KIT themes. */
export const builderPanelUi = {
  shell: 'border-border bg-card text-foreground',
  popover: 'border-border bg-popover text-popover-foreground shadow-2xl',
  divider: 'border-border',
  eyebrow: 'text-[10px] font-bold uppercase tracking-wide text-muted-foreground',
  title: 'text-xs font-bold text-foreground',
  label: 'text-xs font-medium text-foreground',
  hint: 'text-[9px] leading-snug text-muted-foreground',
  /** Accordion / collapsible expanded body — slim, no inner scroll. */
  accordionBody: '@container border-t border-border/60 bg-muted/20 px-2 pb-2 pt-1.5 space-y-2',
  collapsibleBody: 'border-t border-border/60 bg-muted/20 px-2.5 pb-2 pt-1.5 space-y-2',
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
  tabStrip: 'flex min-w-0 shrink-0 items-stretch border-b border-border min-h-11',
  tabStripTabs: 'flex min-w-0 flex-1 items-stretch',
  tabBtn:
    'flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium leading-snug transition-colors',
  tabBtnLabel: 'w-full truncate text-center text-[10px] leading-snug',
  tabBtnIcon: 'h-3.5 w-3.5 shrink-0',
  tabCollapseBtn:
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-muted-foreground shadow-sm transition-colors hover:bg-muted/50 hover:text-foreground',
  /** Side panel shell — normal flex stacking; floating section chrome portals sit above via z-index. */
  panelRailStack: 'relative',
  /** Drag-to-resize column — must beat panelRailStack so toggles sit above tab strips on both sides. */
  panelResizeStack: 'relative z-[170]',
  panelEdgeToggle:
    'absolute z-[170] flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-muted-foreground shadow-sm transition-colors hover:bg-muted/50 hover:text-foreground',
  /** Mid-rail — desktop collapsed expand (away from design bar). */
  panelEdgeToggleMid: 'top-1/2 -translate-y-1/2',
  panelEdgeToggleTop: 'top-11 -translate-y-1/2',
  /** Phone/tablet collapsed — corner chips over the canvas, no side rail. */
  panelEdgeToggleCorner:
    'absolute z-[200] flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-muted-foreground shadow-md transition-colors hover:bg-muted/50 hover:text-foreground',
  panelEdgeToggleCornerLeft: 'top-2 left-2',
  panelEdgeToggleCornerRight: 'top-2 right-2',
  /** Scrollable panel body below tab strip — keeps tabs pinned while content scrolls. */
  panelBody: 'flex min-h-0 flex-1 flex-col overflow-hidden',
  panelScroll: 'min-h-0 flex-1 overflow-y-auto',
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
