import { cn } from '@/lib/utils'

/** Compact Visual tab — fixed row height. */
export const VISUAL_TAB_ROW_H = 'h-7'
export const VISUAL_TAB_MIN_H = 'min-h-0'

export const visualPanel =
  'inline-flex items-stretch shrink-0 overflow-hidden rounded-md border border-gray-200 bg-white'

export const visualPanelCell =
  cn(
    VISUAL_TAB_ROW_H,
    'flex min-w-0 items-center justify-center gap-0.5 border-r border-gray-200 px-1 text-[9px] font-bold leading-none transition-colors last:border-r-0 hover:bg-accent',
  )

export const visualPanelCellActive = 'bg-primary/10 text-primary'

export const visualPanelCellMuted = 'text-gray-500'

export const visualChip =
  cn(
    VISUAL_TAB_ROW_H,
    'flex items-center px-1.5 text-[8px] font-bold uppercase tracking-wide text-primary bg-accent border-r border-gray-200 shrink-0',
  )

export const visualMeta =
  cn(
    VISUAL_TAB_ROW_H,
    'flex items-center px-1.5 tabular-nums text-[8px] font-medium text-gray-400 border-r border-gray-200 shrink-0',
  )

/** Section / media dropdown trigger — icon + short label, auto width. */
export const visualSectionBtn =
  cn(
    VISUAL_TAB_ROW_H,
    'relative flex shrink-0 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-[9px] font-semibold leading-none whitespace-nowrap transition-colors hover:bg-accent',
  )

/** Visual tab section menus (Insert, Icons, Visuals, Effects…) — avoids clipped descenders. */
export const visualTabMenuBtn = cn(
  VISUAL_TAB_ROW_H,
  'relative flex shrink-0 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-[9px] font-semibold leading-snug whitespace-nowrap transition-colors hover:bg-accent',
)

/** Primary insert action — same height as the rest of the visual bar. */
export const visualInsertBtn =
  cn(
    VISUAL_TAB_ROW_H,
    'flex shrink-0 items-center gap-1 rounded-md border px-2 text-[10px] font-bold leading-none whitespace-nowrap transition-colors',
  )

/** Visual tab Insert — matches {@link visualTabMenuBtn} text rhythm. */
export const visualTabInsertBtn = cn(
  VISUAL_TAB_ROW_H,
  'flex shrink-0 items-center gap-1 rounded-md border px-2 text-[10px] font-bold leading-snug whitespace-nowrap transition-colors',
)

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
    'flex w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white transition-colors hover:bg-accent',
    active && 'border-primary/40 bg-primary/10 text-primary',
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
  cn(VISUAL_TAB_ROW_H, 'inline-flex overflow-hidden rounded-md border border-gray-200 bg-gray-50 shrink-0')

export function visualSegmentBtn(active: boolean) {
  return cn(
    'flex h-full items-center px-1.5 text-[8px] font-bold uppercase tracking-wide transition-colors border-r border-gray-200 last:border-r-0',
    active ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100',
  )
}

export const visualStepperCell =
  cn(VISUAL_TAB_ROW_H, 'flex w-5 shrink-0 items-center justify-center border-r border-gray-200 text-gray-700 transition-colors hover:bg-gray-50')

export const visualStepperValue =
  cn(
    VISUAL_TAB_ROW_H,
    'flex w-[1.75rem] shrink-0 items-center justify-center overflow-hidden border-r border-gray-200 bg-white px-0.5 text-[8px] font-bold tabular-nums text-gray-800',
  )

export const visualRow = 'flex min-h-[1.75rem] flex-nowrap items-center gap-0.5'

export const visualRowWrap = 'flex min-h-[1.75rem] flex-wrap items-center gap-0.5'

/** Vertical divider between control groups in the visual bar. */
export const visualGroupDivider = 'mx-0.5 h-7 w-px shrink-0 self-center bg-gray-200'

/** Section styling menus — single horizontal row. */
export const visualSectionRow =
  'flex shrink-0 flex-wrap items-center gap-0.5'

/** Layer controls — inline with siblings; do not grow to full bar width. */
export const visualLayerCol =
  'flex min-w-0 shrink flex-col justify-center gap-0.5'

/** Tallest single-row design-bar content (General h-14; image focal pad ≈ 3×h-5). */
export const DESIGN_BAR_ROW_H = 'min-h-[3.75rem]'

/** Tab panel slot — min height for cross-tab stability; grows only if needed. */
export const designBarTabSlot = cn(
  DESIGN_BAR_ROW_H,
  'flex min-w-0 flex-1 items-center overflow-x-auto overflow-y-visible overscroll-x-contain',
)

/** Toolbar row — single line; scroll horizontally when narrow (General tab). */
export const visualToolbarRow =
  'flex w-max max-w-full flex-nowrap items-center gap-0.5 shrink-0'

/** Layer tools — wrap within panel width (no horizontal scrollbar). */
export const visualToolbarRowWrap =
  'flex min-w-0 w-full flex-wrap items-center gap-0.5'

/** Visual tab with a selected layer — two tight rows, same min-height as other tabs. */
export const visualTabShellLayer = cn(
  DESIGN_BAR_ROW_H,
  'flex min-w-0 w-full flex-1 flex-col justify-start gap-px overflow-hidden py-0',
)

/** General tab — shared chrome for edit / clipboard / typography clusters. */
export const generalDesignBarCluster =
  'inline-flex h-14 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm'

export const generalDesignBarCell =
  'flex h-full items-center justify-center border-r border-gray-200 text-gray-700 transition-colors hover:bg-accent last:border-r-0'

/** 2×2 action grid — edit / case / format / clear. */
export const generalDesignBarGrid2x2 = cn(
  generalDesignBarCluster,
  'grid w-20 grid-cols-2 grid-rows-2',
)

export const generalDesignBarGridCell =
  'flex h-full w-full min-h-0 items-center justify-center text-gray-700 transition-colors hover:bg-accent'

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
export const generalDesignBarDeleteRow =
  'flex h-6 w-full shrink-0 items-center justify-center gap-1 border-t border-gray-200 text-[9px] font-bold uppercase tracking-wide text-red-600 transition-colors hover:bg-red-50'

export const visualTabShell = cn(
  designBarTabSlot,
  'py-0',
)

/** Section design-bar tabs — General / Visual / Section image only. */
export const designBarTabList = 'flex shrink-0 items-center gap-1'

export function designBarTabClass(active: boolean) {
  return cn(
    'rounded-md border px-2.5 py-1 text-xs font-semibold leading-snug transition-colors',
    active
      ? 'border-primary/60 bg-white text-primary shadow-sm ring-1 ring-primary/20'
      : 'border-gray-200 bg-white/80 text-gray-700 hover:border-gray-300 hover:bg-white hover:text-gray-900',
  )
}
