import { Loader2, Minus, Plus, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  catalogAddButtonLabel,
  resolveCatalogAddButtonPresentation,
  type CatalogAddButtonStyle,
} from '@/lib/catalogAddButtonStyle'

type Props = {
  cartQty: number
  onAdd: () => void | Promise<void>
  onQtyChange: (qty: number) => void | Promise<void>
  disabled?: boolean
  pending?: boolean
  outOfStock?: boolean
  /** When set, + stops at this qty and onAtMax is called instead of increasing. */
  maxQty?: number | null
  onAtMax?: () => void
  labelOverride?: string
  primaryColor?: string
  addButtonStyle?: CatalogAddButtonStyle | string | null
  isMinimalCard?: boolean
  isCompactCard?: boolean
  fullWidth?: boolean
  className?: string
}

/**
 * Single Add-to-Cart control:
 * - empty cart → green "Add to Cart"
 * - in cart → same button with − / qty / + inside
 */
export function CatalogAddOrQtyControl({
  cartQty,
  onAdd,
  onQtyChange,
  disabled,
  pending,
  outOfStock,
  maxQty,
  onAtMax,
  labelOverride,
  primaryColor,
  addButtonStyle,
  isMinimalCard,
  isCompactCard,
  fullWidth = true,
  className,
}: Props) {
  const addBtn = resolveCatalogAddButtonPresentation({
    style: addButtonStyle,
    primaryColor,
    isAdded: cartQty > 0,
    isMinimalCard,
    isCompactCard,
    fullWidth,
  })
  const iconClass = addBtn.iconClassName
  const controlHeightClass = isMinimalCard
    ? 'h-9 min-h-9 py-0'
    : isCompactCard
      ? 'h-10 min-h-10 py-0'
      : 'h-11 min-h-11 py-0'
  const sideBtnClass = cn(
    'flex shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 disabled:pointer-events-none',
    isMinimalCard ? 'h-6 w-6' : 'h-7 w-7',
    'hover:bg-black/10',
  )
  const atMaxQty = maxQty != null && cartQty >= maxQty

  if (outOfStock && cartQty <= 0) {
    return (
      <div
        role="status"
        className={cn(
          'inline-flex w-full items-center justify-center font-semibold bg-red-50 text-red-600',
          controlHeightClass,
          isMinimalCard ? 'rounded-lg text-[11px]' : isCompactCard ? 'rounded-xl text-xs' : 'rounded-xl text-sm',
          className,
        )}
      >
        Out of Stock
      </div>
    )
  }

  if (cartQty > 0) {
    const baseLabel = isMinimalCard ? 'Add' : 'Add to Cart'
    const label =
      labelOverride && !labelOverride.toLowerCase().includes('stock')
        ? labelOverride.replace(/\s*\(\d+\)\s*$/, '')
        : baseLabel

    return (
      <div
        role="group"
        aria-label="Cart quantity"
        className={cn(
          addBtn.className,
          controlHeightClass,
          'box-border w-full items-center justify-center gap-3 overflow-hidden px-3',
          className,
        )}
        style={addBtn.style}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <ShoppingCart className={cn(iconClass, 'shrink-0')} />
          {!addBtn.iconOnly && <span className="truncate whitespace-nowrap">{label}</span>}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            className={sideBtnClass}
            disabled={disabled}
            aria-label={cartQty <= 1 ? 'Remove from cart' : 'Decrease quantity'}
            onClick={() => { void onQtyChange(Math.max(0, cartQty - 1)) }}
          >
            <Minus className={iconClass} strokeWidth={2.5} />
          </button>
          <span
            className={cn(
              'min-w-[1.25rem] text-center font-bold tabular-nums',
              isMinimalCard ? 'text-[11px]' : 'text-sm',
            )}
          >
            {cartQty}
          </span>
          <button
            type="button"
            className={cn(sideBtnClass, atMaxQty && 'opacity-40')}
            aria-disabled={atMaxQty}
            aria-label="Increase quantity"
            title={atMaxQty ? 'Maximum quantity reached' : 'Increase quantity'}
            onClick={() => {
              if (disabled) return
              if (atMaxQty) {
                onAtMax?.()
                return
              }
              void onQtyChange(cartQty + 1)
            }}
          >
            <Plus className={iconClass} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    )
  }

  const label = labelOverride ?? catalogAddButtonLabel(isMinimalCard, 0)

  return (
    <button
      type="button"
      disabled={disabled || pending}
      className={cn(addBtn.className, controlHeightClass, 'box-border items-center hover:opacity-90', className)}
      style={addBtn.style}
      aria-label={addBtn.iconOnly ? label : undefined}
      onClick={e => {
        e.preventDefault()
        e.stopPropagation()
        void onAdd()
      }}
    >
      {pending ? (
        <Loader2 className={cn(iconClass, 'animate-spin')} />
      ) : (
        <>
          <ShoppingCart className={iconClass} />
          {addBtn.showLabel ? label : null}
        </>
      )}
    </button>
  )
}
