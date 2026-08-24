import { cn } from '@/lib/utils'

export function formatBadgeCount(count: number): string {
  return count > 99 ? '99+' : String(count)
}

type CountBadgeVariant = 'red' | 'primary'
type CountBadgeSize = 'default' | 'sm'

/** Fixed square dimensions so 1–2 digit counts stay circular (not pill-shaped). */
export function countBadgeCircleClass(
  count: number,
  variant: CountBadgeVariant = 'red',
  size: CountBadgeSize = 'default',
) {
  const fill =
    variant === 'primary'
      ? 'bg-primary text-primary-foreground'
      : 'bg-red-500 text-white'
  const textSize =
    size === 'sm'
      ? count > 99 ? 'text-[8px]' : 'text-[9px]'
      : count > 99 ? 'text-[11px]' : 'text-xs'
  const dimensions =
    size === 'sm'
      ? count > 99
        ? 'h-4 min-w-4 max-w-none px-0.5'
        : count > 9
          ? 'size-[18px] min-w-[18px] max-w-[18px]'
          : 'size-3.5 min-w-3.5 max-w-3.5'
      : count > 99
        ? 'h-6 min-w-6 max-w-none px-1.5'
        : count > 9
          ? 'size-7 min-w-7 max-w-7'
          : 'size-6 min-w-6 max-w-6'
  return cn(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold leading-none tabular-nums',
    fill,
    textSize,
    dimensions,
  )
}
