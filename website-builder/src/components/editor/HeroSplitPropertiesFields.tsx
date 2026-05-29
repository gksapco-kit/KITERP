import type { Block } from '../../types/builder'
import { ImageUploadField } from '../builder/ImageUploadField'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

interface HeroSplitPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function HeroSplitPropertiesFields({ block, onChange }: HeroSplitPropertiesFieldsProps) {
  const p = block.props
  const imageSide = p.splitImageSide ?? 'right'

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Image &amp; Text</p>

      <Field label="Image position">
        <select
          className={inputClass}
          value={imageSide}
          onChange={(e) => onChange({ splitImageSide: e.target.value as 'left' | 'right' })}
        >
          <option value="left">Image on left, text on right</option>
          <option value="right">Image on right, text on left</option>
        </select>
      </Field>

      <ImageUploadField label="Side image" value={p.imageUrl} onChange={(url) => onChange({ imageUrl: url })} />

      <Field label="Heading">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>

      <Field label="Subtitle">
        <textarea className={inputClass} rows={3} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>

      <Field label="Button text">
        <input className={inputClass} value={p.buttonText ?? ''} onChange={(e) => onChange({ buttonText: e.target.value })} />
      </Field>

      <Field label="Button link">
        <input
          className={inputClass}
          value={p.buttonLink ?? ''}
          onChange={(e) => onChange({ buttonLink: e.target.value })}
          placeholder="#products, #contact"
        />
      </Field>
    </div>
  )
}
