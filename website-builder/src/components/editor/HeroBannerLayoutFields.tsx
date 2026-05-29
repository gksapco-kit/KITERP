import {
  DEFAULT_HERO_SECTION_HEIGHT,
  HERO_SECTION_HEIGHT_PRESETS,
  resolveBlockSectionHeight,
  type SectionContentAlign,
} from '../../lib/heroSectionLayout'
import type { Block, BlockStyles } from '../../types/builder'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

const alignOptions: { label: string; value: SectionContentAlign }[] = [
  { label: 'Start', value: 'start' },
  { label: 'Center', value: 'center' },
  { label: 'End', value: 'end' },
]

interface HeroBannerLayoutFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
  onStylesChange?: (styles: Partial<BlockStyles>) => void
  showImageHeight?: boolean
}

export function HeroBannerLayoutFields({
  block,
  onChange,
  onStylesChange,
  showImageHeight = true,
}: HeroBannerLayoutFieldsProps) {
  const p = block.props
  const height = resolveBlockSectionHeight(block)
  const presetMatch = HERO_SECTION_HEIGHT_PRESETS.find((opt) => opt.value === height)

  const applyHeight = (value: string | undefined) => {
    onChange({ heroSectionHeight: value })
    onStylesChange?.({ height: value })
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Layout</p>
      <p className="text-[11px] text-gray-500">Full-width section. Adjust background/slide height and where text sits inside.</p>

      {showImageHeight && (
        <>
          <Field label="Section / image height" hint="Minimum height for the hero, banner, or image area.">
            <select
              className={inputClass}
              value={presetMatch?.value ?? 'custom'}
              onChange={(e) => {
                const v = e.target.value
                if (v !== 'custom') applyHeight(v)
              }}
            >
              {HERO_SECTION_HEIGHT_PRESETS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              <option value="custom">Custom…</option>
            </select>
          </Field>
          <Field label="Custom height">
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={block.styles.height?.trim() || p.heroSectionHeight || ''}
                onChange={(e) => applyHeight(e.target.value || undefined)}
                placeholder={DEFAULT_HERO_SECTION_HEIGHT}
              />
              {(p.heroSectionHeight || block.styles.height) && (
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-gray-200 px-2 text-xs text-gray-500 hover:bg-gray-50"
                  onClick={() => applyHeight(undefined)}
                >
                  Reset
                </button>
              )}
            </div>
          </Field>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Content horizontal">
          <select
            className={inputClass}
            value={p.heroContentAlignX ?? ''}
            onChange={(e) =>
              onChange({
                heroContentAlignX: (e.target.value || undefined) as SectionContentAlign | undefined,
              })
            }
          >
            <option value="">Default (from style)</option>
            {alignOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Content vertical">
          <select
            className={inputClass}
            value={p.heroContentAlignY ?? 'center'}
            onChange={(e) => onChange({ heroContentAlignY: e.target.value as SectionContentAlign })}
          >
            {alignOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  )
}
