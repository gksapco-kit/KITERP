import { useCallback, useEffect, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { ChevronLeft, ChevronRight, Copy, Trash2, X, ZoomIn } from 'lucide-react'
import { gridColumnClass } from '../../lib/blockUtils'
import { SectionHeading } from '../builder/SectionHeading'
import {
  hasItemDescriptionStyle,
  hasItemTitleStyle,
  itemDescriptionStyle,
  itemTitleStyle,
} from '../../lib/itemContentStyle'
import { DEFAULT_SUBTITLE_CLASS, DEFAULT_TITLE_CLASS } from '../../lib/sectionTextStyles'
import type { BlockStyles } from '../../types/builder'
import { GALLERY_DISPLAY_DEFAULTS } from '../../lib/galleryDefaults'
import type { CardItem } from '../../types/builder'

interface GalleryBlockProps {
  cards?: CardItem[]
  columns?: number
  text?: string
  subtitle?: string
  showGalleryTitle?: boolean
  showGalleryCaption?: boolean
  showGalleryLightbox?: boolean
  galleryLayout?: 'overlay' | 'below'
  layoutStyle?: React.CSSProperties
  sectionStyles?: BlockStyles
  editable?: boolean
  interactive?: boolean
  onCardsChange?: (cards: CardItem[]) => void
}

export function GalleryBlock({
  cards = [],
  columns = 3,
  text,
  subtitle,
  showGalleryTitle = GALLERY_DISPLAY_DEFAULTS.showGalleryTitle,
  showGalleryCaption = GALLERY_DISPLAY_DEFAULTS.showGalleryCaption,
  showGalleryLightbox = GALLERY_DISPLAY_DEFAULTS.showGalleryLightbox,
  galleryLayout = GALLERY_DISPLAY_DEFAULTS.galleryLayout,
  layoutStyle,
  sectionStyles = {},
  editable = false,
  interactive = false,
  onCardsChange,
}: GalleryBlockProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const colClass = gridColumnClass(columns)
  const canLightbox = showGalleryLightbox && (interactive || editable) && cards.length > 0

  const updateCards = useCallback(
    (next: CardItem[]) => onCardsChange?.(next),
    [onCardsChange],
  )

  const removeItem = (index: number) => {
    updateCards(cards.filter((_, i) => i !== index))
    if (lightboxIdx === index) setLightboxIdx(null)
    else if (lightboxIdx != null && lightboxIdx > index) setLightboxIdx(lightboxIdx - 1)
  }

  const duplicateItem = (index: number) => {
    const item = cards[index]
    if (!item) return
    const copy = { ...item, id: uuid(), title: item.title ? `${item.title} (copy)` : '' }
    const next = [...cards]
    next.splice(index + 1, 0, copy)
    updateCards(next)
  }

  const openLightbox = (index: number) => {
    if (canLightbox) setLightboxIdx(index)
  }

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

  if (!cards.length) {
    return (
      <section style={layoutStyle} className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
        <p className="text-sm text-gray-500">No images yet</p>
        {editable && <p className="mt-1 text-xs text-gray-400">Use Add image in the properties panel</p>}
      </section>
    )
  }

  const lbItem = lightboxIdx != null ? cards[lightboxIdx] : null

  return (
    <section style={layoutStyle}>
      <SectionHeading title={text} subtitle={subtitle} styles={sectionStyles} />

      <div className={`grid gap-3 sm:gap-4 ${colClass}`}>
        {cards.map((item, index) => (
          <article
            key={item.id ?? index}
            className="group relative overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800"
          >
            <button
              type="button"
              className={`relative block w-full ${canLightbox ? 'cursor-zoom-in' : 'cursor-default'}`}
              onClick={() => openLightbox(index)}
              disabled={!canLightbox}
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.title || `Gallery image ${index + 1}`}
                  className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-sm text-gray-400">No image</div>
              )}

              {galleryLayout === 'overlay' && (showGalleryTitle || showGalleryCaption) && (item.title || item.description) && (
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  {showGalleryTitle && item.title && (
                    <p
                      className={`font-semibold ${hasItemTitleStyle(item.contentStyle) ? '' : 'text-white'}`}
                      style={itemTitleStyle(item.contentStyle)}
                    >
                      {item.title}
                    </p>
                  )}
                  {showGalleryCaption && item.description && (
                    <p
                      className={`text-sm ${hasItemDescriptionStyle(item.contentStyle) ? '' : 'text-white/90'} ${showGalleryTitle && item.title ? 'mt-0.5' : ''}`}
                      style={itemDescriptionStyle(item.contentStyle)}
                    >
                      {item.description}
                    </p>
                  )}
                </div>
              )}

              {canLightbox && (
                <span className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition group-hover:opacity-100">
                  <ZoomIn className="h-4 w-4" />
                </span>
              )}
            </button>

            {galleryLayout === 'below' && (
              <div className="border-t border-gray-100 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                {showGalleryTitle && item.title && (
                  <h3
                    className={`font-medium ${hasItemTitleStyle(item.contentStyle) ? '' : DEFAULT_TITLE_CLASS}`}
                    style={itemTitleStyle(item.contentStyle)}
                  >
                    {item.title}
                  </h3>
                )}
                {showGalleryCaption && item.description && (
                  <p
                    className={`text-sm ${hasItemDescriptionStyle(item.contentStyle) ? '' : DEFAULT_SUBTITLE_CLASS} ${showGalleryTitle && item.title ? 'mt-0.5' : ''}`}
                    style={itemDescriptionStyle(item.contentStyle)}
                  >
                    {item.description}
                  </p>
                )}
              </div>
            )}

            {editable && onCardsChange && (
              <div className="absolute left-2 top-2 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  title="Duplicate image"
                  onClick={(e) => {
                    e.stopPropagation()
                    duplicateItem(index)
                  }}
                  className="rounded-lg bg-white/95 p-1.5 text-gray-700 shadow hover:bg-white"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Delete image"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeItem(index)
                  }}
                  className="rounded-lg bg-white/95 p-1.5 text-red-600 shadow hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      {lightboxIdx != null && lbItem && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
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
                  setLightboxIdx((i) => (i == null ? 0 : (i - 1 + cards.length) % cards.length))
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
                  setLightboxIdx((i) => (i == null ? 0 : (i + 1) % cards.length))
                }}
                aria-label="Next"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <div className="max-h-[85vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {lbItem.imageUrl && (
              <img src={lbItem.imageUrl} alt={lbItem.title || ''} className="max-h-[70vh] w-full rounded-lg object-contain" />
            )}
            <div className="mt-4 text-center text-white">
              {showGalleryTitle && lbItem.title && <p className="text-lg font-semibold">{lbItem.title}</p>}
              {showGalleryCaption && lbItem.description && (
                <p className={`text-sm text-white/80 ${showGalleryTitle && lbItem.title ? 'mt-1' : ''}`}>{lbItem.description}</p>
              )}
              <p className="mt-2 text-xs text-white/50">
                {lightboxIdx + 1} / {cards.length}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
