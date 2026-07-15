import { cn } from '@/lib/utils'

/** Modal max-width scale — three steps wider than typical dialog defaults for form-heavy UIs */
export const modalWidthSm = 'max-w-xl'
export const modalWidthMd = 'max-w-2xl'
export const modalWidthLg = 'max-w-3xl'
export const modalWidthXl = 'max-w-4xl'
export const modalWidth2xl = 'max-w-5xl'
export const modalWidth3xl = 'max-w-6xl'
export const modalWidth4xl = 'max-w-7xl'
export const modalWidth5xl = 'max-w-7xl'
export const modalDefaultMaxWidth = modalWidthLg

/** Full-screen modal backdrop — z-[100] sits above sticky form bars (z-10–z-30) and dashboard chrome */
export const modalOverlayClass =
  'fixed inset-0 z-[100] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-hidden overscroll-none'

/** Vertically centered backdrop (legacy pages) */
export const modalOverlayCenterClass =
  'fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-hidden overscroll-none'

/**
 * Drop-in classes for handcrafted dialogs (not using ModalOverlay/ModalPanel).
 * Overlay never scrolls; panel is a flex column; put scroll only on dialogBodyClass.
 */
export const dialogOverlayClass =
  'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-hidden overscroll-none'

export const dialogOverlayClassZ60 =
  'fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-hidden overscroll-none'

export const dialogPanelClass =
  'bg-card border border-border text-foreground rounded-xl shadow-2xl w-full my-auto max-h-[min(92dvh,calc(100vh-1.5rem))] flex flex-col overflow-hidden'

export const dialogHeaderClass =
  'shrink-0 border-b border-border px-5 py-4'

export const dialogBodyClass =
  'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4'

export const dialogFooterClass =
  'shrink-0 border-t border-border bg-muted/25 px-5 py-4 flex gap-2 justify-end'

/** Standard dialog panel shell */
export const modalPanelClass =
  `bg-card border border-border text-foreground rounded-xl shadow-2xl w-full ${modalDefaultMaxWidth} my-auto max-h-[min(92dvh,calc(100vh-1.5rem))] flex flex-col overflow-hidden`

export const modalPanel2xlClass =
  'bg-card border border-border text-foreground rounded-2xl shadow-2xl w-full max-h-[min(92dvh,calc(100vh-1.5rem))] overflow-hidden flex flex-col'

/** Scrollable main area when a modal has a pinned footer. */
export const modalBodyScrollClass =
  'flex-1 overflow-y-auto overscroll-contain px-6 pt-6 min-h-0'

export const modalHeaderClass =
  'p-5 border-b border-border flex items-start justify-between gap-3 shrink-0'

export const modalHeaderStickyClass =
  'flex items-center justify-between gap-3 px-6 py-4 border-b border-border sticky top-0 bg-card z-10 shrink-0'

export const modalBodyClass = 'p-5 space-y-4 overflow-y-auto flex-1 min-h-0'
export const modalBodyPadClass = 'p-6 overflow-y-auto flex-1 min-h-0'

export const modalFooterClass =
  'p-4 border-t border-border bg-muted/25 flex gap-3 justify-end shrink-0 overflow-visible'

export const modalTitleClass = 'font-semibold text-lg text-foreground'
export const modalCloseBtnClass =
  'p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0'

/** Dropdown / action menu popover (not a full dialog) */
export const popoverMenuClass =
  'bg-popover text-popover-foreground rounded-lg border border-border shadow-lg z-50 py-1 max-h-[min(90vh,24rem)] overflow-y-auto'

export function modalPanelClassName(extra?: string) {
  return cn(modalPanelClass, extra)
}

export function modalPanel2xlClassName(extra?: string) {
  return cn(modalPanel2xlClass, extra)
}

/** Slide-over drawer panel (right edge) */
export const modalDrawerPanelClass =
  'bg-card border-l border-border text-foreground shadow-2xl overflow-y-auto'

export const modalDrawerPanelFullHeightClass =
  'bg-card border-l border-border text-foreground shadow-2xl flex flex-col overflow-hidden h-full'
