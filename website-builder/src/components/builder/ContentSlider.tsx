import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { clampIntervalSeconds } from '../../lib/sectionSlider'

interface ContentSliderProps {
  slideCount: number
  mode: 'manual' | 'auto'
  intervalSeconds?: number
  renderSlide: (index: number) => React.ReactNode
  className?: string
  showArrows?: boolean
  showDots?: boolean
}

export function ContentSlider({
  slideCount,
  mode,
  intervalSeconds,
  renderSlide,
  className = '',
  showArrows = true,
  showDots = true,
}: ContentSliderProps) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const interval = clampIntervalSeconds(intervalSeconds) * 1000

  const safeCount = Math.max(0, slideCount)
  const safeIndex = safeCount === 0 ? 0 : index % safeCount

  useEffect(() => {
    setIndex((i) => (safeCount === 0 ? 0 : i >= safeCount ? 0 : i))
  }, [safeCount])

  const go = useCallback(
    (delta: number) => {
      if (safeCount <= 1) return
      setIndex((i) => (i + delta + safeCount) % safeCount)
    },
    [safeCount],
  )

  useEffect(() => {
    if (mode !== 'auto' || safeCount <= 1 || paused) return
    const id = window.setInterval(() => go(1), interval)
    return () => window.clearInterval(id)
  }, [mode, safeCount, paused, interval, go])

  if (safeCount === 0) return null

  return (
    <div
      className={className}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {renderSlide(safeIndex)}

      {safeCount > 1 && (
        <div className="mt-6 flex flex-col items-center gap-3">
          {(showArrows || mode === 'manual') && showArrows && (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => go(-1)}
                className="rounded-full border border-gray-200 bg-white p-2 shadow-sm transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-5 w-5 text-gray-700 dark:text-gray-200" />
              </button>
              {mode === 'auto' && (
                <span className="min-w-[4.5rem] text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  Auto · {clampIntervalSeconds(intervalSeconds)}s
                </span>
              )}
              <button
                type="button"
                onClick={() => go(1)}
                className="rounded-full border border-gray-200 bg-white p-2 shadow-sm transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
                aria-label="Next slide"
              >
                <ChevronRight className="h-5 w-5 text-gray-700 dark:text-gray-200" />
              </button>
            </div>
          )}

          {showDots && (
            <div className="flex flex-wrap justify-center gap-2">
              {Array.from({ length: safeCount }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`h-2.5 w-2.5 rounded-full transition ${
                    i === safeIndex ? 'bg-brand-600' : 'bg-gray-300 hover:bg-gray-400 dark:bg-gray-600'
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
