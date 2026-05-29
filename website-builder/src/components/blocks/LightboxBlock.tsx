import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react'
import { gridColumnClass } from '../../lib/blockUtils'
import { LIGHTBOX_DEFAULTS } from '../../lib/lightboxDefaults'
import { blockThemeGradientStyle } from '../../lib/themeGradientUtils'
import { SectionHeading } from '../builder/SectionHeading'
import type { Block, LightboxItem } from '../../types/builder'

interface LightboxBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
  interactive?: boolean
  editable?: boolean
}

type GridLayout = 'grid' | 'masonry' | 'featured' | 'filmstrip'
type ThumbTheme = 'light' | 'dark' | 'minimal'
type OverlayStyle = 'blur' | 'solid' | 'gradient'

function overlayClass(style: OverlayStyle) {
  if (style === 'blur') return 'bg-black/60 backdrop-blur-xl'
  if (style === 'gradient') return 'bg-gradient-to-b from-black/80 via-black/70 to-black/90'
  return 'bg-black/92'
}

function ThumbCell({
  item,
  index,
  onOpen,
  showHint,
  className = '',
  aspect = 'aspect-[4/3]',
}: {
  item: LightboxItem
  index: number
  onOpen: (i: number) => void
  showHint: boolean
  className?: string
  aspect?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className={`group relative block w-full overflow-hidden rounded-xl bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:bg-gray-800 ${className}`}
    >
      <div className={`relative w-full ${aspect}`}>
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.alt || item.title || ''}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-200 text-sm text-gray-400">No image</div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
        {showHint && (
          <span className="pointer-events-none absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-800 opacity-0 shadow-lg transition group-hover:opacity-100">
            <Maximize2 className="h-4 w-4" />
          </span>
        )}
        {item.title && (
          <span className="pointer-events-none absolute bottom-0 left-0 right-0 px-3 py-2.5 text-left text-sm font-medium text-white opacity-0 transition group-hover:opacity-100">
            {item.title}
          </span>
        )}
      </div>
    </button>
  )
}

