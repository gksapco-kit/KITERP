import { Link } from 'react-router-dom'
import type { StyleConfig } from '@/blocks/registry'
import CategoryCardMosaic, { type MosaicCategory } from '@/components/builder/blocks/CategoryCardMosaic'

export type WellnessCategory = MosaicCategory

interface Props {
  title: string
  eyebrow?: string
  style: StyleConfig
  categories: MosaicCategory[]
  propImageByTitle?: Map<string, string | undefined>
  storePath?: (path: string) => string
}

export default function CategoryCardsWellness({
  title,
  eyebrow = '',
  style,
  categories,
  propImageByTitle,
  storePath = p => p,
}: Props) {
  const textColor = style.text_color || '#182E20'
  const bg = style.bg_color || '#F9F9F5'

  return (
    <section className="py-16 sm:py-28 px-6 sm:px-12 max-w-7xl mx-auto" style={{ backgroundColor: bg }}>
      <div className="flex items-end justify-between mb-12 sm:mb-16 gap-4 flex-wrap">
        <div>
          {eyebrow && (
            <span className="text-xs uppercase tracking-[0.3em] opacity-70 block" style={{ color: textColor }}>
              {eyebrow}
            </span>
          )}
          <h2
            className="text-3xl sm:text-4xl md:text-5xl mt-2"
            style={{ fontFamily: style.font_heading, color: textColor }}
          >
            {title}
          </h2>
        </div>
        <Link to={storePath('/products')} className="text-sm underline opacity-80 hover:opacity-100" style={{ color: textColor }}>
          View all
        </Link>
      </div>

      <CategoryCardMosaic
        categories={categories}
        style={style}
        propImageByTitle={propImageByTitle}
        wrapCard={(child, i) => (
          <Link key={i} to={storePath('/products')} className="block w-full no-underline text-inherit">
            {child}
          </Link>
        )}
      />
    </section>
  )
}
