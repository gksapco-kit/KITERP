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
  /** When false, hide line Total (no price / not_applicable). */
  hasDisplayPrice?: boolean
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
  /** When true and guest, show “Sign in required for Buy Now”. */
  signInMandatory?: boolean
  storePath: (path: string) => string
  className?: string
  /** Hide qty / add-to-cart / buy-now (e.g. product has no variants). Quote + sign-in hints still show. */
  hidePurchaseControls?: boolean
}

export function ProductPurchaseActions({
  qty,
  setQty,
  maxQty,
  minQty = 1,
  onHandQty,
  validateQtyChange,
  displayPrice,
  hasDisplayPrice = true,
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
  signInMandatory = false,
  storePath,
  className,
  hidePurchaseControls = false,
}: Props) {
  const [qtyError, setQtyError] = useState<string | undefined>()
  const [qtyDraft, setQtyDraft] = useState(String(qty))
  const [qtyFocused, setQtyFocused] = useState(false)
  const hasStockCap = maxQty != null
  const qtyMax = hasStockCap ? maxQty : 99
  const atMaxQty = hasStockCap && qty >= qtyMax
  const outOfStock = displayStock === 'out_of_stock' || maxQty === 0
  const disabled = addToCartPending || outOfStock || !variantValidationValid
  const showTotal = hasDisplayPrice && displayPrice > 0
  const lineTotal = showTotal ? formatCurrency(displayPrice * qty, displayCurrency) : null

  useEffect(() => {
    setQtyError(undefined)
  }, [qty, maxQty, onHandQty, minQty])

  useEffect(() => {
    if (!qtyFocused) setQtyDraft(String(qty))
  }, [qty, qtyFocused])

  const stockCapMessage = (): string => {
    if (maxQty === 0) return 'Maximum stock reached — this item is unavailable to add.'
    if (onHandQty != null) {
      return `Maximum stock reached — only ${onHandQty} available on hand.`
    }
    return 'Maximum stock reached — you cannot add more of this item.'
  }

  const applyQty = (next: number): boolean => {
    const clampedMin = Math.max(minQty, Math.floor(next))
    if (validateQtyChange) {
      const check = validateQtyChange(clampedMin)
      if (!check.ok) {
        setQtyError(check.message)
        if (hasStockCap && clampedMin > qtyMax && qtyMax >= minQty) {
          setQty(qtyMax)
          setQtyDraft(String(qtyMax))
          return true
        }
        return false
      }
    } else if (hasStockCap && clampedMin > qtyMax) {
      setQtyError(stockCapMessage())
      setQty(Math.max(minQty, qtyMax))
      setQtyDraft(String(Math.max(minQty, qtyMax)))
      return true
    }
    setQtyError(undefined)
    setQty(clampedMin)
    setQtyDraft(String(clampedMin))
    return true
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

  const handleQtyInputChange = (raw: string) => {
    if (raw === '' || raw === '-') {
      setQtyDraft(raw)
      return
    }
    if (!/^\d+$/.test(raw)) return
    setQtyDraft(raw)
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return
    applyQty(parsed)
  }

  const handleQtyBlur = () => {
    setQtyFocused(false)
    const parsed = Number(qtyDraft)
    if (!Number.isFinite(parsed) || qtyDraft.trim() === '') {
      setQtyDraft(String(qty))
      return
    }
    if (!applyQty(parsed)) {
      setQtyDraft(String(qty))
    }
  }

  const visibleQtyError =
    qtyError ??
    (atMaxQty && hasStockCap ? stockCapMessage() : undefined)

  return (
    <div className={className ?? 'space-y-4'}>
      {!hidePurchaseControls && (
        <>
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
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label="Quantity"
                value={qtyDraft}
                onFocus={() => setQtyFocused(true)}
                onBlur={handleQtyBlur}
                onChange={(e) => handleQtyInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  }
                }}
                disabled={outOfStock}
                className="h-11 w-14 border-x border-gray-200 bg-gray-50 px-1 text-center text-sm font-semibold tabular-nums text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-500 disabled:opacity-40"
              />
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
            {lineTotal != null && (
              <p className="text-sm text-gray-600 sm:ml-auto">
                Total:{' '}
                <span className="font-semibold text-gray-900 tabular-nums">{lineTotal}</span>
              </p>
            )}
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
              {signInMandatory && !isAuthenticated && (
                <p className="text-center text-xs text-muted-foreground leading-relaxed">
                  <Link to={storePath('/login')} className="font-medium text-primary hover:underline">
                    Sign in
                  </Link>
                  {' '}required for Buy Now — you&apos;ll continue to checkout after login.
                </p>
              )}
            </div>
          )}
        </>
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

      {!isAuthenticated && !hidePurchaseControls && (
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
