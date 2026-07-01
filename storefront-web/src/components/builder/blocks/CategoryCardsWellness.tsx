import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import type { StyleConfig } from '@/blocks/registry'
import CategoryCardMosaic, { type MosaicCategory } from '@/components/builder/blocks/CategoryCardMosaic'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { CategoryCardTitle } from '@/components/builder/CategoryCardTitle'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { clampCatalogColumns } from '@/lib/catalogCardLayout'

export type WellnessCategory = MosaicCategory

interface Props {
  title: string
  eyebrow?: string
  style: StyleConfig
  categories: MosaicCategory[]
  propImageByTitle?: Map<string, string | undefined>
  storePath?: (path: string) => string
  blockId?: string
  blockProps?: Record<string, unknown>
  maxItems?: number
  itemGap?: number
  columns?: number
  imageHeightPct?: number
  cardPadding?: number
  itemsReadOnly?: boolean
}

export default function CategoryCardsWellness({
  title,
  eyebrow = '',
  style,
  categories,
  propImageByTitle,
  storePath = p => p,
  blockId,
  blockProps,
  maxItems,
  itemGap,
  columns,
  imageHeightPct,
  cardPadding,
  itemsReadOnly = false,
}: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const mosaicColumns = clampCatalogColumns(columns ?? 3, 3, 'category_cards')
  void imageHeightPct
  void cardPadding
  const mosaicGridStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${mosaicColumns}, minmax(0, 1fr))`,
    ...(itemGap != null ? { gap: itemGap } : {}),
  }
  const textColor = style.text_color || '#182E20'
  const bg =
    (blockProps?.bg_color_override as string | undefined)
    || style.bg_color
    || '#F9F9F5'

  return (
    <section className="py-16 sm:py-28 px-6 sm:px-12 max-w-7xl mx-auto" style={{ backgroundColor: bg }}>
      <div className="flex items-end justify-between mb-12 sm:mb-16 gap-4 flex-wrap">
        <div>
          {(eyebrow || blockId) && (
            <BuilderTextField
              fieldKey="eyebrow"
              blockId={blockId}
              blockProps={blockProps}
              value={eyebrow}
              as="span"
              className="text-xs uppercase tracking-[0.3em] opacity-70 block"
              style={{ color: textColor }}
              placeholder="Tagline"
            />
          )}
          <BuilderTextField
            fieldKey="title"
            blockId={blockId}
            blockProps={blockProps}
            value={title}
            as="h2"
            className="text-3xl sm:text-4xl md:text-5xl mt-2"
            style={{ fontFamily: style.font_heading, color: textColor }}
          />
        </div>
        <Link to={storePath('/products')} className="text-sm underline opacity-80 hover:opacity-100" style={{ color: textColor }}>
          View all
        </Link>
      </div>

      <CategoryCardMosaic
        categories={categories}
        style={style}
        propImageByTitle={propImageByTitle}
        blockId={blockId}
        arrayKey="categories"
        itemField="image_url"
        blockProps={blockProps}
        itemsReadOnly={itemsReadOnly}
        maxItems={maxItems}
        gridStyle={mosaicGridStyle}
        renderTitle={(displayTitle, i) => (
          <CategoryCardTitle
            index={i}
            title={displayTitle}
            blockId={blockId}
            blockProps={blockProps}
            readOnly={itemsReadOnly}
            as="h3"
            style={{
              fontFamily: style.font_heading,
              color: textColor,
              fontSize: '1.125rem',
              fontWeight: 500,
              lineHeight: 1.35,
              margin: 0,
            }}
          />
        )}
        wrapCard={(child, i) => (
          isEditorCanvas ? (
            <div key={i} className="block w-full no-underline text-inherit">
              {child}
            </div>
          ) : (
            <Link key={i} to={storePath('/products')} className="block w-full no-underline text-inherit">
              {child}
            </Link>
          )
        )}
      />
    </section>
  )
}
