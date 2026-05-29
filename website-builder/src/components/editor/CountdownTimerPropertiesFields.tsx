import type { Block, BlockStyles } from '../../types/builder'
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

interface CountdownTimerPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<BlockStyles>) => void
}

export function CountdownTimerPropertiesFields({ block, onChange, onStylesChange }: CountdownTimerPropertiesFieldsProps) {
  const p = block.props

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Countdown Timer</p>

      <Field label="Section title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Sale ends soon" />
      </Field>

      <Field label="Section subtitle">
        <input className={inputClass} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>

      <Field label="Target date & time" hint="Counts down to this moment in the visitor's local timezone">
        <input
          type="datetime-local"
          className={inputClass}
          value={p.countdownTargetDate ?? ''}
          onChange={(e) => onChange({ countdownTargetDate: e.target.value })}
        />
      </Field>

      <Field label="Layout">
        <select
          className={inputClass}
          value={p.countdownLayout ?? 'cards'}
          onChange={(e) => onChange({ countdownLayout: e.target.value as 'cards' | 'inline' | 'banner' | 'compact' })}
        >
          <option value="cards">Cards grid</option>
          <option value="inline">Inline with separators</option>
          <option value="banner">Full-width banner</option>
          <option value="compact">Compact chips</option>
        </select>
      </Field>

      {p.countdownLayout !== 'banner' && (
        <Field label="Theme">
          <select
            className={inputClass}
            value={p.countdownTheme ?? 'premium'}
            onChange={(e) => onChange({ countdownTheme: e.target.value as 'premium' | 'minimal' | 'dark' })}
          >
            <option value="premium">Premium (gradient numbers)</option>
            <option value="minimal">Minimal</option>
            <option value="dark">Dark glass</option>
          </select>
        </Field>
      )}

      {(p.countdownTheme !== 'minimal' || p.countdownLayout === 'banner') && (
        <ThemeGradientFields
          block={block}
          theme={p.countdownLayout === 'banner' ? 'dark' : (p.countdownTheme ?? 'premium')}
          onStylesChange={onStylesChange}
        />
      )}

      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Show units</p>
      <ToggleField label="Days" checked={p.showCountdownDays !== false} onChange={(v) => onChange({ showCountdownDays: v })} />
      <ToggleField label="Hours" checked={p.showCountdownHours !== false} onChange={(v) => onChange({ showCountdownHours: v })} />
      <ToggleField label="Minutes" checked={p.showCountdownMinutes !== false} onChange={(v) => onChange({ showCountdownMinutes: v })} />
      <ToggleField label="Seconds" checked={p.showCountdownSeconds !== false} onChange={(v) => onChange({ showCountdownSeconds: v })} />

      <Field label="Expired message">
        <input className={inputClass} value={p.countdownExpiredText ?? ''} onChange={(e) => onChange({ countdownExpiredText: e.target.value })} />
      </Field>

      <Field label="CTA button text">
        <input className={inputClass} value={p.buttonText ?? ''} onChange={(e) => onChange({ buttonText: e.target.value })} placeholder="Shop the sale" />
      </Field>

      <Field label="CTA link">
        <input className={inputClass} value={p.buttonLink ?? ''} onChange={(e) => onChange({ buttonLink: e.target.value })} placeholder="#products" />
      </Field>

      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Unit labels</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Days">
          <input className={inputClass} value={p.countdownDayLabel ?? ''} onChange={(e) => onChange({ countdownDayLabel: e.target.value })} />
        </Field>
        <Field label="Hours">
          <input className={inputClass} value={p.countdownHourLabel ?? ''} onChange={(e) => onChange({ countdownHourLabel: e.target.value })} />
        </Field>
        <Field label="Minutes">
          <input className={inputClass} value={p.countdownMinuteLabel ?? ''} onChange={(e) => onChange({ countdownMinuteLabel: e.target.value })} />
        </Field>
        <Field label="Seconds">
          <input className={inputClass} value={p.countdownSecondLabel ?? ''} onChange={(e) => onChange({ countdownSecondLabel: e.target.value })} />
        </Field>
      </div>
    </div>
  )
}
