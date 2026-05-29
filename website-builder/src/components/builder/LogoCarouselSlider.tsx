import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { clampIntervalSeconds } from '../../lib/sectionSlider'

interface LogoCarouselSliderProps {
  slideCount: number
  mode: 'manual' | 'auto'
  intervalSeconds?: number
  renderSlide: (index: number) => React.ReactNode
  /** White arrows & dots for gradient / dark section backgrounds */
  lightControls?: boolean
}

export function LogoCarouselSlider({
  slideCount,
  mode,
  intervalSeconds,
  renderSlide,
  lightControls = false,
}: LogoCarouselSliderProps) {
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

  const arrowClass = lightControls
    ? 'shrink-0 p-1 text-white/85 transition hover:text-white disabled:opacity-30'
    : 'shrink-0 rounded-full border border-gray-200 bg-white p-2 shadow-sm transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800'

  const dotActive = lightControls ? 'bg-white' : 'bg-brand-600'
  const dotIdle = lightControls
    ? 'border-2 border-white/70 bg-transparent hover:border-white'
    : 'bg-gray-300 hover:bg-gray-400 dark:bg-gray-600'

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
        {safeCount > 1 ? (
          <button type="button" onClick={() => go(-1)} className={arrowClass} aria-label="Previous">
            <ChevronLeft className={lightControls ? 'h-9 w-9 md:h-10 md:w-10' : 'h-5 w-5'} strokeWidth={lightControls ? 2.5 : 2} />
          </button>
        ) : (
          <span className="w-0 shrink-0 sm:w-8" aria-hidden />
        )}

        <div className="min-w-0 flex-1 overflow-hidden">{renderSlide(safeIndex)}</div>

        {safeCount > 1 ? (
          <button type="button" onClick={() => go(1)} className={arrowClass} aria-label="Next">
            <ChevronRight className={lightControls ? 'h-9 w-9 md:h-10 md:w-10' : 'h-5 w-5'} strokeWidth={lightControls ? 2.5 : 2} />
          </button>
        ) : (
          <span className="w-0 shrink-0 sm:w-8" aria-hidden />
        )}
      </div>

      {safeCount > 1 && (
        <div className="mt-6 flex justify-center gap-2.5">
          {Array.from({ length: safeCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-2.5 w-2.5 rounded-full transition ${i === safeIndex ? dotActive : dotIdle}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
