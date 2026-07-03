import { Eye, Rocket, Save, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BUILDER_DRAFT_GUIDE_KEY,
  dismissCoachMark,
  readCoachMarkDismissed,
  restoreCoachMark,
} from '@/lib/builderCoachMarks'

export function readBuilderDraftGuideDismissed(): boolean {
  return readCoachMarkDismissed(BUILDER_DRAFT_GUIDE_KEY)
}

export function dismissBuilderDraftGuide(): void {
  dismissCoachMark(BUILDER_DRAFT_GUIDE_KEY)
}

export function restoreBuilderDraftGuide(): void {
  restoreCoachMark(BUILDER_DRAFT_GUIDE_KEY)
}

/** Plain-language explainer: working copy vs what customers see. */
export function BuilderDraftLiveGuide({
  isPublished,
  dismissed,
  onDismiss,
  onRestore,
  className,
}: {
  isPublished: boolean
  dismissed: boolean
  onDismiss: () => void
  onRestore?: () => void
  className?: string
}) {
  if (dismissed) {
    return (
      <div
        className={cn(
          'relative z-30 shrink-0 flex items-center gap-2 px-3 sm:px-5 py-1.5 border-b border-amber-500/25 bg-amber-950/40',
          className,
        )}
      >
        <p className="flex-1 min-w-0 text-[11px] text-amber-100/90 leading-snug truncate">
          <strong className="font-semibold text-amber-50">Draft ≠ live</strong>
          — Save keeps a private copy; Publish store is what customers see.
        </p>
        <button
          type="button"
          onClick={() => onRestore?.()}
          className="shrink-0 px-2 py-1 rounded-md text-[10px] font-bold text-amber-50 bg-amber-500/25 border border-amber-400/40 hover:bg-amber-500/35 transition-colors"
        >
          Show full guide
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative z-30 shrink-0 border-b border-amber-500/30 border-l-4 border-l-amber-400 px-3 sm:px-5 py-2.5',
        'bg-gradient-to-r from-slate-800 via-gray-900 to-emerald-950/50 shadow-inner',
        className,
      )}
    >
      <div className="flex items-start gap-3 max-w-6xl">
        <div className="flex-1 min-w-0 grid gap-2 sm:grid-cols-3 sm:gap-4 text-[11px] leading-snug">
          <div className="flex gap-2">
            <Save className="w-3.5 h-3.5 shrink-0 text-amber-300 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Your working copy</p>
              <p className="text-gray-400 mt-0.5">
                Edits here are saved automatically. Customers do not see them until you publish.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Eye className="w-3.5 h-3.5 shrink-0 text-sky-300 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Preview in Browser</p>
              <p className="text-gray-400 mt-0.5">
                Safe check of your draft — like a private rehearsal before going live.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Rocket className="w-3.5 h-3.5 shrink-0 text-emerald-300 mt-0.5" />
            <div>
              <p className="font-semibold text-white">
                {isPublished ? 'Publish store again' : 'Publish store'}
              </p>
              <p className="text-gray-400 mt-0.5">
                {isPublished
                  ? 'Push your latest draft so customers see the updated site.'
                  : 'Makes your design visible on your store link for real customers.'}
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Dismiss guide"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
