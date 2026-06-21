/** Light outline badges matching Apply button styling on Website Templates. */
export const templateBadgeVioletClass =
  'inline-flex max-w-[calc(100%-0.75rem)] items-center gap-0.5 truncate whitespace-nowrap rounded-full border border-violet-200 bg-violet-50/95 px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-violet-700 shadow-sm'

export const templateBadgeEmeraldClass =
  'inline-flex max-w-[calc(100%-0.75rem)] items-center gap-0.5 truncate whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50/95 px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-emerald-700 shadow-sm'

/** Shared shell for Website Templates gallery cards — pointer + lift on hover. */
export const templateCardShellClass =
  'group/card flex cursor-pointer flex-col overflow-hidden rounded-xl border border-gray-200/90 bg-white text-left shadow-sm transition-all duration-200 ease-out hover:border-primary/55 hover:ring-2 hover:ring-primary/20 hover:shadow-[0_10px_28px_rgba(19,98,74,0.12)] motion-safe:hover:-translate-y-0.5 dark:border-border dark:bg-card dark:hover:shadow-[0_10px_28px_rgba(0,0,0,0.3)]'

export const templateCardMediaHeightClass = 'h-[5.5rem] sm:h-24'

export const templateCardBodyClass =
  'flex min-h-0 flex-col gap-0.5 px-2 pb-2 pt-1.5 transition-colors group-hover/card:bg-primary/[0.02] dark:group-hover/card:bg-primary/5'

export const templateCardActionRowClass = 'mt-1 flex min-w-0 items-center gap-0.5'

export const templateCardActionClusterClass = 'ml-auto flex shrink-0 items-center gap-0.5'

export const templateCardActionBtnClass =
  'inline-flex shrink-0 cursor-pointer items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-bold transition-colors'

export const templateCardPrimaryActionClass =
  'inline-flex min-w-0 max-w-[58%] flex-1 cursor-pointer items-center justify-center gap-0.5 truncate rounded-md border px-1.5 py-0.5 text-[10px] font-bold transition-colors'

export const templateCardActivePillClass =
  'inline-flex min-w-0 max-w-[58%] flex-1 items-center justify-center gap-0.5 truncate rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-600'

export const templateCardActivePillEmeraldClass =
  'inline-flex min-w-0 max-w-[58%] flex-1 items-center justify-center gap-0.5 truncate rounded-md border-2 border-primary bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary'

export const templateCardPreviewOverlayClass =
  'pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover/card:bg-black/30 group-hover/card:opacity-100'

/** Ribbon on template cards assigned to the currently selected business unit. */
export const templateCardCurrentForStoreRibbonClass =
  'absolute left-0 top-0 z-10 rounded-br-md rounded-tl-xl bg-primary px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white shadow-md'

/** Selected / current-for-store template card in the gallery. */
export const templateCardSelectedClass =
  'border-2 border-primary bg-primary/[0.07] ring-2 ring-primary/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)]'

/** Selected business unit chip in storefront coverage. */
export const coverageStoreSelectedClass =
  'border-2 border-primary bg-primary/[0.1] pl-2 ring-2 ring-primary/35 shadow-sm before:absolute before:inset-y-0.5 before:left-0 before:w-1 before:rounded-full before:bg-primary'

export const templateCardMediaChipClass =
  'shrink-0 rounded-full bg-black/55 px-1.5 py-px text-[8px] font-semibold text-white backdrop-blur-sm'

export function perStoreTemplateActionLabel(
  contextStoreCode: string | null | undefined,
  assignedToContext: boolean,
  assignedElsewhere: boolean,
): string {
  if (!contextStoreCode) {
    if (assignedToContext) return 'Manage'
    if (assignedElsewhere) return 'Assign here'
    return 'Assign'
  }
  if (assignedToContext) return `Manage · ${contextStoreCode}`
  if (assignedElsewhere) return `Assign · ${contextStoreCode}`
  return `Assign · ${contextStoreCode}`
}

export function singleTemplateActionLabel(isSelected: boolean): string {
  return isSelected ? 'Assigned · all' : 'Assign · all'
}
