import { cn } from '@/lib/utils'

/** Soft, unified chrome tokens for the section design bar. */
export const DESIGN_BAR_SOFT_BORDER = 'border-gray-100'
export const DESIGN_BAR_SOFT_RADIUS = 'rounded-lg'
export const DESIGN_BAR_SOFT_CELL =
  'text-gray-600 transition-colors duration-150 hover:bg-muted/70 active:bg-muted/90'
export const DESIGN_BAR_SOFT_ACTIVE = 'bg-primary/[0.08] text-primary hover:bg-primary/[0.12]'
export const DESIGN_BAR_SOFT_DANGER = 'text-red-500 hover:bg-red-50/80'
export const DESIGN_BAR_SOFT_INNER_BORDER = 'border-gray-100'
export const DESIGN_BAR_SOFT_DIVIDE = 'divide-gray-100'

/** Compact Visual tab — fixed row height. */
export const VISUAL_TAB_ROW_H = 'h-7'
export const VISUAL_TAB_MIN_H = 'min-h-0'

/** Two stacked visual rows + 1px gutter — matches focal pad beside image controls. */
export const VISUAL_IMAGE_TOOLBAR_STACK_H = 'h-[3.5625rem]'
export const VISUAL_IMAGE_TOOLBAR_STACK_W = 'w-[3.5625rem]'

/** 3×3 focal / pan pad — same chrome as {@link visualPanel}. */
export const visualFocalPad = cn(
  'grid shrink-0 grid-cols-3 grid-rows-3 overflow-hidden bg-white border',
  DESIGN_BAR_SOFT_RADIUS,
  DESIGN_BAR_SOFT_BORDER,
  VISUAL_IMAGE_TOOLBAR_STACK_H,
  VISUAL_IMAGE_TOOLBAR_STACK_W,
  '[&>*:nth-child(3n)]:border-r-0 [&>*:nth-child(n+7)]:border-b-0',
)

export const visualFocalCell = cn(
  'flex min-h-0 min-w-0 items-center justify-center border-r border-b text-gray-600',
  DESIGN_BAR_SOFT_INNER_BORDER,
  DESIGN_BAR_SOFT_CELL,
)

export const visualFocalCorner = cn(
  'min-h-0 min-w-0 border-r border-b bg-gray-50/40',
  DESIGN_BAR_SOFT_INNER_BORDER,
)

export const visualPanel =
  cn('inline-flex items-stretch shrink-0 overflow-hidden bg-white', DESIGN_BAR_SOFT_RADIUS, 'border', DESIGN_BAR_SOFT_BORDER)

export const visualPanelCell =
  cn(
    VISUAL_TAB_ROW_H,
    'flex min-w-0 items-center justify-center gap-0.5 border-r px-1 text-[9px] font-medium leading-none last:border-r-0',
    DESIGN_BAR_SOFT_INNER_BORDER,
    DESIGN_BAR_SOFT_CELL,
  )

export const visualPanelCellActive = DESIGN_BAR_SOFT_ACTIVE

export const visualPanelCellMuted = 'text-gray-500'

export const visualChip =
  cn(
    VISUAL_TAB_ROW_H,
    'flex items-center px-1.5 text-[8px] font-semibold uppercase tracking-wide text-primary bg-primary/[0.06] border-r shrink-0',
    DESIGN_BAR_SOFT_INNER_BORDER,
  )

export const visualMeta =
  cn(
    VISUAL_TAB_ROW_H,
    'flex items-center px-1.5 tabular-nums text-[8px] font-medium text-gray-400 border-r shrink-0',
    DESIGN_BAR_SOFT_INNER_BORDER,
  )

/** Section / media dropdown trigger — icon + short label, auto width. */
export const visualSectionBtn =
  cn(
    VISUAL_TAB_ROW_H,
    'relative flex shrink-0 items-center gap-1 bg-white px-2 text-[9px] font-medium leading-none whitespace-nowrap border',
    DESIGN_BAR_SOFT_RADIUS,
    DESIGN_BAR_SOFT_BORDER,
    DESIGN_BAR_SOFT_CELL,
  )

/** Visual tab section menus (Insert, Icons, Visuals, Effects…) — avoids clipped descenders. */
export const visualTabMenuBtn = cn(
  VISUAL_TAB_ROW_H,
  'relative flex shrink-0 items-center gap-1 bg-white px-2 text-[9px] font-medium leading-snug whitespace-nowrap border',
  DESIGN_BAR_SOFT_RADIUS,
  DESIGN_BAR_SOFT_BORDER,
  DESIGN_BAR_SOFT_CELL,
)

/** Primary insert action — same height as the rest of the visual bar. */
export const visualInsertBtn =
  cn(
    VISUAL_TAB_ROW_H,
    'flex shrink-0 items-center gap-1 px-2 text-[10px] font-medium leading-none whitespace-nowrap border bg-white',
    DESIGN_BAR_SOFT_RADIUS,
    DESIGN_BAR_SOFT_BORDER,
    DESIGN_BAR_SOFT_CELL,
  )

