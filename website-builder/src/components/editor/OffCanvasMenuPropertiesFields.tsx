import { useState } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { createOffCanvasLink, defaultOffCanvasLinks, OFF_CANVAS_MENU_DEFAULTS } from '../../lib/offCanvasMenuDefaults'
import type { Block, OffCanvasLinkItem } from '../../types/builder'

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

export function OffCanvasMenuPropertiesFields({ block, onChange }: { block: Block; onChange: (p: Partial<Block['props']>) => void }) {
  const p = block.props
  const links = p.offCanvasLinks ?? defaultOffCanvasLinks()
  const [expanded, setExpanded] = useState<number | null>(0)
  const updateLinks = (next: OffCanvasLinkItem[]) => onChange({ offCanvasLinks: next })

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Off-canvas menu</p>
      <Field label="Panel title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
      <Field label="Trigger button label">
        <input className={inputClass} value={p.buttonText ?? OFF_CANVAS_MENU_DEFAULTS.buttonText} onChange={(e) => onChange({ buttonText: e.target.value })} />
      </Field>
      <Field label="Slide from">
        <select className={inputClass} value={p.offCanvasSide ?? 'left'} onChange={(e) => onChange({ offCanvasSide: e.target.value as 'left' | 'right' })}>
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </Field>
      <Field label="Theme">
        <select className={inputClass} value={p.offCanvasTheme ?? 'light'} onChange={(e) => onChange({ offCanvasTheme: e.target.value as 'light' | 'dark' })}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </Field>
      <ToggleField label="Open panel in editor preview" checked={p.offCanvasPreviewOpen !== false} onChange={(v) => onChange({ offCanvasPreviewOpen: v })} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-gray-400">Links ({links.length})</span>
        <button type="button" onClick={() => updateLinks([...links, createOffCanvasLink()])} className="text-xs font-medium text-brand-600">
          + Add
        </button>
      </div>
      {links.map((link, i) => (
        <div key={link.id ?? i} className="rounded-lg border border-gray-100">
          <div className="flex items-center gap-1 p-2">
            <button type="button" className="flex flex-1 items-center gap-1 text-left text-sm" onClick={() => setExpanded(expanded === i ? null : i)}>
              {expanded === i ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {link.label}
            </button>
            <button type="button" onClick={() => updateLinks(links.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {expanded === i && (
            <div className="space-y-2 border-t p-3">
              <Field label="Label">
                <input className={inputClass} value={link.label} onChange={(e) => { const n = [...links]; n[i] = { ...link, label: e.target.value }; updateLinks(n) }} />
              </Field>
              <Field label="Link URL">
                <input className={inputClass} value={link.link ?? ''} onChange={(e) => { const n = [...links]; n[i] = { ...link, link: e.target.value }; updateLinks(n) }} />
              </Field>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
