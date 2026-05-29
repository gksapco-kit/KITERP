import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Play } from 'lucide-react'
import {
  hasItemDescriptionStyle,
  hasItemTitleStyle,
  itemDescriptionStyle,
  itemTitleStyle,
} from '../../lib/itemContentStyle'
import { PRODUCT_VIDEO_GALLERY_DEFAULTS } from '../../lib/productVideoGalleryDefaults'
import { DEFAULT_SUBTITLE_CLASS, DEFAULT_TITLE_CLASS } from '../../lib/sectionTextStyles'
import { toEmbedVideoUrl } from '../../lib/videoEmbedUtils'
import { SectionHeading } from '../builder/SectionHeading'
import type { BlockStyles, CardItem } from '../../types/builder'

interface ProductVideoGalleryBlockProps {
  cards?: CardItem[]
  text?: string
  subtitle?: string
  showProductVideoTitle?: boolean
  showProductVideoCaption?: boolean
  layoutStyle?: React.CSSProperties
  sectionStyles?: BlockStyles
}

export function ProductVideoGalleryBlock({
  cards = [],
  text,
  subtitle,
  showProductVideoTitle = PRODUCT_VIDEO_GALLERY_DEFAULTS.showProductVideoTitle,
  showProductVideoCaption = PRODUCT_VIDEO_GALLERY_DEFAULTS.showProductVideoCaption,
  layoutStyle,
  sectionStyles = {},
}: ProductVideoGalleryBlockProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const mainColRef = useRef<HTMLDivElement>(null)
  const desktopRailRef = useRef<HTMLDivElement>(null)
  const mobileRailRef = useRef<HTMLDivElement>(null)
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [railMaxHeight, setRailMaxHeight] = useState<number | undefined>()
  const [desktopCanScroll, setDesktopCanScroll] = useState(false)
  const [mobileCanScroll, setMobileCanScroll] = useState(false)

  const safeIndex = cards.length ? Math.min(activeIndex, cards.length - 1) : 0
  const active = cards[safeIndex]
  const embedUrl = toEmbedVideoUrl(active?.videoUrl)

  useEffect(() => {
    thumbRefs.current = thumbRefs.current.slice(0, cards.length)
    if (activeIndex >= cards.length && cards.length > 0) {
      setActiveIndex(cards.length - 1)
    }
  }, [cards.length, activeIndex])

  useEffect(() => {
    const main = mainColRef.current
    if (!main) return

    const syncHeight = () => setRailMaxHeight(main.offsetHeight)

    syncHeight()
    const ro = new ResizeObserver(syncHeight)
    ro.observe(main)
    return () => ro.disconnect()
  }, [cards.length, showProductVideoTitle, showProductVideoCaption, active?.title, active?.description])

  const updateScrollHints = useCallback(() => {
    const desktop = desktopRailRef.current
    const mobile = mobileRailRef.current
    if (desktop) {
      setDesktopCanScroll(desktop.scrollHeight > desktop.clientHeight + 2)
    }
    if (mobile) {
      setMobileCanScroll(mobile.scrollWidth > mobile.clientWidth + 2)
    }
  }, [])

  useEffect(() => {
    updateScrollHints()
    const desktop = desktopRailRef.current
    const mobile = mobileRailRef.current
    const ro = new ResizeObserver(updateScrollHints)
    if (desktop) ro.observe(desktop)
    if (mobile) ro.observe(mobile)
    return () => ro.disconnect()
  }, [cards.length, updateScrollHints, railMaxHeight])

  useEffect(() => {
    const el = thumbRefs.current[safeIndex]
    if (!el) return
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [safeIndex])

  const selectVideo = useCallback((index: number) => {
    setActiveIndex(index)
  }, [])

  if (!cards.length) {
    return (
      <section style={layoutStyle} className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-16 text-center dark:border-gray-700 dark:bg-gray-900/30">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <Play className="h-6 w-6 text-gray-400" />
        </div>
        <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-400">No videos yet</p>
        <p className="mt-1 text-xs text-gray-400">Add videos in the properties panel</p>
      </section>
    )
  }

  const thumb = (item: CardItem, index: number, compact = false) => {
    const isActive = index === safeIndex
    return (
      <button
        key={item.id ?? index}
        ref={(el) => {
          thumbRefs.current[index] = el
        }}
        type="button"
        onClick={() => selectVideo(index)}
        aria-label={item.title || `Play video ${index + 1}`}
        aria-current={isActive ? 'true' : undefined}
        className={`group relative shrink-0 overflow-hidden rounded-lg transition-all duration-200 ${
          compact ? 'h-[72px] w-[128px] snap-start sm:h-20 sm:w-36' : 'aspect-video w-full snap-start'
        } ${
          isActive
            ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-900'
            : 'opacity-75 ring-1 ring-gray-200/80 hover:opacity-100 hover:ring-gray-300 dark:ring-gray-700'
        }`}
      >
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-200 text-[10px] text-gray-500 dark:bg-gray-800">No poster</div>
        )}
        <span
          className={`absolute inset-0 flex items-center justify-center transition ${
            isActive ? 'bg-black/20' : 'bg-black/35 group-hover:bg-black/45'
          }`}
        >
          <span
            className={`flex items-center justify-center rounded-full shadow-md transition ${
              isActive ? 'h-9 w-9 bg-brand-600 text-white' : 'h-8 w-8 bg-white/95 text-brand-600 group-hover:scale-105'
            }`}
          >
            <Play className={`fill-current ${isActive ? 'h-4 w-4' : 'h-3.5 w-3.5'}`} aria-hidden />
          </span>
        </span>
        {isActive && (
          <span className="absolute left-1.5 top-1.5 rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
            Now playing
          </span>
        )}
      </button>
    )
  }

  const activeTitleStyle = itemTitleStyle(active?.contentStyle)
  const activeDescStyle = itemDescriptionStyle(active?.contentStyle)

  return (
    <section style={layoutStyle} className="w-full min-w-0">
      <SectionHeading title={text} subtitle={subtitle} styles={sectionStyles} className="mb-8 md:mb-10" />

      <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:border-gray-700/80 dark:bg-gray-900 dark:shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-start">
          {/* Main player — height drives the desktop thumb rail */}
          <div ref={mainColRef} className="min-w-0 flex-1 lg:border-r lg:border-gray-100 dark:lg:border-gray-800">
            <div className="relative aspect-video w-full bg-gray-950">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  title={active?.title || `Product video ${safeIndex + 1}`}
                  className="absolute inset-0 h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : active?.imageUrl ? (
                <img src={active.imageUrl} alt="" className="h-full w-full object-cover opacity-50" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">Add a video URL</div>
              )}
            </div>

            {(showProductVideoTitle || showProductVideoCaption) && (active?.title || active?.description) && (
              <div className="border-t border-gray-100 px-5 py-4 dark:border-gray-800 sm:px-6 sm:py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {showProductVideoTitle && active?.title && (
                      <h3
                        className={`text-base font-semibold tracking-tight sm:text-lg ${hasItemTitleStyle(active.contentStyle) ? '' : DEFAULT_TITLE_CLASS}`}
                        style={activeTitleStyle}
                      >
                        {active.title}
                      </h3>
                    )}
                    {showProductVideoCaption && active?.description && (
                      <p
                        className={`mt-1 text-sm leading-relaxed ${hasItemDescriptionStyle(active.contentStyle) ? '' : DEFAULT_SUBTITLE_CLASS}`}
                        style={activeDescStyle}
                      >
                        {active.description}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {safeIndex + 1} / {cards.length}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Desktop: scrollable vertical thumb rail (max height = player column) */}
          <aside
            className="relative hidden w-[148px] shrink-0 flex-col bg-gray-50/80 dark:bg-gray-950/50 lg:flex xl:w-[168px]"
            style={railMaxHeight != null ? { maxHeight: railMaxHeight } : undefined}
          >
            <div className="shrink-0 border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                All videos ({cards.length})
              </p>
            </div>
            <div
              ref={desktopRailRef}
              className="product-video-gallery-scroll min-h-0 flex-1 space-y-2 px-3 py-2"
            >
              {cards.map((item, index) => thumb(item, index, false))}
            </div>
            {desktopCanScroll && (
              <div className="flex shrink-0 items-center justify-center gap-1 border-t border-gray-100 px-2 py-1.5 text-[10px] text-gray-400 dark:border-gray-800">
                <ChevronDown className="h-3 w-3 animate-bounce" aria-hidden />
                <span>Scroll for more</span>
              </div>
            )}
          </aside>
        </div>

        {/* Mobile & tablet: horizontal scroll strip */}
        <div className="border-t border-gray-100 bg-gray-50/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-950/40 lg:hidden">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Select a video ({cards.length})
            </p>
            {mobileCanScroll && <span className="text-[10px] text-gray-400">Swipe →</span>}
          </div>
          <div
            ref={mobileRailRef}
            className="product-video-gallery-scroll -mx-1 flex snap-x snap-mandatory gap-2.5 px-1 pb-1"
          >
            {cards.map((item, index) => thumb(item, index, true))}
          </div>
        </div>
      </div>
    </section>
  )
}
