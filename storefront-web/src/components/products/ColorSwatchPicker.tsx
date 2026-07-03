import { cn, imgUrl } from '@/lib/utils'
import type { ProductColorOption } from '@/lib/variantOptions'

type Props = {
  options: ProductColorOption[]
  selectedVariantId?: string | null
  selectedImageIndex?: number
  selectedColorName?: string
  onSelect: (option: ProductColorOption) => void
  size?: 'sm' | 'md'
  className?: string
}

function isOptionSelected(
  option: ProductColorOption,
  selectedVariantId?: string | null,
  selectedImageIndex?: number,
  selectedColorName?: string,
): boolean {
  if (selectedColorName && option.name.toLowerCase() === selectedColorName.toLowerCase()) return true
  if (option.imageIndex != null) return selectedImageIndex === option.imageIndex
  return selectedVariantId === option.variantId
}

function lightBorder(color: string): boolean {
  const hex = color.replace('#', '')
  if (hex.length < 6) return true
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 210
}

export default function ColorSwatchPicker({
  options,
  selectedVariantId,
  selectedImageIndex = 0,
  selectedColorName,
  onSelect,
  size = 'md',
  className,
}: Props) {
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((option) => {
        const selected = isOptionSelected(option, selectedVariantId, selectedImageIndex, selectedColorName)
        const light = lightBorder(option.color)

        if (option.imageUrl) {
          return (
            <button
              key={option.id}
              type="button"
              title={option.name}
              aria-label={`Color ${option.name}`}
              aria-pressed={selected}
              onClick={() => onSelect(option)}
              className={cn(
                dim,
                'overflow-hidden rounded-full border-2 transition-all hover:scale-105',
                selected ? 'border-primary ring-2 ring-primary/25 scale-105' : 'border-gray-200',
              )}
            >
              <img
                src={imgUrl(option.imageUrl)}
                alt={option.name}
                className="h-full w-full object-cover"
              />
            </button>
          )
        }

        return (
          <button
            key={option.id}
            type="button"
            title={option.name}
            aria-label={`Color ${option.name}`}
            aria-pressed={selected}
            onClick={() => onSelect(option)}
            className={cn(
              dim,
              'rounded-full border-2 transition-all hover:scale-105',
              selected ? 'border-primary ring-2 ring-primary/25 scale-105' : light ? 'border-gray-300' : 'border-transparent',
            )}
            style={{ backgroundColor: option.color }}
          />
        )
      })}
    </div>
  )
}
