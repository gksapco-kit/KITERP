import type { CSSProperties, MouseEvent } from 'react'
import { cn } from '@/lib/utils'
import type { ProductVariant } from '@/types'
import { variantFlatOptionTitle } from '@/lib/variantOptions'
import { getEffectiveStockStatus, type StockEntity } from '@/lib/stockValidation'

type ProductUom = { uom?: string | null; uom_quantity?: number | null }

type Props = {
  variants: ProductVariant[]
  selectedId?: string
  onSelect: (variantId: string) => void
  product?: ProductUom
  productStock?: StockEntity
  primaryColor?: string
  className?: string
}

/** Compact UOM / size chips for catalog cards (500 ml, 1 L, crate). */
export function CatalogVariantChips({
  variants,
  selectedId,
  onSelect,
  product,
  productStock,
  primaryColor,
  className,
}: Props) {
  if (variants.length < 2) return null

  const stopNav = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      className={cn('flex flex-wrap gap-1', className)}
      onClick={stopNav}
      onPointerDown={stopNav}
    >
      {variants.map((variant) => {
        const selected = variant.id === selectedId
        const title = variantFlatOptionTitle(variant, product)
        const outOfStock = productStock
          ? getEffectiveStockStatus(productStock, variant) === 'out_of_stock'
          : false
        const selectedStyle: CSSProperties | undefined =
          selected && primaryColor && !outOfStock
            ? { borderColor: primaryColor, backgroundColor: primaryColor, color: '#fff' }
            : undefined
        return (
          <button
            key={variant.id}
            type="button"
            aria-pressed={selected}
            title={outOfStock ? `${title} — Out of Stock` : title}
            onClick={(e) => {
              stopNav(e)
              onSelect(variant.id)
            }}
            className={cn(
              'inline-flex min-h-6 max-w-full items-center rounded-md border px-1.5 py-0 text-[10px] font-semibold leading-tight transition-colors',
              selected
                ? outOfStock
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-primary bg-primary text-primary-foreground'
                : outOfStock
                  ? 'border-gray-200 bg-gray-50 text-gray-400'
                  : 'border-gray-200 bg-white text-gray-800 hover:border-gray-400',
            )}
            style={selectedStyle}
          >
            {title}
          </button>
        )
      })}
    </div>
  )
}
