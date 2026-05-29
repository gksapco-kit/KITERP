import type { BlockStyles } from '../../types/builder'

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

interface BlockBackgroundFieldsProps {
  styles: BlockStyles
  onChange: (patch: Partial<BlockStyles>) => void
}

export function BlockBackgroundFields({ styles, onChange }: BlockBackgroundFieldsProps) {
  const color =
    styles.backgroundColor?.startsWith('#')
      ? styles.backgroundColor
      : styles.backgroundMode === 'gradient'
        ? (styles.gradientFrom?.startsWith('#') ? styles.gradientFrom : '#ffffff')
        : '#ffffff'

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Background</p>
      <Field label="Background color">
        <div className="flex gap-2">
          <input
            type="color"
            className="h-10 w-10 shrink-0 rounded border"
            value={color}
            onChange={(e) =>
              onChange({
                backgroundMode: 'solid',
                backgroundColor: e.target.value,
              })
            }
          />
          <input
            className={inputClass}
            value={styles.backgroundColor ?? ''}
            onChange={(e) =>
              onChange({
                backgroundMode: 'solid',
                backgroundColor: e.target.value,
              })
            }
            placeholder="#ffffff"
          />
        </div>
      </Field>
    </div>
  )
}
