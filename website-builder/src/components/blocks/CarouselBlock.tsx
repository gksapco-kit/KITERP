import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CAROUSEL_DISPLAY_DEFAULTS } from '../../lib/carouselDefaults'
import type { BlockProps, CardItem } from '../../types/builder'

interface CarouselBlockProps {
  cards?: CardItem[]
  props: Pick<
    BlockProps,
    'showSlideTitle' | 'showSlideCaption' | 'showSlideArrows' | 'showSlideDots' | 'showSlideCounter'
  >
  layoutStyle?: React.CSSProperties
}

export function CarouselBlock({ cards, props, layoutStyle }: CarouselBlockProps) {
  const [idx, setIdx] = useState(0)
  const slides = cards ?? []

  useEffect(() => {
    setIdx((i) => (i >= slides.length ? Math.max(0, slides.length - 1) : i))
  }, [slides.length])
  const showTitle = props.showSlideTitle ?? CAROUSEL_DISPLAY_DEFAULTS.showSlideTitle
  const showCaption = props.showSlideCaption ?? CAROUSEL_DISPLAY_DEFAULTS.showSlideCaption
  const showArrows = props.showSlideArrows ?? CAROUSEL_DISPLAY_DEFAULTS.showSlideArrows
  const showDots = props.showSlideDots ?? CAROUSEL_DISPLAY_DEFAULTS.showSlideDots
  const showCounter = props.showSlideCounter ?? CAROUSEL_DISPLAY_DEFAULTS.showSlideCounter

  if (!slides.length) {
    return (
      <section style={layoutStyle} className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
        Add slides in the properties panel
      </section>
    )
  }

  const safeIdx = idx >= slides.length ? 0 : idx
  const slide = slides[safeIdx]
  const go = (delta: number) => setIdx((i) => (i + delta + slides.length) % slides.length)

  return (
    <section style={layoutStyle}>
      <div className="relative overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
        {slide?.imageUrl ? (
          <img src={slide.imageUrl} alt={slide.title || ''} className="h-64 w-full object-cover md:h-80" />
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-gray-400 md:h-80">No image</div>
        )}
        {showArrows && slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-5 w-5 text-gray-800" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
              aria-label="Next slide"
            >
              <ChevronRight className="h-5 w-5 text-gray-800" />
            </button>
          </>
        )}
        {showCounter && slides.length > 1 && (
          <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-0.5 text-xs font-medium text-white">
            {safeIdx + 1} / {slides.length}
          </span>
        )}
      </div>

      {(showTitle && slide?.title) || (showCaption && slide?.description) ? (
        <div className="mt-4 text-center">
          {showTitle && slide?.title && <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{slide.title}</h3>}
          {showCaption && slide?.description && (
            <p className={`text-sm text-gray-600 dark:text-gray-400 ${showTitle && slide?.title ? 'mt-1' : ''}`}>{slide.description}</p>
          )}
        </div>
      ) : null}

      {showDots && slides.length > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                i === safeIdx ? 'bg-brand-600' : 'bg-gray-300 hover:bg-gray-400 dark:bg-gray-600'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
