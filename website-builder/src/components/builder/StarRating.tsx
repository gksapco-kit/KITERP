import { Star } from 'lucide-react'

const SIZE_CLASS = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
} as const

export type StarRatingSize = keyof typeof SIZE_CLASS

interface StarRatingProps {
  value: number
  size?: StarRatingSize
  className?: string
}

/** Fractional star display (e.g. 4.5 shows four full + one half star) */
export function StarRating({ value, size = 'md', className = '' }: StarRatingProps) {
  const clamped = Math.min(5, Math.max(0, value))
  const starClass = SIZE_CLASS[size]

  return (
    <div
      className={`flex gap-0.5 ${className}`}
      role="img"
      aria-label={`${clamped.toFixed(1)} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.min(1, Math.max(0, clamped - i))
        return (
          <span key={i} className="relative inline-flex shrink-0">
            <Star className={`${starClass} text-gray-200 dark:text-gray-600`} aria-hidden />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={`${starClass} fill-amber-400 text-amber-400`} aria-hidden />
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}