/** Visual tab Insert — matches {@link visualTabMenuBtn} text rhythm. */
export const visualTabInsertBtn = cn(
  VISUAL_TAB_ROW_H,
  'flex shrink-0 items-center gap-1 px-2 text-[10px] font-medium leading-snug whitespace-nowrap border bg-white',
  DESIGN_BAR_SOFT_RADIUS,
  DESIGN_BAR_SOFT_BORDER,
  DESIGN_BAR_SOFT_CELL,
)

export function visualInsertBtnClass(active: boolean, visualTab = false) {
  return cn(
    visualTab ? visualTabInsertBtn : visualInsertBtn,
    active && cn(DESIGN_BAR_SOFT_ACTIVE, 'border-primary/20'),
  )
}

export function visualActionBtn(variant: 'sky' | 'emerald' | 'primary' | 'muted' | 'link') {
  return cn(
    visualPanelCell,
    variant === 'sky' && 'bg-sky-600 text-white hover:bg-sky-500',
    variant === 'emerald' && 'bg-emerald-600 text-white hover:bg-emerald-500',
    variant === 'primary' && 'bg-primary text-white hover:bg-primary/90',
    variant === 'muted' && 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    variant === 'link' && 'bg-emerald-600 text-white hover:bg-emerald-500',
  )
}

export function visualIconBtn(active?: boolean) {
  return cn(
    VISUAL_TAB_ROW_H,
    'flex w-7 shrink-0 items-center justify-center bg-white border',
    DESIGN_BAR_SOFT_RADIUS,
    DESIGN_BAR_SOFT_BORDER,
    DESIGN_BAR_SOFT_CELL,
    active && cn(DESIGN_BAR_SOFT_ACTIVE, 'border-primary/20'),
  )
}

export function visualMenuTrigger(active: boolean, accent?: 'primary' | 'blue' | 'emerald') {
  return cn(
    visualSectionBtn,
    active && visualPanelCellActive,
    !active && visualPanelCellMuted,
    accent === 'blue' && active && 'bg-blue-100 text-blue-700 border-blue-200',
    accent === 'emerald' && active && 'bg-emerald-100 text-emerald-700 border-emerald-200',
  )
}

export function visualTabMenuTrigger(active: boolean, accent?: 'primary' | 'blue' | 'emerald') {
  return cn(
    visualTabMenuBtn,
    active && visualPanelCellActive,
    !active && visualPanelCellMuted,
    accent === 'blue' && active && 'bg-blue-100 text-blue-700 border-blue-200',
    accent === 'emerald' && active && 'bg-emerald-100 text-emerald-700 border-emerald-200',
  )
}

export const visualSegmentTrack =
  cn(VISUAL_TAB_ROW_H, 'inline-flex overflow-hidden bg-white shrink-0 border', DESIGN_BAR_SOFT_RADIUS, DESIGN_BAR_SOFT_BORDER)

export function visualSegmentBtn(active: boolean) {
  return cn(
    'flex h-full min-w-[1.75rem] items-center justify-center px-2 text-[8px] font-semibold uppercase tracking-wide transition-colors duration-150 border-r last:border-r-0',
    DESIGN_BAR_SOFT_INNER_BORDER,
    active ? cn(DESIGN_BAR_SOFT_ACTIVE, 'font-medium') : cn('text-gray-600', DESIGN_BAR_SOFT_CELL),
  )
}

export const visualStepperCell =
  cn(VISUAL_TAB_ROW_H, 'flex w-6 shrink-0 items-center justify-center border-r text-gray-600', DESIGN_BAR_SOFT_INNER_BORDER, DESIGN_BAR_SOFT_CELL)

export const visualStepperValue =
  cn(
    VISUAL_TAB_ROW_H,
    'flex min-w-[1.75rem] shrink-0 items-center justify-center overflow-hidden border-r bg-white px-1 text-[8px] font-medium tabular-nums text-gray-700',
    DESIGN_BAR_SOFT_INNER_BORDER,
  )

export const visualRow = 'flex min-h-[1.75rem] flex-nowrap items-center gap-0.5'

export const visualRowWrap = 'flex min-h-[1.75rem] flex-wrap items-center gap-0.5'

/** Vertical divider between control groups in the visual bar. */
export const visualGroupDivider = 'mx-0.5 h-7 w-px shrink-0 self-center bg-gray-100'

/** Section styling menus — single horizontal row. */
export const visualSectionRow =
  'flex shrink-0 flex-wrap items-center gap-0.5'

/** Layer controls — inline with siblings; do not grow to full bar width. */
export const visualLayerCol =
  'flex min-w-0 shrink flex-col justify-center gap-0.5'

/** Tallest single-row design-bar content (General h-14; image focal pad ≈ 3×h-5). */
export const DESIGN_BAR_ROW_H = 'min-h-[3.75rem]'

/** Design bar shell */
export const designBarRoot = 'flex w-full min-w-0 shrink-0 flex-col'

