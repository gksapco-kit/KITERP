import { clampColumns } from '../../lib/blockUtils'

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

interface ColumnsInputProps {
  label?: string
  value: number
  onChange: (columns: number) => void
  min?: number
  max?: number
}

export function ColumnsInput({ label = 'Columns', value, onChange, min = 2, max = 6 }: ColumnsInputProps) {
  const clamped = clampColumns(value, min, max)

  return (
    <Field label={label}>
      <input
        type="number"
        min={min}
        max={max}
        step={1}
        className={inputClass}
        value={clamped}
        onChange={(e) => onChange(clampColumns(Number(e.target.value), min, max))}
      />
      <p className="mt-1 text-[11px] text-gray-400">
        Min {min}, max {max} columns per row
      </p>
    </Field>
  )
}
