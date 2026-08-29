import { type RefObject } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBuilderSectionBox } from '@/components/websites/BuilderSectionOverlay'

const GAP_CONTROL_HEIGHT = 28
/** Nudge below the seam when blocks are flush so padding pills stay separated. */
const FLUSH_SEAM_OFFSET = 24

/** "+ Section" control between canvas blocks — inserts at `insertAtIdx` (after `afterBlockId`). */
export function BuilderCanvasSectionGap({
  afterBlockId,
  beforeBlockId,
  insertAtIdx,
  containerRef,
  scrollRootRef,
  revision,
  layoutScale = 1,
  onAdd,
}: {
  afterBlockId: string
  /** Next block below — used to center the control in any gap between sections. */
  beforeBlockId?: string
  insertAtIdx: number
  containerRef: RefObject<HTMLElement | null>
  scrollRootRef?: RefObject<HTMLElement | null>
  revision?: string
  layoutScale?: number
  onAdd: (insertAtIdx: number) => void
}) {
  const afterBox = useBuilderSectionBox(afterBlockId, containerRef, revision, scrollRootRef, layoutScale)
  const beforeBox = useBuilderSectionBox(
    beforeBlockId ?? '',
    containerRef,
    revision,
    scrollRootRef,
    layoutScale,
  )
  if (!afterBox) return null

  const seamY = afterBox.top + afterBox.height
  const gapBetween = beforeBox ? beforeBox.top - seamY : 0
  const gapCenter = gapBetween > 12
    ? seamY + gapBetween / 2
    : seamY + FLUSH_SEAM_OFFSET

  return (
    <div
      className="absolute z-[44] flex items-center justify-center pointer-events-none"
      style={{
        top: gapCenter - GAP_CONTROL_HEIGHT / 2,
        left: afterBox.left,
        width: afterBox.width,
        height: GAP_CONTROL_HEIGHT,
      }}
    >
      <div className="relative flex w-full items-center justify-center px-4">
        <div className="absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-primary/20" aria-hidden />
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onAdd(insertAtIdx)
          }}
          title="Insert a new section here"
          className={cn(
            'pointer-events-auto relative z-[1] inline-flex items-center gap-1 rounded-full border border-primary/35',
            'bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary shadow-sm',
            'transition-colors hover:border-primary/60 hover:bg-primary/5',
          )}
        >
          <Plus className="h-3 w-3" />
          Section
        </button>
      </div>
    </div>
  )
}
