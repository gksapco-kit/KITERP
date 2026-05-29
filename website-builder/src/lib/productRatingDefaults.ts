export interface RatingBreakdownItem {
  stars: number
  percent: number
}

export const DEFAULT_RATING_BREAKDOWN: RatingBreakdownItem[] = [
  { stars: 5, percent: 68 },
  { stars: 4, percent: 22 },
  { stars: 3, percent: 7 },
  { stars: 2, percent: 2 },
  { stars: 1, percent: 1 },
]

export const PRODUCT_RATING_DEFAULTS = {
  rating: 4.5,
  reviewCount: 128,
  showReviewCount: true,
  showNumericScore: true,
  showRatingBreakdown: true,
  productRatingLayout: 'detailed' as const,
  starSize: 'md' as const,
}

export function defaultProductRatingProps() {
  return {
    text: 'Customer ratings',
    rating: PRODUCT_RATING_DEFAULTS.rating,
    reviewCount: PRODUCT_RATING_DEFAULTS.reviewCount,
    showReviewCount: PRODUCT_RATING_DEFAULTS.showReviewCount,
    showNumericScore: PRODUCT_RATING_DEFAULTS.showNumericScore,
    showRatingBreakdown: PRODUCT_RATING_DEFAULTS.showRatingBreakdown,
    productRatingLayout: PRODUCT_RATING_DEFAULTS.productRatingLayout,
    starSize: PRODUCT_RATING_DEFAULTS.starSize,
    ratingBreakdown: DEFAULT_RATING_BREAKDOWN.map((r) => ({ ...r })),
  }
}
