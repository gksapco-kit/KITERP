import { ArrowRight, Copy, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { createLinkClickHandler } from '../../lib/buttonNavigation'
import type { Block, CardItem } from '../../types/builder'
import { useBuilderStore } from '../../store/useBuilderStore'
import { SectionCardsHeader } from '../builder/SectionCardsHeader'
import { SectionViewAllFooter } from '../builder/SectionViewAllFooter'
import { CardItemImage } from '../builder/CardItemImage'
import { resolveCardImageHeight } from '../../lib/cardSectionLayout'
import {
  hasItemDescriptionStyle,
  hasItemTitleStyle,
  itemDescriptionStyle,
  itemTitleStyle,
} from '../../lib/itemContentStyle'
import { DEFAULT_SUBTITLE_CLASS, DEFAULT_TITLE_CLASS } from '../../lib/sectionTextStyles'

interface CardListBlockProps {
  block: Block
  cards: CardItem[]
  layoutStyle?: React.CSSProperties
  interactive?: boolean
  onNavigate?: (slug: string) => void
  editable?: boolean
  onCardsChange?: (cards: CardItem[]) => void
}

function ListCardButton({
  text,
  link,
  interactive,
  onNavigate,
}: {
  text: string
  link?: string
  interactive: boolean
  onNavigate?: (slug: string) => void
}) {
  const pages = useBuilderStore((s) => s.pages)
  const click = createLinkClickHandler({ interactive, link: link ?? '#', pages, onNavigate })
  return (
    <a
      href={link || '#'}
      onClick={click}
      className="inline-flex w-fit shrink-0 self-start items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
    >
      {text}
      <ArrowRight className="h-4 w-4" />
    </a>
  )
}

export function CardListBlock({
  block,
  cards,
  layoutStyle,
  interactive = false,
  onNavigate,
  editable = false,
  onCardsChange,
}: CardListBlockProps) {
  const { props } = block
  const showImage = props.showListImage !== false
  const showBadge = props.showListBadge !== false
  const showPrice = props.showListPrice !== false
  const showButton = props.showListButton !== false
  const imageHeight = resolveCardImageHeight(props)

  const removeItem = (index: number) => {
    onCardsChange?.(cards.filter((_, i) => i !== index))
  }

  const duplicateItem = (index: number) => {
    const item = cards[index]
    if (!item || !onCardsChange) return
    const copy = { ...item, id: uuid(), title: item.title ? `${item.title} (copy)` : '' }
    const next = [...cards]
    next.splice(index + 1, 0, copy)
    onCardsChange(next)
  }

  return (
    <section style={layoutStyle}>
      <SectionCardsHeader block={block} />

      {cards.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          No items yet — add cards in the properties panel
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
          {cards.map((card, index) => (
            <li
              key={card.id ?? index}
              className="group relative transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-700/40"
            >
              <article className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
                {showImage && (
                  <CardItemImage
                    src={card.imageUrl}
                    alt={card.title}
                    height={imageHeight}
                    className="sm:w-40"
                  />
                )}

                <div className="min-w-0 flex-1">
                  {showBadge && card.badge && (
                    <span className="mb-2 inline-block rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                      {card.badge}
                    </span>
                  )}
                  <h3
                    className={`text-lg font-bold ${hasItemTitleStyle(card.contentStyle) ? '' : DEFAULT_TITLE_CLASS}`}
                    style={itemTitleStyle(card.contentStyle)}
                  >
                    {card.title}
                  </h3>
                  {card.description && (
                    <p
                      className={`mt-1 line-clamp-2 text-sm leading-relaxed ${hasItemDescriptionStyle(card.contentStyle) ? '' : DEFAULT_SUBTITLE_CLASS}`}
                      style={itemDescriptionStyle(card.contentStyle)}
                    >
                      {card.description}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end sm:text-right">
                  {showPrice && card.price && (
                    <p className="text-xl font-bold text-brand-600 dark:text-brand-400">{card.price}</p>
                  )}
                  {showButton && card.buttonText && (
                    <ListCardButton
                      text={card.buttonText}
                      link={card.link}
                      interactive={interactive}
                      onNavigate={onNavigate}
                    />
                  )}
                </div>
              </article>

              {editable && onCardsChange && (
                <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    title="Duplicate"
                    onClick={() => duplicateItem(index)}
                    className="rounded-lg bg-white p-1.5 text-gray-600 shadow ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => removeItem(index)}
                    className="rounded-lg bg-white p-1.5 text-red-600 shadow ring-1 ring-gray-200 hover:bg-red-50 dark:bg-gray-800 dark:ring-gray-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <SectionViewAllFooter block={block} interactive={interactive} onNavigate={onNavigate} />
    </section>
  )
}
