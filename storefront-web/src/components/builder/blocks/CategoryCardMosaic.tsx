import { Fragment, type CSSProperties, type ReactNode } from 'react'
import type { StyleConfig } from '@/blocks/registry'
import { CategoryEditorialImage } from '@/components/builder/CategoryEditorialImage'
import { sanitizeWellnessCategoryTitle } from '@/lib/wellnessTemplateCopy'
import {
  WELLNESS_BLOB_LAYOUTS,
  WELLNESS_BLOB_SHAPES,
  WELLNESS_CARD_CANVAS_COLORS,
  WELLNESS_FLOAT_CLASSES,
  WELLNESS_MOTION_CSS,
  resolveCategoryCardImage,
  type WellnessBlobLayout,
} from '@/lib/wellnessCategoryStyle'

export interface MosaicCategory {
  title: string
  image_url?: string | null
}

interface Props {
  categories: MosaicCategory[]
  style: StyleConfig
  propImageByTitle?: Map<string, string | undefined>
  maxItems?: number
  renderTitle?: (title: string, index: number) => ReactNode
  onCardClick?: (index: number) => void
  wrapCard?: (child: ReactNode, index: number) => ReactNode
  className?: string
  gridStyle?: CSSProperties
  blockId?: string
  arrayKey?: string
  itemField?: string
  blockProps?: Record<string, unknown>
}

function blobStyle(
  box: WellnessBlobLayout['blobA'],
  radius: string,
): CSSProperties {
  return {
    top: box.top,
    left: box.left,
    right: box.right,
    bottom: box.bottom,
    width: box.width,
    height: box.height,
    borderRadius: radius,
  }
}

function MosaicImage({
  src,
  fallback,
  alt,
  index,
  blockId,
  arrayKey,
  itemField,
  blockProps,
}: {
  src: string
  fallback: string
  alt: string
  index: number
  blockId?: string
  arrayKey?: string
  itemField?: string
  blockProps?: Record<string, unknown>
}) {
  return (
    <CategoryEditorialImage
      src={src}
      fallback={fallback}
      alt={alt}
      blockId={blockId}
      arrayKey={arrayKey}
      index={index}
      itemField={itemField}
      blockProps={blockProps}
      className="absolute inset-0 h-full w-full object-cover"
    />
  )
}

