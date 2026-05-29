import { useState } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import {
  createProfileStat,
  defaultProfileStats,
} from '../../lib/userProfileCardDefaults'
import type { Block, BlockStyles, ProfileStatItem } from '../../types/builder'
import { ImageUploadField } from '../builder/ImageUploadField'
import { ThemeGradientFields } from './ThemeGradientFields'

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded" />
    </label>
  )
}

export function UserProfileCardPropertiesFields({
  block,
  onChange,
  onStylesChange,
}: {
  block: Block
  onChange: (p: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<BlockStyles>) => void
}) {
  const p = block.props
  const theme = p.userProfileTheme ?? 'light'
  const stats = p.profileStats ?? defaultProfileStats()
  const [expanded, setExpanded] = useState<number | null>(null)
  const updateStats = (next: ProfileStatItem[]) => onChange({ profileStats: next })

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">User profile card</p>

      <Field label="Display name">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
      <Field label="Username">
        <input className={inputClass} value={p.profileUsername ?? ''} onChange={(e) => onChange({ profileUsername: e.target.value })} placeholder="@username" />
      </Field>
      <Field label="Role / title">
        <input className={inputClass} value={p.profileRole ?? ''} onChange={(e) => onChange({ profileRole: e.target.value })} />
      </Field>
      <Field label="Bio">
        <textarea className={inputClass} rows={3} value={p.profileBio ?? ''} onChange={(e) => onChange({ profileBio: e.target.value })} />
      </Field>
      <Field label="Location">
        <input className={inputClass} value={p.profileLocation ?? ''} onChange={(e) => onChange({ profileLocation: e.target.value })} />
      </Field>
      <Field label="Badge label">
        <input className={inputClass} value={p.profileBadge ?? ''} onChange={(e) => onChange({ profileBadge: e.target.value })} placeholder="Verified" />
      </Field>
      <ImageUploadField label="Avatar" value={p.imageUrl} onChange={(url) => onChange({ imageUrl: url })} />

      <Field label="Layout">
        <select
          className={inputClass}
          value={p.userProfileLayout ?? 'centered'}
          onChange={(e) => onChange({ userProfileLayout: e.target.value as 'centered' | 'horizontal' | 'compact' })}
        >
          <option value="centered">Centered</option>
          <option value="horizontal">Horizontal</option>
          <option value="compact">Compact</option>
        </select>
      </Field>
      <Field label="Theme">
        <select
          className={inputClass}
          value={theme}
          onChange={(e) => onChange({ userProfileTheme: e.target.value as 'light' | 'premium' | 'dark' })}
        >
          <option value="light">Light</option>
          <option value="premium">Custom gradient</option>
          <option value="dark">Dark</option>
        </select>
      </Field>

      {(theme === 'premium' || theme === 'dark') && (
        <ThemeGradientFields block={block} theme={theme} onStylesChange={onStylesChange} showForThemes={['premium', 'dark']} />
      )}

      <Field label="Primary button">
        <input className={inputClass} value={p.buttonText ?? ''} onChange={(e) => onChange({ buttonText: e.target.value })} />
      </Field>
      <Field label="Secondary button">
        <input className={inputClass} value={p.buttonText2 ?? ''} onChange={(e) => onChange({ buttonText2: e.target.value })} />
      </Field>

      <ToggleField label="Show avatar" checked={p.showProfileAvatar !== false} onChange={(v) => onChange({ showProfileAvatar: v })} />
      <ToggleField label="Show badge" checked={p.showProfileBadge !== false} onChange={(v) => onChange({ showProfileBadge: v })} />
      <ToggleField label="Show role" checked={p.showProfileRole !== false} onChange={(v) => onChange({ showProfileRole: v })} />
      <ToggleField label="Show location" checked={p.showProfileLocation !== false} onChange={(v) => onChange({ showProfileLocation: v })} />
      <ToggleField label="Show stats" checked={p.showProfileStats !== false} onChange={(v) => onChange({ showProfileStats: v })} />
      <ToggleField label="Show actions" checked={p.showProfileActions !== false} onChange={(v) => onChange({ showProfileActions: v })} />

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-gray-400">Stats ({stats.length})</span>
        <button type="button" onClick={() => updateStats([...stats, createProfileStat()])} className="text-xs font-medium text-brand-600">
          + Add
        </button>
      </div>
      {stats.map((stat, i) => (
        <div key={stat.id ?? i} className="rounded-lg border border-gray-100">
          <div className="flex items-center gap-1 p-2">
            <button type="button" className="flex flex-1 items-center gap-1 text-left text-sm" onClick={() => setExpanded(expanded === i ? null : i)}>
              {expanded === i ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {stat.label}: {stat.value}
            </button>
            <button type="button" onClick={() => updateStats(stats.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {expanded === i && (
            <div className="space-y-2 border-t p-3">
              <Field label="Label">
                <input
                  className={inputClass}
                  value={stat.label}
                  onChange={(e) => {
                    const n = [...stats]
                    n[i] = { ...stat, label: e.target.value }
                    updateStats(n)
                  }}
                />
              </Field>
              <Field label="Value">
                <input
                  className={inputClass}
                  value={stat.value}
                  onChange={(e) => {
                    const n = [...stats]
                    n[i] = { ...stat, value: e.target.value }
                    updateStats(n)
                  }}
                />
              </Field>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
