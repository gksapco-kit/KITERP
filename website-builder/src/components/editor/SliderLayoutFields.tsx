import { DEFAULT_SLIDER_INTERVAL_SECONDS, type SectionDisplayLayout } from '../../lib/sectionSlider'
import { ColumnsInput } from './ColumnsInput'

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

export interface LayoutOption {
  value: SectionDisplayLayout
  label: string
}

interface SliderLayoutFieldsProps {
  layout: SectionDisplayLayout
  layoutOptions: LayoutOption[]
  onLayoutChange: (layout: SectionDisplayLayout) => void
  intervalSeconds?: number
  onIntervalChange: (seconds: number) => void
  columns?: number
  onColumnsChange?: (columns: number) => void
  columnsMin?: number
  columnsMax?: number
  showColumnsWhen?: SectionDisplayLayout[]
  showIntervalWhen?: SectionDisplayLayout[]
}

export function SliderLayoutFields({
  layout,
  layoutOptions,
  onLayoutChange,
  intervalSeconds,
  onIntervalChange,
  columns,
  onColumnsChange,
  columnsMin = 2,
  columnsMax = 6,
  showColumnsWhen = ['grid'],
  showIntervalWhen = ['autoSlider'],
}: SliderLayoutFieldsProps) {
  const showInterval = showIntervalWhen.includes(layout)
  const showCols = onColumnsChange && showColumnsWhen.includes(layout)

  return (
    <>
      <Field label="Layout">
        <select
          className={inputClass}
          value={layout}
          onChange={(e) => onLayoutChange(e.target.value as SectionDisplayLayout)}
        >
          {layoutOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Field>

      {showCols && columns != null && (
        <ColumnsInput value={columns} onChange={onColumnsChange} min={columnsMin} max={columnsMax} />
      )}

      {showInterval && (
        <Field label="Auto slide interval (seconds)">
          <input
            type="number"
            min={2}
            max={30}
            step={1}
            className={inputClass}
            value={intervalSeconds ?? DEFAULT_SLIDER_INTERVAL_SECONDS}
            onChange={(e) => onIntervalChange(Number(e.target.value))}
          />
          <p className="mt-1 text-[11px] text-gray-400">
            Time between automatic slides. Hover to pause.
          </p>
        </Field>
      )}
    </>
  )
}
