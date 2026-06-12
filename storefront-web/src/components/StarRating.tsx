import { Star } from 'lucide-react'

interface StarRatingProps {
  rating: number
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean
  reviewCount?: number
  interactive?: boolean
  onRate?: (rating: number) => void
}

const sizes = { sm: 'w-3.5 h-3.5', md: 'w-5 h-5', lg: 'w-6 h-6' }
const textSizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' }

export default function StarRating({
  rating,
  size = 'md',
  showValue = false,
  reviewCount,
  interactive = false,
  onRate,
}: StarRatingProps) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= Math.round(rating)
          return (
            <button
              key={star}
              type="button"
              disabled={!interactive}
              onClick={() => interactive && onRate?.(star)}
              className={`${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
            >
              <Star
                className={`${sizes[size]} ${
                  filled ? 'fill-amber-400 text-amber-400' : 'fill-none text-gray-300'
                }`}
              />
            </button>
          )
        })}
      </div>
      {showValue && rating > 0 && (
        <span className={`${textSizes[size]} font-medium text-gray-700`}>{rating.toFixed(1)}</span>
      )}
      {reviewCount !== undefined && (
        <span className={`${textSizes[size]} text-gray-500`}>
          ({reviewCount})
        </span>
      )}
    </div>
  )
}
