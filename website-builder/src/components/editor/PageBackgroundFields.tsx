import type { Page, PageBackgroundMode } from '../../types/builder'
import { pageBackgroundModePatch, resolvePageBackground } from '../../lib/pageBackground'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}

function ToggleField({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <div>
        <span className="text-sm text-gray-700">{label}</span>
        {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

function ColorInput({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string
  value?: string
  fallback: string
  onChange: (hex: string) => void
}) {
  const hex = value?.startsWith('#') ? value : fallback
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input type="color" className="h-10 w-10 shrink-0 cursor-pointer rounded border border-gray-200" value={hex} onChange={(e) => onChange(e.target.value)} />
        <input className={inputClass} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={fallback} />
      </div>
    </Field>
  )
}

interface PageBackgroundFieldsProps {
  page: Page
  darkMode: boolean
  onBackgroundChange: (background: Page['background']) => void
  onDarkModeChange: (darkMode: boolean) => void
}

export function PageBackgroundFields({ page, darkMode, onBackgroundChange, onDarkModeChange }: PageBackgroundFieldsProps) {
  const bg = resolvePageBackground(page)

  const setMode = (mode: PageBackgroundMode) => {
    onBackgroundChange(pageBackgroundModePatch(mode, bg))
  }

  const patchBg = (patch: Partial<typeof bg>) => {
    onBackgroundChange({ ...bg, ...patch })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Page background</p>
        <p className="text-xs text-gray-500">Applies to the current page in the editor and on the live site.</p>

        <Field label="Background type">
          <select className={inputClass} value={bg.mode} onChange={(e) => setMode(e.target.value as PageBackgroundMode)}>
            <option value="solid">Solid color</option>
            <option value="gradient">Gradient</option>
          </select>
        </Field>

        {bg.mode === 'solid' ? (
          <ColorInput
            label="Background color"
            value={bg.backgroundColor}
            fallback="#ffffff"
            onChange={(backgroundColor) => patchBg(pageBackgroundModePatch('solid', { ...bg, backgroundColor }))}
          />
        ) : (
          <>
            <ColorInput
              label="Gradient start"
              value={bg.gradientFrom}
              fallback="#4f46e5"
              onChange={(gradientFrom) => patchBg(pageBackgroundModePatch('gradient', { ...bg, gradientFrom }))}
            />
            <ColorInput
              label="Gradient end"
              value={bg.gradientTo}
              fallback="#ec4899"
              onChange={(gradientTo) => patchBg(pageBackgroundModePatch('gradient', { ...bg, gradientTo }))}
            />
            <div
              className="h-14 rounded-lg border border-gray-200 shadow-inner"
              style={{
                backgroundImage: `linear-gradient(135deg, ${bg.gradientFrom ?? '#4f46e5'} 0%, ${bg.gradientTo ?? '#ec4899'} 100%)`,
              }}
              aria-hidden
            />
          </>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Appearance</p>
        <ToggleField
          label="Dark mode"
          hint="Preview and publish this page with dark styling for blocks."
          checked={darkMode}
          onChange={onDarkModeChange}
        />
      </div>
    </div>
  )
}
