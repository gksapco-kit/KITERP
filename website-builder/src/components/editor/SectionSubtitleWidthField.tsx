import type { BlockStyles } from '../../types/builder'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-gray-600">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

interface SectionSubtitleWidthFieldProps {
  styles: BlockStyles
  onChange: (patch: Partial<BlockStyles>) => void
}

export function SectionSubtitleWidthField({ styles, onChange }: SectionSubtitleWidthFieldProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <Field
        label="Section subtitle width"
        hint="Limits how wide the subtitle line can grow. Leave empty for full width."
      >
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={styles.subtitleWidth ?? ''}
            onChange={(e) => onChange({ subtitleWidth: e.target.value || undefined })}
            placeholder="e.g. 600px, 40rem, 80%"
          />
          {styles.subtitleWidth && (
            <button
              type="button"
              className="shrink-0 rounded-lg border border-gray-200 px-2 text-xs text-gray-500 hover:bg-gray-50"
              onClick={() => onChange({ subtitleWidth: undefined })}
            >
              Clear
            </button>
          )}
        </div>
      </Field>
    </div>
  )
}
