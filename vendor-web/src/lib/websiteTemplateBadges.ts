/** Light outline badges matching Apply button styling on Website Templates. */
export const templateBadgeVioletClass =
  'inline-flex max-w-[calc(100%-0.75rem)] items-center gap-0.5 truncate whitespace-nowrap rounded-full border border-violet-200 bg-violet-50/95 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-violet-700 shadow-sm'

export const templateBadgeEmeraldClass =
  'inline-flex max-w-[calc(100%-0.75rem)] items-center gap-0.5 truncate whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50/95 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 shadow-sm'

/** Shared shell for Website Templates gallery cards — pointer + lift on hover. */
export const templateCardShellClass =
  'group/card flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-200/90 bg-white text-left shadow-sm transition-all duration-200 ease-out hover:border-primary/55 hover:ring-2 hover:ring-primary/20 hover:shadow-[0_14px_36px_rgba(19,98,74,0.16)] motion-safe:hover:-translate-y-1'

export const templateCardMediaHeightClass = 'h-24 sm:h-28'

export const templateCardBodyClass =
  'flex flex-col p-2.5 pt-2 transition-colors group-hover/card:bg-primary/[0.02]'

export const templateCardActionBtnClass =
  'inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-extrabold transition-colors'

export const templateCardPreviewOverlayClass =
  'pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover/card:bg-black/30 group-hover/card:opacity-100'

/** Ribbon on template cards assigned to the currently selected business unit. */
export const templateCardCurrentForStoreRibbonClass =
  'absolute left-0 top-0 z-10 rounded-br-md rounded-tl-2xl bg-emerald-600 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white shadow-sm'

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
  if (assignedElsewhere) return `Use for ${contextStoreCode}`
  return `Assign to ${contextStoreCode}`
}
