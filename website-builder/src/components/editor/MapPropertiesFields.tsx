import type { Block } from '../../types/builder'

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

interface MapPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function MapPropertiesFields({ block, onChange }: MapPropertiesFieldsProps) {
  const p = block.props

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Map</p>

      <Field label="Section title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Find Us" />
      </Field>

      <Field label="Subtitle">
        <textarea className={inputClass} rows={2} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>

      <Field label="Map embed URL">
        <input
          className={inputClass}
          value={p.mapEmbedUrl ?? ''}
          onChange={(e) => onChange({ mapEmbedUrl: e.target.value })}
          placeholder="Paste Google Maps embed src URL"
        />
      </Field>
      <p className="-mt-2 text-xs text-gray-500">
        Google Maps → Share → Embed a map → copy the iframe src URL.
      </p>

      <Field label="Or search by address (if no embed URL)">
        <textarea
          className={inputClass}
          rows={2}
          value={p.location ?? ''}
          onChange={(e) => onChange({ location: e.target.value })}
          placeholder="123 Main St, City, State ZIP"
        />
      </Field>

      <Field label="Map height">
        <input
          className={inputClass}
          value={p.mapHeight ?? '400px'}
          onChange={(e) => onChange({ mapHeight: e.target.value })}
          placeholder="400px"
        />
      </Field>
    </div>
  )
}
