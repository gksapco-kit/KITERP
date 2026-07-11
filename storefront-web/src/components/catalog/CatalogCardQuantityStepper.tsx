import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  qty: number
  onChange: (qty: number) => void
  disabled?: boolean
  /** Soft accent for +/- controls (matches store primary). */
  primaryColor?: string
  compact?: boolean
  /** Stretch to full card width. */
  fullWidth?: boolean
  /** Lowest qty before remove. Use 0 to allow clearing the line. */
  minQty?: number
  /** Disable only the + control (e.g. out of stock). */
  maxDisabled?: boolean
  className?: string
}

export function CatalogCardQuantityStepper({
  qty,
  onChange,
  disabled,
  primaryColor,
  compact,
  fullWidth,
  minQty = 0,
  maxDisabled,
  className,
}: Props) {
  const iconClass = compact ? 'w-3.5 h-3.5' : 'w-4 h-4'
  const btnClass = cn(
    'flex items-center justify-center shrink-0 transition-colors disabled:opacity-40 disabled:pointer-events-none',
    compact ? 'h-8 w-8' : 'h-9 w-9',
  )
  const accent = primaryColor || 'hsl(var(--primary))'
  const atMin = qty <= Math.max(0, minQty)

  return (
    <div
      className={cn(
        'inline-flex items-center overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm',
        compact ? 'h-8' : 'h-10',
        fullWidth && 'w-full justify-between',
        className,
      )}
      onClick={e => e.stopPropagation()}
    >
      <button
        type="button"
        className={cn(btnClass, 'hover:bg-gray-50')}
        style={{ color: accent }}
        disabled={disabled || atMin}
        aria-label={qty <= 1 && minQty <= 0 ? 'Remove from cart' : 'Decrease quantity'}
        onClick={() => onChange(Math.max(minQty, qty - 1))}
      >
        <Minus className={iconClass} strokeWidth={2.5} />
      </button>
      <span
        className={cn(
          'min-w-[2rem] flex-1 text-center font-semibold tabular-nums select-none text-gray-900',
          compact ? 'px-1 text-xs' : 'px-2 text-sm',
        )}
      >
        {qty}
      </span>
      <button
        type="button"
        className={cn(btnClass, 'hover:bg-gray-50')}
        style={{ color: accent }}
        disabled={disabled || maxDisabled}
        aria-label="Increase quantity"
        onClick={() => onChange(qty + 1)}
      >
        <Plus className={iconClass} strokeWidth={2.5} />
      </button>
    </div>
  )
}
