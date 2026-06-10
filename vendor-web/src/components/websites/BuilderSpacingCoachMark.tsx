import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BUILDER_SPACING_TIP_KEY,
  dismissCoachMark,
  readCoachMarkDismissed,
} from '@/lib/builderCoachMarks'

export function readBuilderSpacingTipDismissed(): boolean {
  return readCoachMarkDismissed(BUILDER_SPACING_TIP_KEY)
}

export function dismissBuilderSpacingTip(): void {
  dismissCoachMark(BUILDER_SPACING_TIP_KEY)
}

/** One-time tip: green padding handles on selected sections. */
export function BuilderSpacingCoachMark({
  visible,
  dismissed,
  onDismiss,
  className,
}: {
  visible: boolean
  dismissed: boolean
  onDismiss: () => void
  className?: string
}) {
  if (!visible || dismissed) return null

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 bg-primary/10 border-b border-primary/20 text-[11px] text-primary/90',
        className,
      )}
    >
      <span className="flex-1 min-w-0 leading-snug">
        <strong className="font-semibold">Adjust spacing:</strong> drag the green line at the top or bottom edge of the selected section (pill handle).
      </span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 p-1 rounded hover:bg-primary/15 text-primary/70"
        aria-label="Dismiss spacing tip"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
