import { useEffect, useState } from 'react'
import { viewportBreakpointLabel } from '@/lib/viewportPanel'

/** Dev-only: shows live viewport size for responsive QA (mobile / tablet / desktop). */
export default function ResponsiveViewportBadge() {
  const [size, setSize] = useState(() =>
    typeof window !== 'undefined'
      ? { w: window.innerWidth, h: window.innerHeight }
      : { w: 0, h: 0 },
  )

  useEffect(() => {
    const onResize = () => {
      setSize({ w: window.innerWidth, h: window.innerHeight })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (!import.meta.env.DEV || size.w === 0) return null

  return (
    <div
      className="pointer-events-none fixed bottom-2 left-2 z-[200] rounded-md border border-border/80 bg-card/95 px-2 py-1 font-mono text-[10px] text-muted-foreground shadow-sm backdrop-blur-sm"
      aria-hidden
    >
      {size.w}×{size.h} · {viewportBreakpointLabel(size.w)}
    </div>
  )
}
