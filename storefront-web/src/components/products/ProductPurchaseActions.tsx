import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, MessageSquare, Minus, Plus, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import type { StockValidationResult } from '@/lib/stockValidation'

type Props = {
  qty: number
  setQty: (qty: number) => void
  maxQty?: number | null
  minQty?: number
  onHandQty?: number | null
  validateQtyChange?: (next: number) => StockValidationResult
  displayPrice: number
  displayCurrency: string
  displayStock?: string
  variantValidationValid: boolean
  addToCartPending: boolean
  handleAddToCart: () => void
  handleBuyNow: () => void
  isSubscription?: boolean
  canQuote?: boolean
  onRequestQuote?: () => void
  isAuthenticated?: boolean
  storePath: (path: string) => string
  className?: string
}

export function ProductPurchaseActions({
  qty,
  setQty,
  maxQty,
  minQty = 1,
  onHandQty,
  validateQtyChange,
  displayPrice,
  displayCurrency,
  displayStock,
  variantValidationValid,
  addToCartPending,
  handleAddToCart,
  handleBuyNow,
  isSubscription = false,
  canQuote = false,
  onRequestQuote,
  isAuthenticated = false,
  storePath,
  className,
}: Props) {
  const [qtyError, setQtyError] = useState<string | undefined>()
  const hasStockCap = maxQty != null
  const qtyMax = hasStockCap ? maxQty : 99
  const atMaxQty = hasStockCap && qty >= qtyMax
  const outOfStock = displayStock === 'out_of_stock' || maxQty === 0
  const disabled = addToCartPending || outOfStock || !variantValidationValid
  const lineTotal = formatCurrency(displayPrice * qty, displayCurrency)

  useEffect(() => {
    setQtyError(undefined)
  }, [qty, maxQty, onHandQty, minQty])

  const stockCapMessage = (): string => {
    if (maxQty === 0) return 'Maximum stock reached — this item is unavailable to add.'
    if (onHandQty != null) {
      return `Maximum stock reached — only ${onHandQty} available on hand.`
    }
    return 'Maximum stock reached — you cannot add more of this item.'
  }

  const handleDecrease = () => {
    setQtyError(undefined)
    setQty(Math.max(minQty, qty - 1))
  }

  const handleIncrease = () => {
    const next = qty + 1
    if (validateQtyChange) {
      const check = validateQtyChange(next)
      if (!check.ok) {
        setQtyError(check.message)
        return
      }
    } else if (hasStockCap && next > qtyMax) {
      setQtyError(stockCapMessage())
      return
    }
    setQtyError(undefined)
    setQty(next)
  }

  const visibleQtyError =
    qtyError ??
    (atMaxQty && hasStockCap ? stockCapMessage() : undefined)

  return (
    <div className={className ?? 'space-y-4'}>
      {/* Quantity row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-sm font-medium text-gray-700 shrink-0">Qty:</span>
        <div className="inline-flex items-stretch rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={handleDecrease}
            disabled={qty <= minQty}
            className="flex h-11 w-11 items-center justify-center text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="flex h-11 min-w-[3rem] items-center justify-center border-x border-gray-200 bg-gray-50 px-3 text-sm font-semibold tabular-nums">
            {qty}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={handleIncrease}
            disabled={outOfStock}
            className="flex h-11 w-11 items-center justify-center text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-gray-600 sm:ml-auto">
          Total:{' '}
          <span className="font-semibold text-gray-900 tabular-nums">{lineTotal}</span>
        </p>
      </div>

      {visibleQtyError && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {visibleQtyError}
        </p>
      )}

      {/* Actions */}
      {isSubscription ? (
        <p className="text-xs text-gray-500 text-center py-1">
          Use the subscription plan above to subscribe.
        </p>
      ) : (
        <div className="flex w-full flex-col gap-2.5">
          <Button
            size="lg"
            className="h-12 w-full gap-2 rounded-lg bg-amber-400 font-bold text-slate-900 hover:bg-amber-500 shadow-sm"
            onClick={handleAddToCart}
            disabled={disabled}
          >
            {addToCartPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ShoppingCart className="h-5 w-5" />
            )}
            {outOfStock ? 'Out of Stock' : 'Add to Cart'}
          </Button>
          <Button
            size="lg"
            className="h-12 w-full rounded-lg font-bold shadow-sm"
            onClick={handleBuyNow}
            disabled={disabled}
          >
            Buy Now
          </Button>
          {!isAuthenticated && (
            <p className="text-center text-xs text-muted-foreground leading-relaxed">
              <Link to={storePath('/login')} className="font-medium text-primary hover:underline">
                Sign in
              </Link>
              {' '}required for Buy Now — you&apos;ll continue to checkout after login.
            </p>
          )}
        </div>
      )}

      {canQuote && onRequestQuote && (
        <Button
          variant="outline"
          size="lg"
          className="h-11 w-full rounded-lg font-semibold"
          onClick={onRequestQuote}
        >
          <MessageSquare className="mr-2 h-5 w-5" />
          Request a Quote
        </Button>
      )}

      {!isAuthenticated && (
        <p className="text-center text-xs text-gray-500 leading-relaxed">
          <Link to={storePath('/login')} className="font-medium text-primary hover:underline">
            Sign in
          </Link>
          {' '}to save your cart across devices
        </p>
      )}
    </div>
  )
}
