import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { formatMoney, useCheckoutConfig } from '@/checkout/config'
import type { CartItem as CheckoutCartItem } from '@/checkout/types'
import type { Product, ProductVariant } from '@/types'
import { formatCurrency, imgUrl } from '@/lib/utils'
import ProductOptionPicker, { getColorNameFromOptionRows } from '@/components/products/ProductOptionPicker'
import {
  buildProductCardOptionRows,
  resolveCardDisplayImage,
  resolveVariantForCardPricing,
  resolveSelectedVariant,
  selectionsFromVariant,
  validateVariantCombination,
  variantDisplayLabel,
  type ProductCardOptionRow,
} from '@/lib/variantOptions'

function resolveLineItemDisplayImage(
  rows: ProductCardOptionRow[],
  galleryImages: { url: string; alt_text?: string }[],
  selectedColorName: string | undefined,
  variants: ProductVariant[],
  pricingVariant: ProductVariant | undefined,
  fallbackImage?: string,
): string | undefined {
  const fromSwatch = resolveCardDisplayImage(rows, galleryImages, selectedColorName)
  if (fromSwatch) return fromSwatch

  const colorRow = rows.find((r) => r.type === 'color')
  if (colorRow?.type === 'color' && selectedColorName) {
    const swatch = colorRow.swatches.find(
      (s) => s.value.toLowerCase() === selectedColorName.toLowerCase(),
    )
    if (swatch?.variantId) {
      const linked = variants.find((v) => v.id === swatch.variantId)
      const mediaUrl =
        linked?.media?.find((m) => m.is_primary)?.url ?? linked?.media?.[0]?.url
      if (mediaUrl) return mediaUrl
    }
  }

  const variantMedia =
    pricingVariant?.media?.find((m) => m.is_primary)?.url ?? pricingVariant?.media?.[0]?.url
  if (variantMedia) return variantMedia

  return fallbackImage
}

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
  onVariantChange,
  variantChangePending,
}: Props) {
  const { locale } = useCheckoutConfig()
  const productName = resolveProductName(item)
  const fallbackVariantLabel = resolveVariantLabel(item)

  const activeVariants = (product?.variants ?? []).filter((v) => v.is_active !== false)
  const selectedVariant = resolveSelectedVariant(
    activeVariants,
    item.variantId && item.variantId !== item.productId ? item.variantId : undefined,
    fallbackVariantLabel,
  )

  const optionRows = useMemo(
    () => buildProductCardOptionRows(activeVariants, product?.images),
    [activeVariants, product?.images],
  )
  const galleryImages = useMemo(
    () =>
      product?.images?.length
        ? product.images.map((img) => ({ url: img.url, alt_text: img.alt_text }))
        : item.imageUrl
          ? [{ url: item.imageUrl }]
          : [],
    [product?.images, item.imageUrl],
  )
  const hasStructuredOptions = optionRows.length > 0

  const [selections, setSelections] = useState<Record<string, string>>(() =>
    selectionsFromVariant(selectedVariant),
  )
  const [selectedColorName, setSelectedColorName] = useState<string | undefined>(() =>
    getColorNameFromOptionRows(selectedVariant, optionRows),
  )

  useEffect(() => {
    const nextSelections = selectionsFromVariant(selectedVariant)
    setSelections(nextSelections)
    setSelectedColorName(getColorNameFromOptionRows(selectedVariant, optionRows))
  }, [item.variantId, product?.id, optionRows.length, selectedVariant?.id])

  const validation = useMemo(
    () => validateVariantCombination(activeVariants, selections, selectedColorName),
    [activeVariants, selections, selectedColorName],
  )

  const pricingVariant = useMemo(
    () =>
      resolveVariantForCardPricing(activeVariants, optionRows, selections, selectedColorName) ??
      selectedVariant,
    [activeVariants, optionRows, selections, selectedColorName, selectedVariant],
  )

  const unitPriceMinor = Math.round((pricingVariant?.price ?? item.unitPrice.amount / 100) * 100)
  const lineTotal = { amount: unitPriceMinor * item.quantity, currency: item.unitPrice.currency }

  const selectedSummary = selectedVariant
    ? variantDisplayLabel(selectedVariant)
    : fallbackVariantLabel

  const applyVariantIfValid = (nextSelections: Record<string, string>, nextColor?: string) => {
    const result = validateVariantCombination(activeVariants, nextSelections, nextColor)
    if (result.valid && result.variant && result.variant.id !== selectedVariant?.id) {
      onVariantChange?.(result.variant)
    }
  }

  const handleSelectSize = (dimension: string, value: string) => {
    const nextSelections = { ...selections, [dimension]: value }
    setSelections(nextSelections)
    applyVariantIfValid(nextSelections, selectedColorName)
  }

  const handleSelectColor = (colorName: string) => {
    setSelectedColorName(colorName)
    applyVariantIfValid(selections, colorName)
  }

  const showFallbackGrid =
    activeVariants.length > 0 &&
    !hasStructuredOptions &&
    activeVariants.some((v) => variantDisplayLabel(v))

  const displayImage = useMemo(
    () =>
      resolveLineItemDisplayImage(
        optionRows,
        galleryImages,
        selectedColorName,
        activeVariants,
        pricingVariant,
        item.imageUrl,
      ),
    [optionRows, galleryImages, selectedColorName, activeVariants, pricingVariant, item.imageUrl],
  )

  const qtyCap = maxQuantity ?? item.maxQuantity ?? 99

  return (
    <div className="flex items-start gap-3 py-4 first:pt-2 last:pb-2">
      <div
        className="ck-radius-sm relative flex shrink-0 items-center justify-center"
        style={{
          width: 72,
          height: 72,
          background: 'hsl(var(--surface-muted))',
          overflow: 'hidden',
        }}
      >
        {displayImage ? (
          <img
            key={displayImage}
            src={imgUrl(displayImage)}
            alt={productName}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="ck-text-subtle text-xs">No image</span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 sm:pr-1">
            <div className="text-sm font-medium leading-snug break-words">{productName}</div>
            {selectedSummary && !hasStructuredOptions && (
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

        {hasStructuredOptions && editable && (
          <ProductOptionPicker
            rows={optionRows}
            selections={selections}
            selectedColorName={selectedColorName}
            variants={activeVariants}
            onSelectSize={handleSelectSize}
            onSelectColor={handleSelectColor}
            errorMessage={validation.valid ? undefined : validation.message}
            disabled={variantChangePending}
          />
        )}

        {showFallbackGrid && editable && (
          <div>
            <p className="ck-text-muted mb-1.5 text-xs font-medium uppercase tracking-wide">Options</p>
            <div className="flex flex-wrap gap-2">
              {activeVariants.map((variant) => {
                const label = variantDisplayLabel(variant) || variant.name
                const isSelected = selectedVariant?.id === variant.id
                return (
                  <button
                    key={variant.id}
                    type="button"
                    disabled={variantChangePending}
                    aria-pressed={isSelected}
                    onClick={() => onVariantChange?.(variant)}
                    className="ck-border ck-radius-sm px-3 py-2 text-left transition-all disabled:opacity-50"
                    style={{
                      borderWidth: 2,
                      borderColor: isSelected ? 'hsl(var(--brand-primary))' : undefined,
                      background: isSelected ? 'hsl(var(--surface-muted))' : undefined,
                    }}
                  >
                    <p className="text-xs font-semibold leading-snug capitalize">{label}</p>
                    <p className="mt-0.5 text-xs tabular-nums">
                      {formatCurrency(variant.price, variant.currency ?? 'INR')}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {editable && (
          <div className="flex items-center justify-between">
            <div className="ck-border ck-radius-sm flex items-center" style={{ width: 'fit-content' }}>
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
              <span className="px-2 text-sm" style={{ minWidth: 24, textAlign: 'center' }}>
                {item.quantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                className="ck-btn-ghost"
                onClick={() => onUpdateQuantity?.(item.id, item.quantity + 1)}
                style={{ padding: '6px 10px' }}
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
        )}
      </div>
    </div>
  )
}
