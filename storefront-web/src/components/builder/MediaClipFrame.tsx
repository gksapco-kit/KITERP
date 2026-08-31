import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { hasMediaClip, mediaClipNeedsSquareBox, mediaClipStyle } from '@/lib/mediaClip'

/** Wraps image/video content with an optional CSS clip-path frame. */
export function MediaClipFrame({
  clip,
  className,
  style,
  children,
}: {
  clip?: unknown
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const clipped = hasMediaClip(clip)
  const square = mediaClipNeedsSquareBox(clip)
  return (
    <div
      className={cn(
        'relative',
        clipped && 'overflow-hidden',
        className,
        /* Circle needs a round mask; do not force aspect-square here (heroes use inset-0). */
        square && 'rounded-full',
      )}
      style={{ ...mediaClipStyle(clip), ...style }}
    >
      {children}
    </div>
  )
}
