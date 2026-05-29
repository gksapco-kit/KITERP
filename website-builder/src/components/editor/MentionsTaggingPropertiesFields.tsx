import { useState } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { createMentionItem, defaultMentionItems } from '../../lib/mentionsTaggingDefaults'
import type { Block, MentionItem } from '../../types/builder'

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

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

export function MentionsTaggingPropertiesFields({ block, onChange }: { block: Block; onChange: (p: Partial<Block['props']>) => void }) {
  const p = block.props
  const items = p.mentionItems ?? defaultMentionItems()
  const [expanded, setExpanded] = useState<number | null>(0)
  const updateItems = (next: MentionItem[]) => onChange({ mentionItems: next })

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Mentions & Tagging</p>
      <Field label="Title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
      <Field label="Subtitle">
        <input className={inputClass} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>
      <Field label="Layout">
        <select className={inputClass} value={p.mentionsLayout ?? 'composer'} onChange={(e) => onChange({ mentionsLayout: e.target.value as 'composer' | 'chips' | 'list' })}>
          <option value="composer">Composer preview</option>
          <option value="chips">Mention chips</option>
          <option value="list">Team list</option>
        </select>
      </Field>
      <ToggleField label="Show avatars" checked={p.showMentionAvatars !== false} onChange={(v) => onChange({ showMentionAvatars: v })} />
      {(p.mentionsLayout ?? 'composer') === 'composer' && (
        <Field label="Sample message">
          <textarea className={inputClass} rows={3} value={p.mentionComposerText ?? ''} onChange={(e) => onChange({ mentionComposerText: e.target.value })} />
        </Field>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-gray-400">People ({items.length})</span>
        <button type="button" onClick={() => updateItems([...items, createMentionItem({ name: 'New User', handle: 'newuser' })])} className="text-xs font-medium text-brand-600">
          + Add
        </button>
      </div>
      {items.map((item, i) => (
        <div key={item.id ?? i} className="rounded-lg border border-gray-100">
          <div className="flex items-center gap-1 p-2">
            <button type="button" className="flex flex-1 items-center gap-1 text-left text-sm" onClick={() => setExpanded(expanded === i ? null : i)}>
              {expanded === i ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              @{item.handle}
            </button>
            <button type="button" onClick={() => updateItems(items.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {expanded === i && (
            <div className="space-y-2 border-t p-3">
              <Field label="Display name">
                <input className={inputClass} value={item.name} onChange={(e) => { const n = [...items]; n[i] = { ...item, name: e.target.value }; updateItems(n) }} />
              </Field>
              <Field label="Handle (no @)">
                <input className={inputClass} value={item.handle} onChange={(e) => { const n = [...items]; n[i] = { ...item, handle: e.target.value.replace('@', '') }; updateItems(n) }} />
              </Field>
              <Field label="Role (optional)">
                <input className={inputClass} value={item.role ?? ''} onChange={(e) => { const n = [...items]; n[i] = { ...item, role: e.target.value }; updateItems(n) }} />
              </Field>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
