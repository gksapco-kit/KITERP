import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { hasMediaClip, mediaClipStyle } from '@/lib/mediaClip'

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
  return (
    <div
      className={cn('relative', clipped && 'overflow-hidden', className)}
      style={{ ...mediaClipStyle(clip), ...style }}
    >
      {children}
    </div>
  )
}
