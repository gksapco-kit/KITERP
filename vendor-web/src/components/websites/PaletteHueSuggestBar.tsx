import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HuePreviewPicker } from '@/components/websites/BuilderColorField'
import { BuilderStepButton } from '@/components/websites/BuilderStepSlider'
import {
  barRatioFromHue,
  getDefaultPaletteHue,
  HUE_SPECTRUM_GRADIENT,
  hslToHex,
  hueFromBarRatio,
  hueFromHex,
  sortPalettesByHue,
} from '@/lib/paletteHueMatch'
import {
  WEBSITE_COLOR_PALETTES,
  type WebsiteColorPalette,
  type WebsitePaletteColors,
} from '@/lib/websiteColorPalettes'

type PaletteHueSuggestBarProps = {
  stylePrimary?: string
  activePaletteId?: string | null
  onSelectPalette: (colors: WebsitePaletteColors) => void
  compact?: boolean
}

export function PaletteHueSuggestBar({
  stylePrimary,
  activePaletteId,
  onSelectPalette,
  compact = false,
}: PaletteHueSuggestBarProps) {
  const spectrumRef = useRef<HTMLDivElement>(null)
  const [hue, setHue] = useState(() => getDefaultPaletteHue(stylePrimary))
  const [previewHex, setPreviewHex] = useState(() =>
    hslToHex(getDefaultPaletteHue(stylePrimary), 72, 48),
  )
  const [isInteracting, setIsInteracting] = useState(false)

  useEffect(() => {
    if (!isInteracting) {
      const nextHue = getDefaultPaletteHue(stylePrimary)
      setHue(nextHue)
      setPreviewHex(hslToHex(nextHue, 72, 48))
    }
  }, [stylePrimary, isInteracting])

  const updateHueFromClientX = useCallback((clientX: number) => {
    const el = spectrumRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return
    const ratio = (clientX - rect.left) / rect.width
    const nextHue = hueFromBarRatio(ratio)
    setHue(nextHue)
    setPreviewHex(hslToHex(nextHue, 72, 48))
  }, [])

  const handlePreviewColorChange = useCallback((hex: string) => {
    setIsInteracting(true)
    setPreviewHex(hex)
    setHue(hueFromHex(hex))
  }, [])

  const suggestedIds = useMemo(() => {
    return new Set(sortPalettesByHue(WEBSITE_COLOR_PALETTES, hue).slice(0, 3).map(p => p.id))
  }, [hue])
  const thumbLeft = `${barRatioFromHue(hue) * 100}%`

  const handleSpectrumClick = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsInteracting(true)
    updateHueFromClientX(e.clientX)
  }

  const stepHue = useCallback((delta: number) => {
    setIsInteracting(true)
    setHue(prev => {
      const nextHue = (prev + delta + 360) % 360
      setPreviewHex(hslToHex(nextHue, 72, 48))
      return nextHue
    })
  }, [])

  return (
    <div className={cn('space-y-2', compact ? 'p-0' : 'p-0.5')}>
      <div className="flex items-center gap-1.5">
        <HuePreviewPicker
          compact={compact}
          color={previewHex}
          onChange={handlePreviewColorChange}
        />
        <BuilderStepButton
          direction="decrease"
          aria-label="Hue down"
          onStep={() => stepHue(-8)}
        />
        <div
          ref={spectrumRef}
          role="slider"
          aria-label="Pick a hue to suggest matching palettes"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(hue)}
          tabIndex={0}
          className={cn(
            'relative min-w-0 flex-1 cursor-pointer rounded-full border border-neutral-300 bg-white',
            compact ? 'h-2.5' : 'h-3',
          )}
          style={{ background: HUE_SPECTRUM_GRADIENT }}
          onClick={handleSpectrumClick}
          onKeyDown={e => {
            const step = e.shiftKey ? 15 : 5
            if (e.key === 'ArrowLeft') {
              e.preventDefault()
              const nextHue = (hue - step + 360) % 360
              setIsInteracting(true)
              setHue(nextHue)
              setPreviewHex(hslToHex(nextHue, 72, 48))
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              const nextHue = (hue + step) % 360
              setIsInteracting(true)
              setHue(nextHue)
              setPreviewHex(hslToHex(nextHue, 72, 48))
            }
          }}
        >
          <span
            className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
            style={{ left: thumbLeft, backgroundColor: previewHex, boxShadow: '0 0 0 1px rgba(0,0,0,0.35)' }}
            aria-hidden
          />
        </div>
        <BuilderStepButton
          direction="increase"
          aria-label="Hue up"
          onStep={() => stepHue(8)}
        />
      </div>

      <div className="grid grid-cols-4 gap-1">
        {WEBSITE_COLOR_PALETTES.map(palette => (
          <PalettePill
            key={palette.id}
            palette={palette}
            selected={activePaletteId === palette.id}
            suggested={suggestedIds.has(palette.id)}
            onSelect={() => onSelectPalette(palette.colors)}
          />
        ))}
      </div>
    </div>
  )
}

function PalettePill({
  palette,
  selected,
  suggested,
  onSelect,
}: {
  palette: WebsiteColorPalette
  selected: boolean
  suggested: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      title={palette.label}
      onClick={onSelect}
      aria-label={palette.label}
      aria-pressed={selected}
      className={cn(
        'group relative box-border w-full rounded-full p-[2px] transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        selected
          ? 'bg-primary'
          : suggested
            ? 'bg-primary/40'
            : 'bg-neutral-200 hover:bg-neutral-300',
      )}
    >
      <span
        className="flex h-5 w-full overflow-hidden rounded-full border border-neutral-400/80"
        aria-hidden
      >
        <span
          className="flex-[2] [box-shadow:inset_-1px_0_0_rgba(0,0,0,0.18)]"
          style={{ backgroundColor: palette.colors.primary_color }}
        />
        <span
          className="flex-1 [box-shadow:inset_-1px_0_0_rgba(0,0,0,0.18)]"
          style={{ backgroundColor: palette.colors.accent_color }}
        />
        <span
          className="flex-1"
          style={{ backgroundColor: palette.colors.bg_color }}
        />
      </span>

      {selected && (
        <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full border border-white bg-primary text-white shadow-sm">
          <Check className="h-2 w-2 stroke-[3]" aria-hidden />
        </span>
      )}

      <span
        className={cn(
          'pointer-events-none absolute -top-6 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap',
          'rounded bg-neutral-900 px-1.5 py-0.5 text-[9px] font-medium text-white',
          'opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',
        )}
      >
        {palette.label}
      </span>
    </button>
  )
}
