import { useEffect, useMemo, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { BUILDER_FONT_FAMILIES, ensureBuilderFontLoaded } from '@storefront/lib/builderFontFamilies'
import type { StyleConfig } from '@/types/websites'
import { builderPanelUi } from '@/components/websites/builderPanelUi'
import { PaletteHueSuggestBar } from '@/components/websites/PaletteHueSuggestBar'
import { BuilderColorField } from '@/components/websites/BuilderColorField'
import { BuilderStepSlider } from '@/components/websites/BuilderStepSlider'
import { matchWebsiteColorPaletteId } from '@/lib/websiteColorPalettes'

const FONTS = [...BUILDER_FONT_FAMILIES]

const COLOR_FIELDS = [
  { key: 'primary_color', label: 'Primary' },
  { key: 'secondary_color', label: 'Secondary' },
  { key: 'accent_color', label: 'Accent' },
  { key: 'bg_color', label: 'Background' },
  { key: 'surface_color', label: 'Surface' },
  { key: 'text_color', label: 'Text' },
] as const

function StyleSection({
  title,
  children,
  titleClassName,
}: {
  title: string
  children: ReactNode
  titleClassName?: string
}) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center gap-2">
        <h3 className={cn(builderPanelUi.eyebrow, 'shrink-0 text-foreground/70', titleClassName)}>{title}</h3>
        <div className="h-px min-w-0 flex-1 bg-neutral-300" aria-hidden />
      </div>
      {children}
    </section>
  )
}

const fieldLabelClass = 'mb-1 block text-[10px] font-semibold leading-none text-neutral-700'
const fieldControlClass =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-[11px] font-medium text-neutral-900 shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30'

export function BuilderStylePanel({
  style,
  onChange,
}: {
  style: StyleConfig
  onChange: (s: Partial<StyleConfig>) => void
}) {
  const activePaletteId = useMemo(() => matchWebsiteColorPaletteId(style), [style])

  useEffect(() => {
    ensureBuilderFontLoaded(style.font_heading)
    ensureBuilderFontLoaded(style.font_body)
  }, [style.font_heading, style.font_body])

  const handleFontChange = (key: 'font_heading' | 'font_body', value: string) => {
    ensureBuilderFontLoaded(value)
    onChange({ [key]: value })
  }

  return (
    <div
      className={cn(builderPanelUi.panelScroll, 'h-full flex flex-col gap-2.5 p-2')}
      title="Site-wide defaults. Per-page in Page Edit; per-section in Section Edit → Design."
    >
      <StyleSection title="Website Color Palette" titleClassName="normal-case tracking-normal">
        <PaletteHueSuggestBar
          compact
          stylePrimary={style.primary_color}
          activePaletteId={activePaletteId}
          onSelectPalette={colors => onChange(colors)}
        />
      </StyleSection>

      <StyleSection title="Colors">
        <div className="grid grid-cols-2 gap-1">
          {COLOR_FIELDS.map(({ key, label }) => {
            const hex = ((style as Record<string, string>)[key] || '#000000').toLowerCase()
            return (
              <BuilderColorField
                key={key}
                label={label}
                value={hex}
                onChange={next => onChange({ [key]: next } as Partial<StyleConfig>)}
              />
            )
          })}
        </div>
      </StyleSection>

      <StyleSection title="Type & shape">
        <div className="space-y-2 rounded-lg border border-neutral-300 bg-white/80 p-2">
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'font_heading', label: 'Heading' },
              { key: 'font_body', label: 'Body' },
            ] as const).map(({ key, label }) => (
              <label key={key} className="min-w-0">
                <span className={fieldLabelClass}>{label}</span>
                <select
                  value={(style as Record<string, string>)[key]}
                  onChange={e => handleFontChange(key, e.target.value)}
                  className={fieldControlClass}
                  style={{ fontFamily: (style as Record<string, string>)[key] }}
                >
                  {FONTS.map(f => (
                    <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {([
            { key: 'font_size_base' as const, label: 'Body size', min: 12, max: 22, fallback: 16 },
            { key: 'font_size_heading' as const, label: 'Head size', min: 24, max: 56, fallback: 40 },
          ]).map(({ key, label, min, max, fallback }) => {
            const val = (style[key] as number | undefined) ?? fallback
            return (
              <div key={key} className="space-y-1">
                <span className={fieldLabelClass}>{label}</span>
                <BuilderStepSlider
                  aria-label={label}
                  value={val}
                  min={min}
                  max={max}
                  step={1}
                  onChange={next => onChange({ [key]: next })}
                  sliderClassName="h-2"
                />
              </div>
            )
          })}

          <div className="space-y-1 pt-0.5">
            <span className={fieldLabelClass}>Corners</span>
            <div className="grid grid-cols-3 gap-1.5">
              {(['sharp', 'rounded', 'pill'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange({ border_radius: v })}
                  className={cn(
                    'rounded-md border py-1.5 text-[11px] font-semibold shadow-sm transition-colors',
                    style.border_radius === v
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50',
                  )}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </StyleSection>
    </div>
  )
}
