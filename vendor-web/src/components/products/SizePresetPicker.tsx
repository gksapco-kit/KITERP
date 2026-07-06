import { Label } from '@/components/ui/label'
import { SIZE_PALETTE, type SizePaletteEntry } from '@/lib/productVariantPresets'
import { cn } from '@/lib/utils'

type Props = {
  selectedValue: string | null
  onSelect: (preset: SizePaletteEntry) => void
}

export function SizePresetPicker({ selectedValue, onSelect }: Props) {
  return (
    <div className="space-y-2">
      <Label>Common sizes</Label>
      <p className="text-xs text-muted-foreground">Select a size to fill the name and code.</p>
      <div className="flex flex-wrap gap-1.5">
        {SIZE_PALETTE.map(p => {
          const selected = selectedValue?.toLowerCase() === p.value.toLowerCase()
          return (
            <button
              key={p.value}
              type="button"
              title={`${p.size} (${p.value})`}
              aria-label={`${p.size}, code ${p.value}`}
              aria-pressed={selected}
              onClick={() => onSelect(p)}
              className={cn(
                'min-w-[2.25rem] rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5',
              )}
            >
              {p.value}
            </button>
          )
        })}
      </div>
    </div>
  )
}
