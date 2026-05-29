import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createLinkClickHandler } from '../../lib/buttonNavigation'
import { getHeroAnimationClass } from '../../lib/blockUtils'
import { CAROUSEL_DISPLAY_DEFAULTS } from '../../lib/carouselDefaults'
import {
  heroContentFlexClasses,
  resolveHeroContentAlignX,
  resolveHeroContentAlignY,
  resolveBlockSectionHeight,
} from '../../lib/heroSectionLayout'
import { BANNER_CONTENT_ROW_CLASS } from '../../lib/pageLayout'
import { useBuilderStore } from '../../store/useBuilderStore'
import type { Block, CardItem } from '../../types/builder'

interface HeroBannerSliderBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
  interactive?: boolean
  onNavigate?: (slug: string) => void
}

export function HeroBannerSliderBlock({ block, layoutStyle, interactive, onNavigate }: HeroBannerSliderBlockProps) {
  const pages = useBuilderStore((s) => s.pages)
  const [idx, setIdx] = useState(0)
  const p = block.props
  const slides: CardItem[] = p.cards ?? []
  const overlay = p.overlayOpacity ?? 0.45
  const showArrows = p.showSlideArrows ?? CAROUSEL_DISPLAY_DEFAULTS.showSlideArrows
  const showDots = p.showSlideDots ?? CAROUSEL_DISPLAY_DEFAULTS.showSlideDots
  const showCounter = p.showSlideCounter ?? CAROUSEL_DISPLAY_DEFAULTS.showSlideCounter
  const sectionHeight = resolveBlockSectionHeight(block)
  const alignX = resolveHeroContentAlignX(block)
  const alignY = resolveHeroContentAlignY(block)
  const contentFlex = heroContentFlexClasses(alignX, alignY)
  const textColor = block.styles.textColor ?? '#ffffff'
  const animClass = getHeroAnimationClass(block.styles.animation)
  const subtitleCenter = alignX === 'center' ? 'mx-auto' : ''

  useEffect(() => {
    setIdx((i) => (i >= slides.length ? Math.max(0, slides.length - 1) : i))
  }, [slides.length])

  if (!slides.length) {
    return (
      <section
        style={{ ...layoutStyle, minHeight: sectionHeight }}
        className="flex w-full items-center justify-center rounded-none border-2 border-dashed border-gray-300 text-sm text-gray-400"
      >
        Add slides in the properties panel
      </section>
    )
  }

  const safeIdx = idx >= slides.length ? 0 : idx
  const slide = slides[safeIdx]
  const go = (delta: number) => setIdx((i) => (i + delta + slides.length) % slides.length)
  const goTo = (i: number) => setIdx(i)
  const linkClick = (link?: string) => createLinkClickHandler({ interactive: !!interactive, link, pages, onNavigate })
  const btnRowClass =
    alignX === 'start' ? 'justify-start' : alignX === 'end' ? 'justify-end' : 'justify-center'

  return (
    <section style={layoutStyle} className={`relative w-full overflow-hidden rounded-none ${animClass}`}>
      <div className="relative w-full" style={{ minHeight: sectionHeight }}>
        {slide.imageUrl ? (
          <img src={slide.imageUrl} alt={slide.title || ''} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gray-800" />
        )}
        <div className="absolute inset-0 bg-black" style={{ opacity: overlay }} />

        <div
          className={`relative z-10 flex w-full min-h-full gap-4 py-12 ${contentFlex} ${BANNER_CONTENT_ROW_CLASS}`}
          style={{ color: textColor, minHeight: sectionHeight }}
        >
          {slide.title && <h1 className="max-w-3xl text-3xl font-bold md:text-4xl lg:text-5xl">{slide.title}</h1>}
          {slide.description && (
            <p className={`max-w-2xl text-lg opacity-90 ${subtitleCenter}`}>{slide.description}</p>
          )}
          {slide.buttonText && (
            <div className={`flex ${btnRowClass}`}>
              <a
                href={slide.link || '#'}
                onClick={linkClick(slide.link)}
                className="inline-block rounded-lg bg-white px-8 py-3 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-100"
              >
                {slide.buttonText}
              </a>
            </div>
          )}
        </div>

        {showArrows && slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                go(-1)
              }}
              className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-2.5 shadow-lg transition hover:bg-white"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-5 w-5 text-gray-800" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                go(1)
              }}
              className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-2.5 shadow-lg transition hover:bg-white"
              aria-label="Next slide"
            >
              <ChevronRight className="h-5 w-5 text-gray-800" />
            </button>
          </>
        )}

        {showCounter && slides.length > 1 && (
          <span className="absolute right-4 top-4 z-20 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white">
            {safeIdx + 1} / {slides.length}
          </span>
        )}

        {showDots && slides.length > 1 && (
          <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id ?? i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  goTo(i)
                }}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  i === safeIdx ? 'bg-white' : 'bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
