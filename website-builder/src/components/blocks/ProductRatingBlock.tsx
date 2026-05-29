import { Star } from 'lucide-react'
import { StarRating, type StarRatingSize } from '../builder/StarRating'
import { SectionHeading } from '../builder/SectionHeading'
import { PRODUCT_RATING_DEFAULTS } from '../../lib/productRatingDefaults'
import type { Block } from '../../types/builder'

interface ProductRatingBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
}

export function ProductRatingBlock({ block, layoutStyle }: ProductRatingBlockProps) {
  const { props, styles } = block
  const rawRating = Number(props.rating ?? PRODUCT_RATING_DEFAULTS.rating)
  const rating = Math.min(5, Math.max(0, Number.isFinite(rawRating) ? rawRating : PRODUCT_RATING_DEFAULTS.rating))
  const reviewCount = props.reviewCount ?? PRODUCT_RATING_DEFAULTS.reviewCount
  const showCount = props.showReviewCount !== false
  const showScore = props.showNumericScore !== false
  const showBreakdown = props.showRatingBreakdown !== false
  const layout = props.productRatingLayout ?? PRODUCT_RATING_DEFAULTS.productRatingLayout
  const starSize = (props.starSize ?? PRODUCT_RATING_DEFAULTS.starSize) as StarRatingSize
  const breakdown = Array.isArray(props.ratingBreakdown) ? props.ratingBreakdown : []

  const reviewLabel =
    reviewCount >= 1000
      ? `${(reviewCount / 1000).toFixed(1)}k reviews`
      : `${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}`

  const scoreBlock = (
    <div className="flex flex-col items-center justify-center text-center sm:items-start sm:text-left">
      {showScore && (
        <span className="text-4xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-gray-100">
          {rating.toFixed(1)}
        </span>
      )}
      <StarRating value={rating} size={starSize} className="mt-2" />
      {showCount && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Based on <span className="font-medium text-gray-700 dark:text-gray-300">{reviewLabel}</span>
        </p>
      )}
    </div>
  )

  const breakdownBars = (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      {[5, 4, 3, 2, 1].map((stars) => {
        const row = breakdown.find((b) => b.stars === stars) ?? { stars, percent: 0 }
        const pct = Math.min(100, Math.max(0, row.percent))
        return (
          <div key={stars} className="flex items-center gap-2 text-sm">
            <span className="flex w-10 shrink-0 items-center gap-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">
              {stars}
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
            </span>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-9 shrink-0 text-right text-xs tabular-nums text-gray-500">{pct}%</span>
          </div>
        )
      })}
    </div>
  )

  const compactRow = (
    <div className="flex flex-wrap items-center gap-3">
      <StarRating value={rating} size={starSize} />
      {showScore && (
        <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{rating.toFixed(1)}</span>
      )}
      {showCount && <span className="text-sm text-gray-500">({reviewLabel})</span>}
    </div>
  )

  return (
    <section style={layoutStyle} className="w-full min-w-0">
      {props.text && (
        <SectionHeading
          title={props.text}
          subtitle={props.subtitle}
          styles={styles}
          className="mb-6"
          titleTag="h2"
          titleClassName="text-xl font-bold"
        />
      )}

      <div
        className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/50 sm:p-6"
        style={{
          backgroundColor: styles.backgroundColor,
          color: styles.textColor,
          borderRadius: styles.borderRadius,
          padding: styles.padding,
        }}
      >
        {layout === 'compact' ? (
          compactRow
        ) : (
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-10">
            {scoreBlock}
            {showBreakdown && breakdown.length > 0 && breakdownBars}
          </div>
        )}
      </div>
    </section>
  )
}
