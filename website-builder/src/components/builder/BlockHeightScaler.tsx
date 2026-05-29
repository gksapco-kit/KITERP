import { useLayoutEffect, useRef, useState } from 'react'

const MIN_HEIGHT_PX = 22

function parseHeightPx(value?: string): number | null {
  if (!value?.trim()) return null
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/)
  return match ? Number(match[1]) : null
}

interface BlockHeightScalerProps {
  height?: string
  /** When true, keep natural height fixed so resize drag does not jitter */
  freezeMeasurement?: boolean
  children: React.ReactNode
}

/**
 * Fits block content into a target height by scaling vertically (no clipping).
 */
export function BlockHeightScaler({ height, freezeMeasurement = false, children }: BlockHeightScalerProps) {
  const targetPx = parseHeightPx(height)
  const innerRef = useRef<HTMLDivElement>(null)
  const [naturalHeight, setNaturalHeight] = useState(0)
  const frozenNaturalRef = useRef(0)

  useLayoutEffect(() => {
    if (freezeMeasurement) {
      if (frozenNaturalRef.current === 0 && naturalHeight > 0) {
        frozenNaturalRef.current = naturalHeight
      }
      return
    }

    const root = innerRef.current
    if (!root) return

    const measure = () => {
      const block = root.querySelector('.builder-block') as HTMLElement | null
      const h = block?.offsetHeight ?? root.scrollHeight
      if (h > 0) {
        setNaturalHeight(h)
        frozenNaturalRef.current = h
      }
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(root)
    const block = root.querySelector('.builder-block')
    if (block) ro.observe(block)

    return () => ro.disconnect()
  }, [children, height, freezeMeasurement])

  if (!targetPx) {
    return <div ref={innerRef}>{children}</div>
  }

  const safeNatural = Math.max(freezeMeasurement ? frozenNaturalRef.current || naturalHeight : naturalHeight, 1)
  const scaleY = Math.max(targetPx / safeNatural, MIN_HEIGHT_PX / safeNatural)

  return (
    <div
      className="w-full overflow-hidden"
      style={{ height: targetPx }}
      data-block-height={targetPx}
    >
      <div
        ref={innerRef}
        className="w-full origin-top"
        style={{
          height: safeNatural,
          transform: `scaleY(${scaleY})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
