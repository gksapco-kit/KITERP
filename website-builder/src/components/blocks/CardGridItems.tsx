import { createLinkClickHandler } from '../../lib/buttonNavigation'
import { gridColumnClass } from '../../lib/blockUtils'
import {
  hasItemDescriptionStyle,
  hasItemTitleStyle,
  itemDescriptionStyle,
  itemTitleStyle,
} from '../../lib/itemContentStyle'
import { DEFAULT_SUBTITLE_CLASS, DEFAULT_TITLE_CLASS } from '../../lib/sectionTextStyles'
import type { CardItem } from '../../types/builder'
import { useBuilderStore } from '../../store/useBuilderStore'
import { CardItemImage } from '../builder/CardItemImage'

function CardButton({
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
      className="mt-4 inline-block w-fit self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
    >
      {text}
    </a>
  )
}

interface CardGridItemsProps {
  cards: CardItem[]
  columns?: number
  imageHeight?: string
  interactive?: boolean
  onNavigate?: (slug: string) => void
  emptyMessage?: string
}

export function CardGridItems({
  cards,
  columns = 3,
  imageHeight = '176px',
  interactive = false,
  onNavigate,
  emptyMessage = 'No items in this category yet.',
}: CardGridItemsProps) {
  const colClass = gridColumnClass(columns, 'responsive')

  if (cards.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-12 text-center text-sm text-gray-400">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className={`grid gap-6 ${colClass}`}>
      {cards.map((c, i) => (
        <article
          key={c.id ?? i}
          className="flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
        >
          {c.imageUrl && <CardItemImage src={c.imageUrl} alt={c.title} height={imageHeight} />}
          <div className="flex flex-1 flex-col items-start p-5">
            {c.badge && (
              <span className="mb-2 inline-block w-fit rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                {c.badge}
              </span>
            )}
            <h3
              className={`text-lg font-bold ${hasItemTitleStyle(c.contentStyle) ? '' : DEFAULT_TITLE_CLASS}`}
              style={itemTitleStyle(c.contentStyle)}
            >
              {c.title}
            </h3>
            {c.description && (
              <p
                className={`mt-2 flex-1 text-sm leading-relaxed ${hasItemDescriptionStyle(c.contentStyle) ? '' : DEFAULT_SUBTITLE_CLASS}`}
                style={itemDescriptionStyle(c.contentStyle)}
              >
                {c.description}
              </p>
            )}
            {c.price && <p className="mt-3 text-lg font-bold text-brand-600">{c.price}</p>}
            {c.buttonText && (
              <CardButton text={c.buttonText} link={c.link} interactive={interactive} onNavigate={onNavigate} />
            )}
          </div>
        </article>
      ))}
    </div>
  )
}
