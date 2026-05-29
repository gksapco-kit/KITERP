import { useState } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { createPollOption, defaultPollOptions } from '../../lib/pollVotingDefaults'
import type { Block, PollOptionItem } from '../../types/builder'

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

export function PollVotingPropertiesFields({ block, onChange }: { block: Block; onChange: (p: Partial<Block['props']>) => void }) {
  const p = block.props
  const options = p.pollOptions ?? defaultPollOptions()
  const [expanded, setExpanded] = useState<number | null>(0)

  const updateOptions = (next: PollOptionItem[]) => onChange({ pollOptions: next })

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Polls & Voting</p>
      <Field label="Poll question">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
      <Field label="Subtitle">
        <input className={inputClass} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>
      <Field label="Layout">
        <select className={inputClass} value={p.pollLayout ?? 'bars'} onChange={(e) => onChange({ pollLayout: e.target.value as 'bars' | 'cards' | 'list' })}>
          <option value="bars">Bar chart</option>
          <option value="cards">Option cards</option>
          <option value="list">Compact list</option>
        </select>
      </Field>
      <Field label="Theme">
        <select className={inputClass} value={p.pollTheme ?? 'premium'} onChange={(e) => onChange({ pollTheme: e.target.value as 'light' | 'premium' | 'dark' })}>
          <option value="premium">Premium</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </Field>
      <ToggleField label="Show results" checked={p.showPollResults !== false} onChange={(v) => onChange({ showPollResults: v })} />
      <ToggleField label="Show vote counts" checked={p.showPollVoteCount !== false} onChange={(v) => onChange({ showPollVoteCount: v })} />
      <Field label="Submit button">
        <input className={inputClass} value={p.buttonText ?? ''} onChange={(e) => onChange({ buttonText: e.target.value })} />
      </Field>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-gray-400">Options ({options.length})</span>
        <button type="button" onClick={() => updateOptions([...options, createPollOption({ label: `Option ${options.length + 1}` })])} className="text-xs font-medium text-brand-600">
          + Add
        </button>
      </div>
      {options.map((opt, i) => (
        <div key={opt.id ?? i} className="rounded-lg border border-gray-100">
          <div className="flex items-center gap-1 p-2">
            <button type="button" className="flex flex-1 items-center gap-1 text-left text-sm" onClick={() => setExpanded(expanded === i ? null : i)}>
              {expanded === i ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {opt.label}
            </button>
            <button type="button" onClick={() => updateOptions(options.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {expanded === i && (
            <div className="space-y-2 border-t p-3">
              <Field label="Label">
                <input className={inputClass} value={opt.label} onChange={(e) => { const n = [...options]; n[i] = { ...opt, label: e.target.value }; updateOptions(n) }} />
              </Field>
              <Field label="Votes (preview)">
                <input type="number" className={inputClass} value={opt.votes ?? 0} onChange={(e) => { const n = [...options]; n[i] = { ...opt, votes: Number(e.target.value) }; updateOptions(n) }} />
              </Field>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