function DoodleHearts() {
  return (
    <svg width="28" height="22" viewBox="0 0 28 22" fill="none" aria-hidden>
      <path
        d="M6 4.5C4.5 3 2.2 3.4 1.5 5.2 1 6.5 1.8 8.5 6 12.5 10.2 8.5 11 6.5 10.5 5.2 9.8 3.4 7.5 3 6 4.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 2.5C16.8 1.5 15 1.8 14.4 3.2 14 4.1 14.6 5.5 18 9 21.4 5.5 22 4.1 21.6 3.2 21 1.8 19.2 1.5 18 2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DoodleSparkle() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <path d="M4 14h5M6.5 11.5V16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 6l1.8 3.2L19 11l-3.2 1.8L14 16l-1.8-3.2L9 11l3.2-1.8L14 6Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M20 18h3M21.5 16.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function VibrantBowlFrame({
  img,
  fallback,
  title,
  index,
  floatClass,
  blockId,
  arrayKey,
  itemField,
  blockProps,
}: {
  img: string
  fallback: string
  title: string
  index: number
  floatClass: string
  blockId?: string
  arrayKey?: string
  itemField?: string
  blockProps?: Record<string, unknown>
}) {
  const tileBg = typeof blockProps?.tile_bg === 'string' && blockProps.tile_bg.trim()
    ? blockProps.tile_bg.trim()
    : null
  const canvas = tileBg || WELLNESS_CARD_CANVAS_COLORS[index % WELLNESS_CARD_CANVAS_COLORS.length]
  const layout = WELLNESS_BLOB_LAYOUTS[index % WELLNESS_BLOB_LAYOUTS.length]
  const blobShapeA = WELLNESS_BLOB_SHAPES[index % WELLNESS_BLOB_SHAPES.length]
  const blobShapeB = WELLNESS_BLOB_SHAPES[(index + 3) % WELLNESS_BLOB_SHAPES.length]
  const flipDoodles = index % 2 === 1
  const inset = layout.bowlInset

  return (
    <div className={`wl-mosaic-frame ${floatClass}`}>
      <div className="wl-mosaic-canvas" style={{ backgroundColor: canvas }} />
      <div className="wl-mosaic-blob" style={blobStyle(layout.blobA, blobShapeA)} />
      <div className="wl-mosaic-blob wl-mosaic-blob-b" style={blobStyle(layout.blobB, blobShapeB)} />
      <div
        className="wl-mosaic-bowl"
        style={{ top: inset, right: inset, bottom: inset, left: inset }}
      >
        <div className="wl-mosaic-bowl-ring" />
        <MosaicImage
          src={img}
          fallback={fallback}
          alt={title}
          index={index}
          blockId={blockId}
          arrayKey={arrayKey}
          itemField={itemField}
          blockProps={blockProps}
        />
      </div>
      <div
        className="wl-mosaic-doodle wl-float-slow"
        style={flipDoodles ? { bottom: '22%', left: '10%' } : { top: '14%', right: '12%' }}
      >
        <DoodleHearts />
      </div>
      <div
        className="wl-mosaic-doodle wl-float"
        style={flipDoodles ? { top: '18%', right: '14%' } : { bottom: '20%', left: '8%' }}
      >
        <DoodleSparkle />
      </div>
    </div>
  )
}

export default function CategoryCardMosaic({
  categories,
  style,
  propImageByTitle,
  maxItems = 12,
  renderTitle,
  onCardClick,
  wrapCard,
  className = '',
  gridStyle,
  blockId,
  arrayKey,
  itemField,
  blockProps,
}: Props) {
  const textColor = style.text_color || '#182E20'
  const primaryColor = style.primary_color || textColor
  const items = categories.slice(0, maxItems)

  return (
    <>
      <style>{WELLNESS_MOTION_CSS}</style>
      <div className={`wl-mosaic-grid ${className}`.trim()} style={gridStyle}>
        {items.map((c, i) => {
          const displayTitle = sanitizeWellnessCategoryTitle(c.title)
          const img = resolveCategoryCardImage(c, i, propImageByTitle)
          const fallback = resolveCategoryCardImage({ title: displayTitle, image_url: null }, i, propImageByTitle)
          const floatClass = WELLNESS_FLOAT_CLASSES[i % WELLNESS_FLOAT_CLASSES.length]
          const popDelay = { animationDelay: `${Math.min(i * 90, 720)}ms` }

          const inner = (
            <>
              <VibrantBowlFrame
                img={img}
                fallback={fallback}
                title={displayTitle}
                index={i}
                floatClass={floatClass}
                blockId={blockId}
                arrayKey={arrayKey}
                itemField={itemField}
                blockProps={blockProps}
              />
              <div className="wl-mosaic-label">
                {renderTitle ? (
                  renderTitle(displayTitle, i)
                ) : (
                  <h3
                    style={{
                      fontFamily: style.font_heading,
                      color: textColor,
                      fontSize: '1.125rem',
                      fontWeight: 500,
                      lineHeight: 1.35,
                      margin: 0,
                    }}
                  >
                    {displayTitle}
                  </h3>
                )}
                <span className="wl-mosaic-cta" style={{ color: primaryColor }}>
                  Shop now →
                </span>
              </div>
            </>
          )

          const cardBody = (
            <div className="wl-mosaic-card group wl-pop-in" style={popDelay}>
              {inner}
            </div>
          )

          if (wrapCard) {
            return <Fragment key={`${displayTitle}-${i}`}>{wrapCard(cardBody, i)}</Fragment>
          }

          if (onCardClick) {
            return (
              <button
                key={`${displayTitle}-${i}`}
                type="button"
                className="wl-mosaic-card group wl-pop-in border-0 bg-transparent p-0 w-full"
                style={popDelay}
                onClick={() => onCardClick(i)}
              >
                {inner}
              </button>
            )
          }

          return <div key={`${displayTitle}-${i}`}>{cardBody}</div>
        })}
      </div>
    </>
  )
}
