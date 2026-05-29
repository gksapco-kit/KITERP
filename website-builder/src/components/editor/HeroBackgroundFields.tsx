import type { Block, BlockStyles, HeroBackgroundMode } from '../../types/builder'
import { getHeroBackgroundMode, MAIN_HERO_TYPES } from '../../lib/blockUtils'
import { ImageUploadField } from '../builder/ImageUploadField'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

const modeOptions: { id: HeroBackgroundMode; label: string }[] = [
  { id: 'color', label: 'Solid' },
  { id: 'image', label: 'Photo' },
  { id: 'video', label: 'Video' },
]

import { ANIMATION_OPTIONS } from '../../lib/styleConstants'

interface HeroBackgroundFieldsProps {
  block: Block
  onPropsChange: (props: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<BlockStyles>) => void
  onModeChange: (mode: HeroBackgroundMode) => void
}

export function HeroBackgroundFields({
  block,
  onPropsChange,
  onStylesChange,
  onModeChange,
}: HeroBackgroundFieldsProps) {
  const rawMode = getHeroBackgroundMode(block)
  const mode: HeroBackgroundMode = rawMode === 'gradient' ? 'color' : rawMode
  const s = block.styles
  const p = block.props
  const bgImage = (p.imageUrl || s.backgroundImage)?.trim() || ''
  const isMainHero = MAIN_HERO_TYPES.has(block.type)
  const solidColor =
    s.backgroundColor?.startsWith('#')
      ? s.backgroundColor
      : rawMode === 'gradient'
        ? (s.gradientFrom?.startsWith('#') ? s.gradientFrom : '#4f46e5')
        : '#4f46e5'

  const setSolidColor = (backgroundColor: string) => {
    onStylesChange({ backgroundColor })
    if (rawMode === 'gradient') {
      onPropsChange({ heroBackgroundMode: 'color' })
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Background</p>
      <p className="text-xs text-gray-500">Pick one style — only the selected option shows on the canvas.</p>

      <div className="grid grid-cols-3 gap-1">
        {modeOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onModeChange(opt.id)}
            className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
              mode === opt.id
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {mode === 'color' && (
        <Field label="Background color">
          <div className="flex gap-2">
            <input
              type="color"
              className="h-10 w-10 shrink-0 rounded border"
              value={solidColor}
              onChange={(e) => setSolidColor(e.target.value)}
            />
            <input
              className={inputClass}
              value={s.backgroundColor ?? ''}
              onChange={(e) => setSolidColor(e.target.value)}
              placeholder="#4f46e5"
            />
          </div>
        </Field>
      )}

      {mode === 'image' && (
        <>
          <ImageUploadField
            label="Background photo"
            value={bgImage}
            onChange={(url) => {
              onPropsChange({ imageUrl: url })
              onStylesChange({ backgroundImage: url })
            }}
          />
          <Field label="Overlay darkness">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={p.overlayOpacity ?? 0.5}
              onChange={(e) => onPropsChange({ overlayOpacity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </Field>
        </>
      )}

      {mode === 'video' && (
        <>
          <Field label="Video embed URL">
            <input
              className={inputClass}
              value={p.videoUrl ?? ''}
              onChange={(e) => onPropsChange({ videoUrl: e.target.value })}
              placeholder="https://www.youtube.com/embed/..."
            />
          </Field>
          <p className="text-xs text-gray-500">Use an embed link (e.g. YouTube /embed/…), not a watch page URL.</p>
          <Field label="Overlay darkness">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={p.overlayOpacity ?? 0.45}
              onChange={(e) => onPropsChange({ overlayOpacity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </Field>
        </>
      )}

      {isMainHero && (
        <Field label="Entrance animation">
          <select
            className={inputClass}
            value={s.animation ?? ''}
            onChange={(e) => onStylesChange({ animation: e.target.value })}
          >
            {ANIMATION_OPTIONS.map((opt) => (
              <option key={opt.value || 'none'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
      )}
    </div>
  )
}
