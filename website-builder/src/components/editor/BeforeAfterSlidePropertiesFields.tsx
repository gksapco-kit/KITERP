import type { Block, BlockStyles } from '../../types/builder'
import { BEFORE_AFTER_DEFAULTS, clampBeforeAfterPosition } from '../../lib/beforeAfterSlideDefaults'
import { ImageUploadField } from '../builder/ImageUploadField'
import { ThemeGradientFields } from './ThemeGradientFields'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </label>
  )
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

interface BeforeAfterSlidePropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<BlockStyles>) => void
}

export function BeforeAfterSlidePropertiesFields({
  block,
  onChange,
  onStylesChange,
}: BeforeAfterSlidePropertiesFieldsProps) {
  const p = block.props
  const s = block.styles
  const position = p.beforeAfterPosition ?? BEFORE_AFTER_DEFAULTS.beforeAfterPosition

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Before / After Slide</p>

      <Field label="Section title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="See the transformation" />
      </Field>

      <Field label="Section subtitle">
        <input className={inputClass} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>

      <ImageUploadField
        label="Before image"
        value={p.beforeImageUrl ?? ''}
        onChange={(beforeImageUrl) => onChange({ beforeImageUrl })}
      />

      <Field label="Before alt text">
        <input className={inputClass} value={p.beforeImageAlt ?? ''} onChange={(e) => onChange({ beforeImageAlt: e.target.value })} />
      </Field>

      <ImageUploadField
        label="After image"
        value={p.afterImageUrl ?? ''}
        onChange={(afterImageUrl) => onChange({ afterImageUrl })}
      />

      <Field label="After alt text">
        <input className={inputClass} value={p.afterImageAlt ?? ''} onChange={(e) => onChange({ afterImageAlt: e.target.value })} />
      </Field>

      <Field label="Design theme">
        <select
          className={inputClass}
          value={p.beforeAfterTheme ?? 'premium'}
          onChange={(e) => onChange({ beforeAfterTheme: e.target.value as 'premium' | 'minimal' | 'bold' })}
        >
          <option value="premium">Premium (gradient frame)</option>
          <option value="minimal">Minimal (clean)</option>
          <option value="bold">Bold (high contrast)</option>
        </select>
      </Field>

      <ThemeGradientFields block={block} theme={p.beforeAfterTheme} onStylesChange={onStylesChange} showForThemes={['premium', 'bold']} />

      <Field label="Orientation">
        <select
          className={inputClass}
          value={p.beforeAfterOrientation ?? 'horizontal'}
          onChange={(e) => onChange({ beforeAfterOrientation: e.target.value as 'horizontal' | 'vertical' })}
        >
          <option value="horizontal">Horizontal (left / right)</option>
          <option value="vertical">Vertical (top / bottom)</option>
        </select>
      </Field>

      <Field label="Aspect ratio">
        <select
          className={inputClass}
          value={p.beforeAfterAspect ?? '16/9'}
          onChange={(e) => onChange({ beforeAfterAspect: e.target.value as '16/9' | '4/3' | '1/1' | '3/4' })}
        >
          <option value="16/9">16:9 widescreen</option>
          <option value="4/3">4:3 standard</option>
          <option value="1/1">1:1 square</option>
          <option value="3/4">3:4 portrait</option>
        </select>
      </Field>

      <Field label={`Starting position (${Math.round(position)}%)`}>
        <input
          type="range"
          min={5}
          max={95}
          value={position}
          onChange={(e) => onChange({ beforeAfterPosition: clampBeforeAfterPosition(Number(e.target.value)) })}
          className="w-full"
        />
      </Field>

      <Field label="Handle style">
        <select
          className={inputClass}
          value={p.beforeAfterHandleStyle ?? 'circle'}
          onChange={(e) => onChange({ beforeAfterHandleStyle: e.target.value as 'bar' | 'circle' | 'pill' })}
        >
          <option value="circle">Circle grip</option>
          <option value="pill">Pill with arrows</option>
          <option value="bar">Minimal bar</option>
        </select>
      </Field>

      <ToggleField label="Show labels" checked={p.showBeforeAfterLabels !== false} onChange={(v) => onChange({ showBeforeAfterLabels: v })} />

      {p.showBeforeAfterLabels !== false && (
        <>
          <Field label="Before label">
            <input className={inputClass} value={p.beforeLabel ?? ''} onChange={(e) => onChange({ beforeLabel: e.target.value })} />
          </Field>
          <Field label="After label">
            <input className={inputClass} value={p.afterLabel ?? ''} onChange={(e) => onChange({ afterLabel: e.target.value })} />
          </Field>
        </>
      )}

      <Field label="Corner radius">
        <input
          className={inputClass}
          value={s.borderRadius ?? ''}
          onChange={(e) => onStylesChange({ borderRadius: e.target.value || undefined })}
          placeholder="16px"
        />
      </Field>
    </div>
  )
}
