import { AlertCircle } from 'lucide-react'
import { cn, imgUrl } from '@/lib/utils'
import type { ProductVariant } from '@/types'
import {
  isCombinationAvailable,
  resolveColorNameForVariant,
  type ProductCardOptionRow,
} from '@/lib/variantOptions'

export type ProductOptionPickerProps = {
  rows: ProductCardOptionRow[]
  selections: Record<string, string>
  selectedColorName?: string
  selectedVariantId?: string
  variants: ProductVariant[]
  onSelectSize: (dimension: string, value: string) => void
  onSelectColor: (name: string) => void
  errorMessage?: string
  disabled?: boolean
  className?: string
  stopPropagation?: boolean
}

function lightSwatchBorder(color: string): boolean {
  const hex = color.replace('#', '')
  if (hex.length < 6) return false
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 210
}

function SizeChip({
  value,
  selected,
  unavailable,
  disabled,
  stopPropagation,
  onClick,
}: {
  value: string
  selected: boolean
  unavailable?: boolean
  disabled?: boolean
  stopPropagation?: boolean
  onClick: () => void
}) {
  const compact = value.trim().length <= 3
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      title={value}
      onClick={(e) => {
        if (stopPropagation) {
          e.preventDefault()
          e.stopPropagation()
        }
        onClick()
      }}
      className={cn(
        'inline-flex h-8 items-center justify-center rounded border text-[11px] font-semibold uppercase leading-none whitespace-nowrap transition-all disabled:opacity-50',
        compact ? 'w-8 shrink-0 p-0' : 'min-w-8 shrink-0 px-2.5',
        selected
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : unavailable
            ? 'border-border bg-muted/40 text-muted-foreground opacity-50'
            : 'border-border bg-background text-foreground hover:border-primary/40',
      )}
    >
      {value}
    </button>
  )
}

function ColorSwatch({
  css,
  label,
  imageUrl,
  selected,
  unavailable,
  disabled,
  stopPropagation,
  onClick,
}: {
  css: string
  label: string
  imageUrl?: string
  selected: boolean
  unavailable?: boolean
  disabled?: boolean
  stopPropagation?: boolean
  onClick: () => void
}) {
  const light = lightSwatchBorder(css)
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={(e) => {
        if (stopPropagation) {
          e.preventDefault()
          e.stopPropagation()
        }
        onClick()
      }}
      className={cn(
        'h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 transition-all disabled:opacity-50',
        selected
          ? 'border-primary ring-2 ring-primary/40 ring-offset-1 scale-105 shadow-sm'
          : 'border-gray-200 hover:scale-105 hover:border-primary/50',
        unavailable && !selected && 'opacity-40',
      )}
      style={
        imageUrl
          ? undefined
          : {
              backgroundColor: css,
              borderColor: selected ? undefined : light ? '#d1d5db' : css,
            }
      }
    >
      {imageUrl ? (
        <img src={imgUrl(imageUrl)} alt={label} className="h-full w-full object-cover" />
      ) : null}
    </button>
  )
}

export default function ProductOptionPicker({
  rows,
  selections,
  selectedColorName,
  selectedVariantId,
  variants,
  onSelectSize,
  onSelectColor,
  errorMessage,
  disabled,
  className,
  stopPropagation,
}: ProductOptionPickerProps) {
  if (!rows.length) return null

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {rows.map((row) => (
        <div
          key={row.type === 'size' ? `size-${row.label}` : 'color'}
          className="flex items-center gap-2"
        >
          <span className="w-12 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground truncate" title={row.label}>
            {row.label}
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {row.type === 'size'
              ? row.values.map((value) => {
                  const selected = selections[row.label] === value
                  const unavailable =
                    !!selectedColorName &&
                    !isCombinationAvailable(
                      variants,
                      { ...selections, [row.label]: value },
                      selectedColorName,
                    )
                  return (
                    <SizeChip
                      key={value}
                      value={value}
                      selected={selected}
                      unavailable={unavailable && !selected}
                      disabled={disabled}
                      stopPropagation={stopPropagation}
                      onClick={() => onSelectSize(row.label, value)}
                    />
                  )
                })
              : row.swatches.map(({ css, value, imageUrl, variantId }) => {
                  const selected =
                    selectedColorName?.toLowerCase() === value.toLowerCase()
                    || (!!selectedVariantId && variantId === selectedVariantId)
                  const unavailable =
                    !selected &&
                    !isCombinationAvailable(variants, selections, value)
                  return (
                    <ColorSwatch
                      key={`${value}-${imageUrl ?? css}`}
                      css={css}
                      label={value}
                      imageUrl={imageUrl}
                      selected={selected}
                      unavailable={unavailable && !selected}
                      disabled={disabled}
                      stopPropagation={stopPropagation}
                      onClick={() => onSelectColor(value)}
                    />
                  )
                })}
          </div>
        </div>
      ))}
      {errorMessage ? (
        <p className="flex items-start gap-1 text-[11px] leading-snug text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </p>
      ) : null}
    </div>
  )
}

export function getColorNameFromOptionRows(
  variant: ProductVariant | undefined,
  rows: ProductCardOptionRow[],
  variants: ProductVariant[] = [],
): string | undefined {
  return resolveColorNameForVariant(variant, rows, variants)
}
