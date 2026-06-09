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

/** Fixed-width section dropdown trigger (right column). */
export const visualSectionBtn =
  cn(
    VISUAL_TAB_ROW_H,
    'relative flex w-[3.1rem] shrink-0 items-center justify-center gap-0.5 rounded-md border border-gray-200 bg-white px-0.5 text-[8px] font-bold leading-tight transition-colors hover:bg-accent',
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
    'flex min-w-[1.35rem] max-w-[2.1rem] shrink-0 items-center justify-center border-r border-gray-200 bg-white px-0.5 text-[8px] font-bold tabular-nums text-gray-800',
  )

export const visualRow = 'flex min-h-[1.75rem] flex-nowrap items-center gap-px'

/** Section tool grid — fixed left column, 3×2. */
export const visualSectionGrid =
  'grid shrink-0 grid-cols-3 grid-rows-2 gap-px content-start border-r border-gray-200 pr-1'

export const visualTabShell = cn(
  'flex min-w-0 flex-1 items-center gap-1 py-0',
  VISUAL_TAB_MIN_H,
)

export const visualLayerCol =
  'flex min-w-0 flex-1 flex-col justify-center gap-px'