export function LightboxBlock({ block, layoutStyle, interactive = false, editable = false }: LightboxBlockProps) {
  const { props, styles } = block
  const layout = (props.lightboxGridLayout ?? LIGHTBOX_DEFAULTS.lightboxGridLayout) as GridLayout
  const thumbTheme = (props.lightboxThumbTheme ?? LIGHTBOX_DEFAULTS.lightboxThumbTheme) as ThumbTheme
  const overlayStyle = (props.lightboxOverlay ?? LIGHTBOX_DEFAULTS.lightboxOverlay) as OverlayStyle
  const showCaption = props.showLightboxCaption !== false
  const showCounter = props.showLightboxCounter !== false
  const showThumbs = props.showLightboxThumbnails !== false
  const showHint = props.showLightboxZoomHint !== false
  const columns = props.columns ?? LIGHTBOX_DEFAULTS.columns

  const items = (props.lightboxItems ?? []).filter((i) => i.enabled !== false)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const canOpen = (interactive || editable) && items.length > 0

  const open = useCallback(
    (index: number) => {
      if (canOpen) setActiveIdx(index)
    },
    [canOpen],
  )

  useEffect(() => {
    if (activeIdx == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveIdx(null)
      if (e.key === 'ArrowRight') setActiveIdx((i) => (i == null ? null : (i + 1) % items.length))
      if (e.key === 'ArrowLeft') setActiveIdx((i) => (i == null ? null : (i - 1 + items.length) % items.length))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeIdx, items.length])

  const colClass = gridColumnClass(columns)
  const active = activeIdx != null ? items[activeIdx] : null

  const sectionShell =
    thumbTheme === 'dark'
      ? 'rounded-2xl px-4 py-10 sm:px-8 sm:py-12'
      : thumbTheme === 'minimal'
        ? ''
        : 'rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:border-gray-700 dark:bg-gray-900/40 dark:ring-gray-800 sm:p-6'

  const sectionShellStyle = thumbTheme === 'dark' ? blockThemeGradientStyle(styles) : undefined

  const renderGrid = () => {
    if (layout === 'filmstrip') {
      return (
        <div className="-mx-1 flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
          {items.map((item, i) => (
            <div key={item.id ?? i} className="w-56 shrink-0 sm:w-64">
              <ThumbCell item={item} index={i} onOpen={open} showHint={showHint} aspect="aspect-[3/4]" />
            </div>
          ))}
        </div>
      )
    }

    if (layout === 'featured' && items.length > 0) {
      const [hero, ...rest] = items
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2 lg:gap-4">
          <div className="sm:col-span-2 lg:row-span-2">
            <ThumbCell item={hero} index={0} onOpen={open} showHint={showHint} aspect="aspect-[16/10] sm:aspect-auto sm:min-h-[280px] lg:min-h-[360px]" />
          </div>
          {rest.slice(0, 4).map((item, i) => (
            <ThumbCell key={item.id ?? i + 1} item={item} index={i + 1} onOpen={open} showHint={showHint} aspect="aspect-[4/3]" />
          ))}
        </div>
      )
    }

    if (layout === 'masonry') {
      return (
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
          {items.map((item, i) => (
            <div key={item.id ?? i} className="break-inside-avoid">
              <ThumbCell
                item={item}
                index={i}
                onOpen={open}
                showHint={showHint}
                aspect={i % 3 === 0 ? 'aspect-[3/4]' : i % 3 === 1 ? 'aspect-square' : 'aspect-[5/4]'}
              />
            </div>
          ))}
        </div>
      )
    }

    return (
      <div className={`grid gap-3 sm:gap-4 ${colClass}`}>
        {items.map((item, i) => (
          <ThumbCell key={item.id ?? i} item={item} index={i} onOpen={open} showHint={showHint} />
        ))}
      </div>
    )
  }

  return (
    <section style={layoutStyle} className="w-full">
      <div className={`mx-auto max-w-6xl ${sectionShell}`} style={sectionShellStyle}>
        {(props.text || props.subtitle) && (
          <SectionHeading
            title={props.text}
            subtitle={props.subtitle}
            styles={styles}
            className={`mb-6 md:mb-8 ${thumbTheme === 'dark' ? 'text-white [&_p]:text-white/65' : ''}`}
          />
        )}
        {items.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">Add images in the properties panel</p>
        ) : (
          renderGrid()
        )}
      </div>

      {activeIdx != null && active && (
        <div
          className={`fixed inset-0 z-[100] flex flex-col ${overlayClass(overlayStyle)}`}
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveIdx(null)}
        >
          <div className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6">
            <div className="min-w-0 text-white">
              {showCaption && active.title && <p className="truncate text-sm font-semibold sm:text-base">{active.title}</p>}
              {showCounter && (
                <p className="text-xs text-white/55">
                  {activeIdx + 1} / {items.length}
                </p>
              )}
            </div>
            <button
              type="button"
              className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              onClick={() => setActiveIdx(null)}
              aria-label="Close"
            >
              <X className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-12 sm:px-16">
            {items.length > 1 && (
              <>
                <button
                  type="button"
                  className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20 sm:left-4 sm:p-3"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveIdx((i) => (i == null ? 0 : (i - 1 + items.length) % items.length))
                  }}
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20 sm:right-4 sm:p-3"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveIdx((i) => (i == null ? 0 : (i + 1) % items.length))
                  }}
                  aria-label="Next"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            <div className="max-h-full max-w-5xl px-2" onClick={(e) => e.stopPropagation()}>
              {active.imageUrl && (
                <img
                  src={active.imageUrl}
                  alt={active.alt || active.title || ''}
                  className="max-h-[min(62vh,720px)] w-full rounded-lg object-contain shadow-2xl"
                />
              )}
              {showCaption && active.caption && (
                <p className="mt-4 max-w-2xl text-center text-sm leading-relaxed text-white/80 sm:text-base">{active.caption}</p>
              )}
            </div>
          </div>

          {showThumbs && items.length > 1 && (
            <div className="shrink-0 border-t border-white/10 px-4 py-3 sm:px-6" onClick={(e) => e.stopPropagation()}>
              <div className="mx-auto flex max-w-4xl justify-center gap-2 overflow-x-auto pb-1">
                {items.map((item, i) => (
                  <button
                    key={item.id ?? i}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition sm:h-16 sm:w-24 ${
                      i === activeIdx ? 'ring-white opacity-100' : 'ring-transparent opacity-50 hover:opacity-80'
                    }`}
                  >
                    {item.imageUrl && <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
