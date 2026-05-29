import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { clampColumns } from '../../lib/blockUtils'
import { IMAGE_TITLE_SLIDER_DEFAULTS } from '../../lib/imageTitleSliderDefaults'
import { SectionHeading } from '../builder/SectionHeading'
import type { Block, CardItem } from '../../types/builder'

interface ImageTitleSliderBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
}

const GAP_PX = 16

function SlideItem({
  item,
  width,
  showBadge,
}: {
  item: CardItem
  width: number
  showBadge: boolean
}) {
  return (
    <article className="shrink-0 snap-start" style={{ width }}>
      <div
        className="relative overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800"
        style={{ width, height: width }}
      >
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">No image</div>
        )}
        {showBadge && item.badge && (
          <span className="absolute bottom-2 left-2 rounded-md bg-violet-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            {item.badge}
          </span>
        )}
      </div>
      <p className="mt-3 text-center text-sm font-bold text-gray-900 dark:text-white">{item.title}</p>
    </article>
  )
}

export function ImageTitleSliderBlock({ block, layoutStyle }: ImageTitleSliderBlockProps) {
  const { props, styles } = block
  const items = props.cards ?? []
  const showArrows = props.showImageTitleSliderArrows !== false
  const showBadges = props.showImageTitleSliderBadges !== false
  const columns = clampColumns(props.columns ?? IMAGE_TITLE_SLIDER_DEFAULTS.columns, 2, 10)
  const viewportRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [itemWidth, setItemWidth] = useState(132)

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      setItemWidth(Math.max(72, (w - (columns - 1) * GAP_PX) / columns))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [columns])

  const scroll = (direction: -1 | 1) => {
    const el = scrollRef.current
    if (!el) return
    const step = (itemWidth + GAP_PX) * columns
    el.scrollBy({ left: direction * step, behavior: 'smooth' })
  }

  if (items.length === 0) {
    return (
      <section style={layoutStyle} className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
        Add images and titles in the properties panel
      </section>
    )
  }

  return (
    <section style={layoutStyle} className="w-full">
      <div className="mx-auto max-w-6xl">
        {(props.text || props.subtitle) && (
          <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-6" />
        )}

        <div ref={viewportRef} className="relative">
          {showArrows && items.length > columns && (
            <>
              <button
                type="button"
                onClick={() => scroll(-1)}
                className="absolute -left-1 top-[calc(50%-1.25rem)] z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 sm:left-0"
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => scroll(1)}
                className="absolute -right-1 top-[calc(50%-1.25rem)] z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 sm:right-0"
                aria-label="Scroll right"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          <div
            ref={scrollRef}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((item, i) => (
              <SlideItem key={item.id ?? i} item={item} width={itemWidth} showBadge={showBadges} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
