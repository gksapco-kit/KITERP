import { Minus, Plus, Trash2 } from 'lucide-react'
import { formatMoney, useCheckoutConfig } from '@/checkout/config'
import type { CartItem as CheckoutCartItem } from '@/checkout/types'
import type { Product, ProductVariant } from '@/types'
import { formatCurrency } from '@/lib/utils'
import {
  colorValueToCss,
  findVariantBySelections,
  findVariantForDimensionValue,
  getValuesForDimension,
  getVariantOptionDimensions,
  hasStructuredVariantOptions,
  isColorDimension,
  isSizeDimension,
  resolveSelectedVariant,
  selectionsFromVariant,
  variantDisplayLabel,
} from '@/lib/variantOptions'

type Props = {
  item: CheckoutCartItem
  product?: Product
  editable?: boolean
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

function DimensionSelector({
  dimension,
  variants,
  selections,
  disabled,
  onSelect,
}: {
  dimension: string
  variants: ProductVariant[]
  selections: Record<string, string>
  disabled?: boolean
  onSelect: (dimension: string, value: string) => void
}) {
  const values = getValuesForDimension(variants, dimension)
  const selectedValue = selections[dimension]
  const isColor = isColorDimension(dimension)
  const isSize = isSizeDimension(dimension)

  return (
    <div>
      <p className="ck-text-muted mb-1.5 text-xs font-medium uppercase tracking-wide">
        {dimension}
        {selectedValue ? (
          <span className="ml-1.5 font-normal normal-case text-gray-700">— {selectedValue}</span>
        ) : null}
      </p>
      <div className={`flex flex-wrap gap-2 ${isSize ? 'gap-1.5' : ''}`}>
        {values.map((value) => {
          const isSelected = selectedValue === value
          const sampleVariant = findVariantForDimensionValue(variants, dimension, value)
          const swatchColor = isColor ? colorValueToCss(value, sampleVariant) : undefined

          if (isColor && swatchColor) {
            const light = ['white', 'cream', 'beige', 'yellow', 'silver'].includes(value.toLowerCase())
            return (
              <button
                key={value}
                type="button"
                disabled={disabled}
                title={value}
                aria-label={`Select ${dimension} ${value}`}
                aria-pressed={isSelected}
                onClick={() => onSelect(dimension, value)}
                className="group flex flex-col items-center gap-1 disabled:opacity-50"
              >
                <span
                  className="h-9 w-9 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: swatchColor,
                    borderColor: isSelected ? 'hsl(var(--brand-primary))' : light ? '#d1d5db' : 'transparent',
                    boxShadow: isSelected ? '0 0 0 2px hsl(var(--brand-primary) / 0.25)' : undefined,
                  }}
                />
                <span
                  className={`text-[10px] font-medium capitalize leading-none ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}
                >
                  {value}
                </span>
              </button>
            )
          }

          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={`Select ${dimension} ${value}`}
              onClick={() => onSelect(dimension, value)}
              className={`ck-border ck-radius-sm px-3 transition-all disabled:opacity-50 ${
                isSize ? 'min-w-[2.75rem] py-2 text-center' : 'py-2 text-left'
              }`}
              style={{
                borderWidth: 2,
                borderColor: isSelected ? 'hsl(var(--brand-primary))' : undefined,
                background: isSelected ? 'hsl(var(--surface-muted))' : undefined,
                fontWeight: isSelected ? 600 : 500,
              }}
            >
              <span className={`text-xs ${isSize ? 'font-bold uppercase tracking-wide' : 'font-semibold capitalize'}`}>
                {value}
              </span>
              {!isSize && sampleVariant && (
                <span className="mt-0.5 block text-[10px] tabular-nums text-gray-500">
                  {formatCurrency(sampleVariant.price, sampleVariant.currency ?? 'INR')}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function CartDetailLineItem({
  item,
  product,
  editable,
  onUpdateQuantity,
  onRemove,
  onVariantChange,
  variantChangePending,
}: Props) {
  const { locale } = useCheckoutConfig()
  const productName = resolveProductName(item)
  const fallbackVariantLabel = resolveVariantLabel(item)
  const lineTotal = { amount: item.unitPrice.amount * item.quantity, currency: item.unitPrice.currency }

  const activeVariants = (product?.variants ?? []).filter((v) => v.is_active !== false)
  const selectedVariant = resolveSelectedVariant(
    activeVariants,
    item.variantId && item.variantId !== item.productId ? item.variantId : undefined,
    fallbackVariantLabel,
  )
  const selections = selectionsFromVariant(selectedVariant)
  const structuredOptions = hasStructuredVariantOptions(activeVariants)
  const optionDimensions = getVariantOptionDimensions(activeVariants)
  const selectedSummary = selectedVariant
    ? variantDisplayLabel(selectedVariant)
    : fallbackVariantLabel

  const handleDimensionSelect = (dimension: string, value: string) => {
    const nextSelections = { ...selections, [dimension]: value }
    const match =
      findVariantBySelections(activeVariants, nextSelections) ??
      findVariantForDimensionValue(activeVariants, dimension, value)
    if (match && match.id !== selectedVariant?.id) onVariantChange?.(match)
  }

  const showFallbackGrid =
    activeVariants.length > 0 &&
    !structuredOptions &&
    activeVariants.some((v) => variantDisplayLabel(v))

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
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={productName} className="h-full w-full object-cover" />
        ) : (
          <span className="ck-text-subtle text-xs">No image</span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 sm:pr-1">
            <div className="text-sm font-medium leading-snug break-words">{productName}</div>
            {selectedSummary && !structuredOptions && (
              <div className="ck-text-muted mt-0.5 text-xs">{selectedSummary}</div>
            )}
            {structuredOptions && selectedSummary && (
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                {optionDimensions.map((dim) =>
                  selections[dim] ? (
                    <span key={dim} className="text-xs text-gray-600">
                      <span className="font-medium text-gray-500">{dim}:</span>{' '}
                      <span className="capitalize">{selections[dim]}</span>
                    </span>
                  ) : null,
                )}
              </div>
            )}
            {item.inStock === false && (
              <span className="ck-badge ck-badge-warning mt-1">Out of stock</span>
            )}
          </div>
          <div className="shrink-0 text-sm font-medium tabular-nums sm:text-right">
            {formatMoney(lineTotal, locale)}
          </div>
        </div>

        {structuredOptions && editable && (
          <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
            {optionDimensions.map((dimension) => (
              <DimensionSelector
                key={dimension}
                dimension={dimension}
                variants={activeVariants}
                selections={selections}
                disabled={variantChangePending}
                onSelect={handleDimensionSelect}
              />
            ))}
          </div>
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
                onClick={() =>
                  onUpdateQuantity?.(item.id, Math.min(item.maxQuantity ?? 99, item.quantity + 1))
                }
                disabled={item.quantity >= (item.maxQuantity ?? 99)}
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
