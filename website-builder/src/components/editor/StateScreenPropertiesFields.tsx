import { isStateScreenType, STATE_SCREEN_PALETTE } from '../../lib/stateScreenConfig'
import type { Block, BlockStyles } from '../../types/builder'
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

interface StateScreenPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<BlockStyles>) => void
}

export function StateScreenPropertiesFields({ block, onChange, onStylesChange }: StateScreenPropertiesFieldsProps) {
  const { type, props: p } = block
  if (!isStateScreenType(type)) return null

  const label = STATE_SCREEN_PALETTE[type].label
  const showCode = type === 'notFoundPage'
  const showMeta = type === 'maintenanceScreen' || type === 'comingSoon'

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>

      {showCode && (
        <Field label="Error code">
          <input className={inputClass} value={p.stateCode ?? '404'} onChange={(e) => onChange({ stateCode: e.target.value })} placeholder="404" />
        </Field>
      )}

      <Field label="Title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>

      <Field label="Message">
        <textarea className={inputClass} rows={3} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>

      {showMeta && (
        <Field label={type === 'maintenanceScreen' ? 'Return / ETA note' : 'Launch date note'}>
          <input className={inputClass} value={p.stateMeta ?? ''} onChange={(e) => onChange({ stateMeta: e.target.value })} />
        </Field>
      )}

      <Field label="Layout">
        <select
          className={inputClass}
          value={p.stateScreenLayout ?? 'centered'}
          onChange={(e) => onChange({ stateScreenLayout: e.target.value as 'centered' | 'card' | 'split' })}
        >
          <option value="centered">Centered</option>
          <option value="card">Card</option>
          <option value="split">Split with illustration</option>
        </select>
      </Field>

      <Field label="Theme">
        <select
          className={inputClass}
          value={p.stateScreenTheme ?? 'light'}
          onChange={(e) => onChange({ stateScreenTheme: e.target.value as 'light' | 'dark' | 'brand' })}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="brand">Custom gradient</option>
        </select>
      </Field>

      <ThemeGradientFields block={block} theme={p.stateScreenTheme} onStylesChange={onStylesChange} showForThemes={['brand', 'dark']} />

      <ToggleField label="Show icon" checked={p.showStateIcon !== false} onChange={(v) => onChange({ showStateIcon: v })} />

      <ImageUploadField label="Illustration (optional)" value={p.imageUrl} onChange={(url) => onChange({ imageUrl: url })} />

      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Actions</p>

      <Field label="Primary button">
        <input className={inputClass} value={p.buttonText ?? ''} onChange={(e) => onChange({ buttonText: e.target.value })} placeholder="Continue" />
      </Field>
      <Field label="Primary link">
        <input className={inputClass} value={p.buttonLink ?? ''} onChange={(e) => onChange({ buttonLink: e.target.value })} placeholder="/ or #page" />
      </Field>

      <Field label="Secondary button (optional)">
        <input className={inputClass} value={p.buttonText2 ?? ''} onChange={(e) => onChange({ buttonText2: e.target.value })} />
      </Field>
      <Field label="Secondary link">
        <input className={inputClass} value={p.buttonLink2 ?? ''} onChange={(e) => onChange({ buttonLink2: e.target.value })} />
      </Field>
    </div>
  )
}
