import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  qty: number
  onChange: (qty: number) => void
  disabled?: boolean
  primaryColor?: string
  compact?: boolean
  className?: string
}

export function CatalogCardQuantityStepper({
  qty,
  onChange,
  disabled,
  primaryColor,
  compact,
  className,
}: Props) {
  const iconClass = compact ? 'w-3 h-3' : 'w-3.5 h-3.5'
  const btnClass = cn(
    'flex items-center justify-center shrink-0 transition-colors disabled:opacity-40 disabled:pointer-events-none',
    compact ? 'h-7 w-7' : 'h-8 w-8',
  )

  return (
    <div
      className={cn(
        'inline-flex items-center overflow-hidden rounded-lg border border-gray-200 bg-white',
        compact ? 'h-8' : 'h-9',
        className,
      )}
      onClick={e => e.stopPropagation()}
    >
      <button
        type="button"
        className={cn(btnClass, 'hover:bg-gray-50')}
        disabled={disabled || qty <= 1}
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(1, qty - 1))}
      >
        <Minus className={iconClass} />
      </button>
      <span
        className={cn(
          'min-w-[1.75rem] text-center font-semibold tabular-nums select-none',
          compact ? 'px-1 text-xs' : 'px-2 text-sm',
        )}
        style={primaryColor ? { color: primaryColor } : undefined}
      >
        {qty}
      </span>
      <button
        type="button"
        className={cn(btnClass, 'hover:bg-gray-50')}
        disabled={disabled}
        aria-label="Increase quantity"
        onClick={() => onChange(qty + 1)}
      >
        <Plus className={iconClass} />
      </button>
    </div>
  )
}
