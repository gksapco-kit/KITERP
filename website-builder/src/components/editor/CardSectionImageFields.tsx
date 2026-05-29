import {
  CARD_IMAGE_HEIGHT_PRESETS,
  DEFAULT_CARD_IMAGE_HEIGHT,
  resolveCardImageHeight,
} from '../../lib/cardSectionLayout'
import type { Block } from '../../types/builder'

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

interface CardSectionImageFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function CardSectionImageFields({ block, onChange }: CardSectionImageFieldsProps) {
  const p = block.props
  const height = resolveCardImageHeight(p)
  const presetMatch = CARD_IMAGE_HEIGHT_PRESETS.find((opt) => opt.value === height)

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Card images</p>
      <Field label="Image height (all cards)" hint="Applies the same height to every card image in this section.">
        <select
          className={inputClass}
          value={presetMatch?.value ?? 'custom'}
          onChange={(e) => {
            const v = e.target.value
            if (v !== 'custom') onChange({ cardImageHeight: v })
          }}
        >
          {CARD_IMAGE_HEIGHT_PRESETS.map((opt) => (
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
            value={p.cardImageHeight ?? ''}
            onChange={(e) => onChange({ cardImageHeight: e.target.value || undefined })}
            placeholder={DEFAULT_CARD_IMAGE_HEIGHT}
          />
          {p.cardImageHeight && (
            <button
              type="button"
              className="shrink-0 rounded-lg border border-gray-200 px-2 text-xs text-gray-500 hover:bg-gray-50"
              onClick={() => onChange({ cardImageHeight: undefined })}
            >
              Reset
            </button>
          )}
        </div>
      </Field>
    </div>
  )
}