/** Tab panel — grows vertically when tool clusters wrap (no horizontal scroll). */
export const designBarTabPanel = cn(
  'z-[80] flex min-h-[4.25rem] w-full min-w-0 shrink-0 items-start gap-0 overflow-x-hidden overflow-y-visible bg-white px-1 py-0.5',
)

/** Tab panel slot — single flowing row; wraps tool clusters when narrow. */
export const designBarTabSlot = cn(
  'flex min-h-[3.75rem] min-w-0 w-full flex-1 flex-wrap items-center gap-1.5 overflow-x-hidden overflow-y-visible content-start py-1',
)

/** Toolbar row — wraps within panel width (no horizontal scrollbar). */
export const visualToolbarRow =
  'flex min-w-0 w-full flex-wrap items-center gap-1.5'

/** Layer tools — wrap within panel width (no horizontal scrollbar). */
export const visualToolbarRowWrap =
  'flex min-w-0 w-full flex-wrap items-center gap-1.5'

/** Visual tab with a selected layer — two tight rows, same min-height as other tabs. */
export const visualTabShellLayer = cn(
  DESIGN_BAR_ROW_H,
  'flex min-w-0 w-full flex-1 flex-col justify-start gap-px overflow-x-hidden overflow-y-visible py-0',
)

/** General tab — shared chrome for edit / clipboard / typography clusters. */
export const generalDesignBarCluster = cn(
  'inline-flex h-14 shrink-0 overflow-hidden bg-white border',
  DESIGN_BAR_SOFT_RADIUS,
  DESIGN_BAR_SOFT_BORDER,
)

export const generalDesignBarCell = cn(
  'flex h-full items-center justify-center border-r last:border-r-0',
  DESIGN_BAR_SOFT_INNER_BORDER,
  DESIGN_BAR_SOFT_CELL,
)

/** 2×2 action grid — edit / case / format / clear. */
export const generalDesignBarGrid2x2 = cn(
  generalDesignBarCluster,
  'grid w-20 grid-cols-2 grid-rows-2',
)

export const generalDesignBarGridCell =
  cn('flex h-full w-full min-h-0 items-center justify-center', DESIGN_BAR_SOFT_CELL)

/**
 * Same 2×2 grid, but stacked in a column shell so a full-width Delete row can
 * sit below the inset without overflowing the fixed-height grid cells.
 */
export const generalDesignBarStack = cn(
  generalDesignBarCluster,
  'h-auto w-20 flex-col',
)

export const generalDesignBarGrid2x2Rows = 'grid h-14 shrink-0 grid-cols-2 grid-rows-2'

/** Full-width Delete row under the 2×2 inset — appears only when an element is selected. */
export const generalDesignBarDeleteRow = cn(
  'flex h-6 w-full shrink-0 items-center justify-center gap-1 border-t text-[9px] font-medium uppercase tracking-wide',
  DESIGN_BAR_SOFT_INNER_BORDER,
  DESIGN_BAR_SOFT_DANGER,
)

/** Insert (+ optional Delete) — compact row; grows to h-14 when Delete is shown. */
export const generalDesignBarInsertStack = cn(
  'inline-flex shrink-0 overflow-hidden bg-white border flex-col',
  DESIGN_BAR_SOFT_RADIUS,
  DESIGN_BAR_SOFT_BORDER,
)

/** Insert cell inside {@link generalDesignBarInsertStack}. */
export function generalDesignBarInsertBtnClass(active: boolean, stackedBelow?: boolean) {
  return cn(
    generalDesignBarGridCell,
    VISUAL_TAB_ROW_H,
    'shrink-0 gap-0.5 px-1.5 text-[9px] font-medium leading-none whitespace-nowrap',
    stackedBelow ? 'w-full' : 'w-auto',
    active && DESIGN_BAR_SOFT_ACTIVE,
  )
}

/** Delete cell under Insert — same rhythm as edit-grid cells. */
export const generalDesignBarDeleteCell = cn(
  generalDesignBarGridCell,
  'h-7 shrink-0 flex-col gap-0 border-t px-0.5 text-[8px] font-medium leading-none',
  DESIGN_BAR_SOFT_INNER_BORDER,
  DESIGN_BAR_SOFT_DANGER,
)

/** Inner toolbar button — clipboard rows, etc. */
export const generalDesignBarInnerBtn = cn(
  'flex flex-1 items-center justify-center',
  DESIGN_BAR_SOFT_CELL,
)

export const visualTabShell = cn(
  designBarTabSlot,
  'min-h-[3.75rem] self-center py-0',
)

/** Tab strip row */
export const designBarTabHeader =
  'flex items-center gap-2 border-b border-gray-200 bg-gray-100/90 px-2 py-1'

/** Section design-bar tabs — General / Visual / Section image only. */
export const designBarTabList = 'flex shrink-0 items-center gap-1'

export function designBarTabClass(active: boolean) {
  return cn(
    'rounded-lg px-2.5 py-1 text-xs font-medium leading-snug transition-colors duration-150',
    active
      ? cn(DESIGN_BAR_SOFT_ACTIVE, 'border border-primary/15')
      : 'border border-transparent text-gray-600 hover:bg-muted/60 hover:text-gray-800',
  )
}
