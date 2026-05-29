import { useState } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { createFabAction, defaultFabActions, FAB_DEFAULTS } from '../../lib/fabDefaults'
import type { Block, FabActionItem } from '../../types/builder'

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

export function FloatingActionButtonPropertiesFields({ block, onChange }: { block: Block; onChange: (p: Partial<Block['props']>) => void }) {
  const p = block.props
  const actions = p.fabActions ?? defaultFabActions()
  const [expanded, setExpanded] = useState<number | null>(null)
  const updateActions = (next: FabActionItem[]) => onChange({ fabActions: next })

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Floating action button</p>
      <Field label="Label (extended variant)">
        <input className={inputClass} value={p.buttonText ?? ''} onChange={(e) => onChange({ buttonText: e.target.value })} />
      </Field>
      <Field label="Position">
        <select className={inputClass} value={p.fabPosition ?? FAB_DEFAULTS.fabPosition} onChange={(e) => onChange({ fabPosition: e.target.value as Block['props']['fabPosition'] })}>
          <option value="bottom-right">Bottom right</option>
          <option value="bottom-left">Bottom left</option>
          <option value="bottom-center">Bottom center</option>
        </select>
      </Field>
      <Field label="Variant">
        <select className={inputClass} value={p.fabVariant ?? 'icon'} onChange={(e) => onChange({ fabVariant: e.target.value as 'icon' | 'extended' })}>
          <option value="icon">Icon only</option>
          <option value="extended">Extended</option>
        </select>
      </Field>
      <Field label="Icon">
        <select className={inputClass} value={p.fabIcon ?? 'plus'} onChange={(e) => onChange({ fabIcon: e.target.value as Block['props']['fabIcon'] })}>
          <option value="plus">Plus</option>
          <option value="cart">Cart</option>
          <option value="message">Message</option>
          <option value="edit">Edit</option>
        </select>
      </Field>
      <Field label="Theme">
        <select className={inputClass} value={p.fabTheme ?? 'brand'} onChange={(e) => onChange({ fabTheme: e.target.value as Block['props']['fabTheme'] })}>
          <option value="brand">Brand</option>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </Field>
      <ToggleField label="Show action menu" checked={p.showFabMenu !== false} onChange={(v) => onChange({ showFabMenu: v })} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-gray-400">Menu actions</span>
        <button type="button" onClick={() => updateActions([...actions, createFabAction()])} className="text-xs font-medium text-brand-600">
          + Add
        </button>
      </div>
      {actions.map((action, i) => (
        <div key={action.id ?? i} className="rounded-lg border border-gray-100">
          <div className="flex items-center gap-1 p-2">
            <button type="button" className="flex flex-1 items-center gap-1 text-left text-sm" onClick={() => setExpanded(expanded === i ? null : i)}>
              {expanded === i ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {action.label}
            </button>
            <button type="button" onClick={() => updateActions(actions.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {expanded === i && (
            <div className="space-y-2 border-t p-3">
              <Field label="Label">
                <input className={inputClass} value={action.label} onChange={(e) => { const n = [...actions]; n[i] = { ...action, label: e.target.value }; updateActions(n) }} />
              </Field>
              <Field label="Link">
                <input className={inputClass} value={action.link ?? ''} onChange={(e) => { const n = [...actions]; n[i] = { ...action, link: e.target.value }; updateActions(n) }} />
              </Field>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
