import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatMoney, useCheckoutConfig } from '@/checkout/config'
import type { CartItem as CheckoutCartItem } from '@/checkout/types'
import type { Product, ProductVariant } from '@/types'
import { ProductThumb } from '@/components/products/ProductThumb'
import { resolveVariantThumbnailUrl } from '@/lib/productImageUtils'
import {
  resolveSelectedVariant,
  variantDisplayLabel,
  variantFlatOptionTitle,
} from '@/lib/variantOptions'

type Props = {
  item: CheckoutCartItem
  product?: Product
  editable?: boolean
  maxQuantity?: number
  onUpdateQuantity?: (id: string, q: number) => void
  onRemove?: (id: string) => void
  onVariantChange?: (variant: ProductVariant) => void
  variantChangePending?: boolean
}

function resolveVariantLabel(item: CheckoutCartItem): string | undefined {
  if (item.variantLabel) return item.variantLabel
  const sep = item.name.lastIndexOf(' - ')
  if (sep > 0) return item.name.slice(sep + 3)
  return undefined
}

function resolveProductName(item: CheckoutCartItem): string {
  if (item.variantLabel) return item.name
  const sep = item.name.lastIndexOf(' - ')
  if (sep > 0) return item.name.slice(0, sep)
  return item.name
}

export function CartDetailLineItem({
  item,
  product,
  editable,
  maxQuantity,
  onUpdateQuantity,
  onRemove,
}: Props) {
  const { locale } = useCheckoutConfig()
  const productName = resolveProductName(item)
  const fallbackVariantLabel = resolveVariantLabel(item)

  const activeVariants = useMemo(
    () => (product?.variants ?? []).filter((v) => v.is_active !== false),
    [product?.variants],
  )
  const selectedVariant = useMemo(
    () => resolveSelectedVariant(activeVariants, item.variantId, fallbackVariantLabel),
    [activeVariants, item.variantId, fallbackVariantLabel],
  )

  const unitPriceMinor = Math.round((selectedVariant?.price ?? item.unitPrice.amount / 100) * 100)
  const lineTotal = { amount: unitPriceMinor * item.quantity, currency: item.unitPrice.currency }

  const selectedSummary = selectedVariant
    ? variantFlatOptionTitle(selectedVariant, product) || variantDisplayLabel(selectedVariant)
    : fallbackVariantLabel

  const displayImage =
    resolveVariantThumbnailUrl(selectedVariant)
    || item.imageUrl
    || product?.images?.find((img) => img.is_primary)?.url
    || product?.images?.[0]?.url

  const qtyCap = maxQuantity ?? item.maxQuantity ?? 99
  const atMaxQty = item.quantity >= qtyCap
  const exceedsStock = item.quantity > qtyCap
  const [qtyDraft, setQtyDraft] = useState(String(item.quantity))
  const [qtyFocused, setQtyFocused] = useState(false)

  useEffect(() => {
    if (!qtyFocused) setQtyDraft(String(item.quantity))
  }, [item.quantity, qtyFocused])

  const applyQty = (raw: number) => {
    if (!Number.isFinite(raw)) {
      setQtyDraft(String(item.quantity))
      return
    }
    const next = Math.floor(raw)
    if (next <= 0) {
      onUpdateQuantity?.(item.id, 0)
      return
    }
    if (next > qtyCap) {
      toast.error(`Only ${qtyCap} available in stock — quantity set to ${qtyCap}.`)
      setQtyDraft(String(qtyCap))
      onUpdateQuantity?.(item.id, qtyCap)
      return
    }
    onUpdateQuantity?.(item.id, next)
  }

  const handleQtyInputChange = (raw: string) => {
    if (raw === '') {
      setQtyDraft(raw)
      return
    }
    if (!/^\d+$/.test(raw)) return
    setQtyDraft(raw)
  }

  const handleQtyBlur = () => {
    setQtyFocused(false)
    if (qtyDraft.trim() === '') {
      setQtyDraft(String(item.quantity))
      return
    }
    applyQty(Number(qtyDraft))
  }

  return (
    <div className="flex items-start gap-3 py-4 first:pt-2 last:pb-2">
      <div
        className="ck-radius-sm relative flex shrink-0 items-center justify-center bg-gray-50"
        style={{
          width: 88,
          height: 88,
          overflow: 'hidden',
        }}
      >
        <ProductThumb
          src={displayImage}
          alt={productName}
          className="absolute inset-0"
          imgClassName="object-cover object-center"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 sm:pr-1">
            <div className="text-sm font-medium leading-snug break-words">{productName}</div>
            {selectedSummary && (
              <div className="ck-text-muted mt-0.5 text-xs">{selectedSummary}</div>
            )}
            {item.inStock === false && (
              <span className="ck-badge ck-badge-warning mt-1">Out of stock</span>
            )}
          </div>
          <div className="shrink-0 text-sm font-medium tabular-nums sm:text-right">
            {formatMoney(lineTotal, locale)}
          </div>
        </div>

        {editable && (
          <div className="flex flex-col gap-1.5">
            {exceedsStock && (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium text-destructive">
                  Only {qtyCap} available in stock — please reduce quantity.
                </p>
                <button
                  type="button"
                  className="ck-btn-secondary text-xs"
                  style={{ padding: '4px 10px', width: 'auto' }}
                  onClick={() => onUpdateQuantity?.(item.id, Math.max(0, qtyCap))}
                >
                  {qtyCap <= 0 ? 'Remove from cart' : `Reduce to ${qtyCap}`}
                </button>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div
                className="ck-border ck-radius-sm flex items-center overflow-hidden bg-white"
                style={{ width: 'fit-content' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  className="ck-btn-ghost"
                  onClick={() => onUpdateQuantity?.(item.id, Math.max(1, item.quantity - 1))}
                  disabled={item.quantity <= 1}
                  style={{ padding: '6px 10px' }}
                >
                  <Minus size={14} />
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
                    if (e.key === 'Enter') e.currentTarget.blur()
                    e.stopPropagation()
                  }}
                  className="h-9 w-12 border-x px-1 text-center text-sm font-semibold tabular-nums outline-none"
                  style={{
                    borderColor: 'hsl(var(--border))',
                    background: 'hsl(var(--surface-muted))',
                    color: 'hsl(var(--foreground))',
                    minWidth: 40,
                  }}
                />
                <button
                  type="button"
                  aria-label="Increase quantity"
                  className="ck-btn-ghost"
                  title={atMaxQty ? `Only ${qtyCap} available in stock` : 'Increase quantity'}
                  onClick={() => {
                    if (item.quantity >= qtyCap) {
                      toast.error(`Only ${qtyCap} available in stock.`)
                      if (item.quantity > qtyCap) onUpdateQuantity?.(item.id, qtyCap)
                      return
                    }
                    onUpdateQuantity?.(item.id, item.quantity + 1)
                  }}
                  style={{ padding: '6px 10px', opacity: atMaxQty ? 0.45 : 1 }}
                >
                  <Plus size={14} />
                </button>
              </div>
              <button
                type="button"
                className="ck-btn-ghost flex items-center gap-1"
                onClick={() => onRemove?.(item.id)}
                aria-label={`Remove ${productName}`}
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
