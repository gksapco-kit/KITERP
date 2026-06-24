import { Check } from 'lucide-react'
import { ModalBody, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import {
  WEBSITE_COLOR_PALETTES,
  type WebsiteColorPalette,
  type WebsitePaletteColors,
} from '@/lib/websiteColorPalettes'

type WebsiteColorPalettePickerModalProps = {
  open: boolean
  onClose: () => void
  selectedId?: string | null
  onSelect: (palette: WebsiteColorPalette) => void
}

export function WebsiteColorPalettePickerModal({
  open,
  onClose,
  selectedId,
  onSelect,
}: WebsiteColorPalettePickerModalProps) {
  if (!open) return null

  const handleSelect = (palette: WebsiteColorPalette) => {
    onSelect(palette)
    onClose()
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalPanel className="max-w-2xl bg-card text-card-foreground">
        <div className="border-b border-border px-5 py-4">
          <ModalHeader
            title="Choose color palette"
            subtitle={
              <p className="mt-1 text-sm text-muted-foreground">
                Pick a preset for your site. You can fine-tune individual colors after applying.
              </p>
            }
            onClose={onClose}
          />
        </div>
        <ModalBody className="max-h-[min(70vh,32rem)] overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {WEBSITE_COLOR_PALETTES.map(palette => {
              const selected = selectedId === palette.id
              return (
                <PaletteCard
                  key={palette.id}
                  label={palette.label}
                  description={palette.description}
                  colors={palette.colors}
                  selected={selected}
                  onClick={() => handleSelect(palette)}
                />
              )
            })}
          </div>
        </ModalBody>
      </ModalPanel>
    </ModalOverlay>
  )
}

function PaletteCard({
  label,
  description,
  colors,
  selected,
  onClick,
}: {
  label: string
  description: string
  colors: WebsitePaletteColors
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`Apply ${label} palette`}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
        selected
          ? 'border-primary shadow-sm shadow-primary/10 ring-1 ring-primary/20'
          : 'border-border bg-card hover:border-primary/40 hover:shadow-sm',
      )}
    >
      <div className="flex h-14 items-stretch border-b border-border/80" aria-hidden>
        <span className="flex-[2]" style={{ backgroundColor: colors.primary_color }} />
        <span className="flex-1" style={{ backgroundColor: colors.accent_color }} />
        <span
          className="flex-1 border-l border-border/60"
          style={{ backgroundColor: colors.bg_color }}
        />
      </div>
      <div className="px-3 py-2.5">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {description}
        </p>
      </div>
      {selected && (
        <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Check className="h-3 w-3 stroke-[3]" aria-hidden />
        </span>
      )}
    </button>
  )
}
