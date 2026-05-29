import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { createLinkClickHandler } from '../../lib/buttonNavigation'
import { LOOKBOOK_DISPLAY_DEFAULTS } from '../../lib/lookbookDefaults'
import { SectionHeading } from '../builder/SectionHeading'
import { useBuilderStore } from '../../store/useBuilderStore'
import type { BlockStyles, CardItem } from '../../types/builder'

export type LookbookLayout = 'editorial' | 'grid' | 'strip'

const EDITORIAL_CELL_CLASS = [
  'col-span-12 min-h-[280px] md:col-span-7 md:row-span-2 md:min-h-[520px]',
  'col-span-12 min-h-[240px] md:col-span-5 md:min-h-[250px]',
  'col-span-12 min-h-[240px] md:col-span-5 md:min-h-[250px]',
  'col-span-6 min-h-[220px] md:col-span-6',
  'col-span-6 min-h-[220px] md:col-span-6',
  'col-span-12 min-h-[200px] sm:col-span-4 md:col-span-4',
  'col-span-12 min-h-[200px] sm:col-span-4 md:col-span-4',
  'col-span-12 min-h-[200px] sm:col-span-4 md:col-span-4',
]

function cellClass(index: number, layout: LookbookLayout): string {
  if (layout === 'grid') return 'min-h-[300px] sm:min-h-[360px]'
  if (layout === 'strip') return 'w-[min(85vw,320px)] shrink-0 snap-start sm:w-[360px]'
  return EDITORIAL_CELL_CLASS[index] ?? 'col-span-6 min-h-[240px] md:col-span-4'
}

interface LookbookBlockProps {
  cards?: CardItem[]
  text?: string
  subtitle?: string
  showLookbookTitle?: boolean
  showLookbookCaption?: boolean
  showLookbookBadge?: boolean
  lookbookLayout?: LookbookLayout
  layoutStyle?: React.CSSProperties
  sectionStyles?: BlockStyles
  interactive?: boolean
  onNavigate?: (slug: string) => void
}

function LookbookTile({
  item,
  index,
  layout,
  showTitle,
  showCaption,
  showBadge,
  interactive,
  onNavigate,
  onOpen,
}: {
  item: CardItem
  index: number
  layout: LookbookLayout
  showTitle: boolean
  showCaption: boolean
  showBadge: boolean
  interactive: boolean
  onNavigate?: (slug: string) => void
  onOpen?: () => void
}) {
  const pages = useBuilderStore((s) => s.pages)
  const linkClick = createLinkClickHandler({
    interactive,
    link: item.link,
    pages,
    onNavigate,
  })
  const hasOverlay = showTitle || showCaption || showBadge
  const className = `group relative block w-full overflow-hidden rounded-2xl bg-gray-100 text-left dark:bg-gray-800 ${cellClass(index, layout)}`

  const inner = (
    <>
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.title || `Look ${index + 1}`}
          className="absolute inset-0 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">Add image</div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent opacity-90 transition group-hover:from-black/85" />
      {hasOverlay && (
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          {showBadge && item.badge && (
            <span className="mb-2 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-sm">
              {item.badge}
            </span>
          )}
          {showTitle && item.title && (
            <p className="text-lg font-semibold tracking-tight text-white sm:text-xl">{item.title}</p>
          )}
          {showCaption && item.description && (
            <p className="mt-1 line-clamp-2 text-sm text-white/85">{item.description}</p>
          )}
          {(item.link || onOpen) && (
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-white/90 opacity-0 transition group-hover:opacity-100">
              View look
              <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      )}
    </>
  )

  if (item.link && interactive) {
    return (
      <a href={item.link} onClick={linkClick} className={className}>
        {inner}
      </a>
    )
  }

  return (
    <button type="button" onClick={onOpen} className={className}>
      {inner}
    </button>
  )
}

export function LookbookBlock({
  cards = [],
  text,
  subtitle,
  showLookbookTitle = LOOKBOOK_DISPLAY_DEFAULTS.showLookbookTitle,
  showLookbookCaption = LOOKBOOK_DISPLAY_DEFAULTS.showLookbookCaption,
  showLookbookBadge = LOOKBOOK_DISPLAY_DEFAULTS.showLookbookBadge,
  lookbookLayout = LOOKBOOK_DISPLAY_DEFAULTS.lookbookLayout,
  layoutStyle,
  sectionStyles = {},
  interactive = false,
  onNavigate,
}: LookbookBlockProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const layout = lookbookLayout

  const openLightbox = useCallback(
    (index: number) => {
      if (cards.length) setLightboxIdx(index)
    },
    [cards.length],
  )

  useEffect(() => {
    if (lightboxIdx == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null)
      if (e.key === 'ArrowRight') setLightboxIdx((i) => (i == null ? null : (i + 1) % cards.length))
      if (e.key === 'ArrowLeft') setLightboxIdx((i) => (i == null ? null : (i - 1 + cards.length) % cards.length))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIdx, cards.length])

  const lb = lightboxIdx != null ? cards[lightboxIdx] : null

  if (!cards.length) {
    return (
      <section style={layoutStyle} className="rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
        <p className="text-sm text-gray-500">No looks yet — add images in the properties panel.</p>
      </section>
    )
  }

  const gridWrap =
    layout === 'strip' ? (
      <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 snap-x snap-mandatory">
        {cards.map((item, i) => (
          <LookbookTile
            key={item.id ?? i}
            item={item}
            index={i}
            layout={layout}
            showTitle={showLookbookTitle}
            showCaption={showLookbookCaption}
            showBadge={showLookbookBadge}
            interactive={interactive}
            onNavigate={onNavigate}
            onOpen={() => openLightbox(i)}
          />
        ))}
      </div>
    ) : (
      <div
        className={
          layout === 'grid'
            ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4'
            : 'grid grid-cols-12 gap-3 md:gap-4'
        }
      >
        {cards.map((item, i) => (
          <LookbookTile
            key={item.id ?? i}
            item={item}
            index={i}
            layout={layout}
            showTitle={showLookbookTitle}
            showCaption={showLookbookCaption}
            showBadge={showLookbookBadge}
            interactive={interactive}
            onNavigate={onNavigate}
            onOpen={() => openLightbox(i)}
          />
        ))}
      </div>
    )

  return (
    <section style={layoutStyle} className="w-full min-w-0">
      <SectionHeading
        title={text}
        subtitle={subtitle}
        styles={sectionStyles}
        className="mb-8 md:mb-12"
        titleClassName="text-3xl font-bold tracking-tight md:text-4xl"
        subtitleClassName="mx-auto mt-4 max-w-2xl text-base leading-relaxed"
      />

      {gridWrap}

      {lb && lightboxIdx != null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setLightboxIdx(null)}
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
          {cards.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  setLightboxIdx((lightboxIdx - 1 + cards.length) % cards.length)
                }}
                aria-label="Previous"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  setLightboxIdx((lightboxIdx + 1) % cards.length)
                }}
                aria-label="Next"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
          <div className="max-h-[85vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {lb.imageUrl && (
              <img src={lb.imageUrl} alt={lb.title} className="max-h-[75vh] w-full rounded-lg object-contain" />
            )}
            {(lb.title || lb.description) && (
              <div className="mt-4 text-center text-white">
                {lb.badge && <p className="text-xs font-bold uppercase tracking-widest text-white/70">{lb.badge}</p>}
                {lb.title && <p className="mt-1 text-xl font-semibold">{lb.title}</p>}
                {lb.description && <p className="mt-1 text-sm text-white/80">{lb.description}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
