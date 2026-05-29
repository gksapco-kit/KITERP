import { Star } from 'lucide-react'
import { createLinkClickHandler } from '../../lib/buttonNavigation'
import { gridColumnClass } from '../../lib/blockUtils'
import { SectionCardsHeader } from '../builder/SectionCardsHeader'
import { SectionViewAllFooter } from '../builder/SectionViewAllFooter'
import { CardItemImage } from '../builder/CardItemImage'
import { resolveCardImageHeight } from '../../lib/cardSectionLayout'
import { PAGE_CONTENT_PADDING, PAGE_MAX_WIDTH_CLASS } from '../../lib/pageLayout'
import {
  hasItemDescriptionStyle,
  hasItemTitleStyle,
  itemDescriptionStyle,
  itemTitleStyle,
} from '../../lib/itemContentStyle'
import { DEFAULT_SUBTITLE_CLASS, DEFAULT_TITLE_CLASS } from '../../lib/sectionTextStyles'
import type { Block, CardItem } from '../../types/builder'
import { useBuilderStore } from '../../store/useBuilderStore'

interface CardsBlockProps {
  block: Block
  cards: CardItem[]
  layoutStyle: React.CSSProperties
  interactive?: boolean
  onNavigate?: (slug: string) => void
}

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

export function CardsBlock({ block, cards, layoutStyle, interactive = false, onNavigate }: CardsBlockProps) {
  const { props } = block
  const cols = props.columns ?? 3
  const colClass = gridColumnClass(cols, 'responsive')
  const imageHeight = resolveCardImageHeight(props)

  const contentRowClass = `mx-auto w-full min-w-0 ${PAGE_MAX_WIDTH_CLASS} ${PAGE_CONTENT_PADDING}`

  return (
    <section style={layoutStyle} className="w-full min-w-0 overflow-x-clip">
      <div className={contentRowClass}>
        <SectionCardsHeader block={block} />
        <div className={`grid min-w-0 gap-6 sm:gap-8 ${colClass}`}>
          {cards.map((c, i) => (
            <article
              key={c.id ?? i}
              className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
            {c.imageUrl && <CardItemImage src={c.imageUrl} alt={c.title} height={imageHeight} />}
            <div className="flex flex-1 flex-col items-start p-5 sm:p-6">
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
              {c.quote && (
                <blockquote className="mt-2 text-sm italic text-gray-600 dark:text-gray-300">&ldquo;{c.quote}&rdquo;</blockquote>
              )}
              {c.author && <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-200">— {c.author}</p>}
              {c.rating != null && c.rating > 0 && (
                <div className="mt-2 flex gap-0.5">
                  {Array.from({ length: Math.min(5, c.rating) }).map((_, ri) => (
                    <Star key={ri} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              )}
              {c.price && <p className="mt-3 text-lg font-bold text-brand-600">{c.price}</p>}
              {c.buttonText && (
                <CardButton text={c.buttonText} link={c.link} interactive={interactive} onNavigate={onNavigate} />
              )}
            </div>
          </article>
        ))}
      </div>
        {cards.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-sm text-gray-400">
            No cards yet — add cards in the properties panel.
          </p>
        )}
        <SectionViewAllFooter block={block} interactive={interactive} onNavigate={onNavigate} />
      </div>
    </section>
  )
}
