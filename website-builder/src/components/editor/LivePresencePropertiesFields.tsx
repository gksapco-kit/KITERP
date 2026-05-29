import { useState } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { createPresenceUser, defaultPresenceUsers } from '../../lib/livePresenceDefaults'
import type { Block, PresenceUserItem } from '../../types/builder'

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

export function LivePresencePropertiesFields({ block, onChange }: { block: Block; onChange: (p: Partial<Block['props']>) => void }) {
  const p = block.props
  const users = p.presenceUsers ?? defaultPresenceUsers()
  const [expanded, setExpanded] = useState<number | null>(null)
  const updateUsers = (next: PresenceUserItem[]) => onChange({ presenceUsers: next })

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Live Presence</p>
      <Field label="Title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
      <Field label="Status line">
        <input className={inputClass} value={p.presenceStatusText ?? ''} onChange={(e) => onChange({ presenceStatusText: e.target.value })} />
      </Field>
      <Field label="Layout">
        <select className={inputClass} value={p.presenceLayout ?? 'stack'} onChange={(e) => onChange({ presenceLayout: e.target.value as 'stack' | 'list' | 'compact' })}>
          <option value="stack">Avatar stack</option>
          <option value="list">Detailed list</option>
          <option value="compact">Compact pills</option>
        </select>
      </Field>
      <Field label="Online count (override)">
        <input type="number" className={inputClass} value={p.presenceOnlineCount ?? ''} onChange={(e) => onChange({ presenceOnlineCount: Number(e.target.value) })} />
      </Field>
      <ToggleField label="Pulse on online" checked={p.showPresencePulse !== false} onChange={(v) => onChange({ showPresencePulse: v })} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-gray-400">Users ({users.length})</span>
        <button type="button" onClick={() => updateUsers([...users, createPresenceUser({ name: 'New User' })])} className="text-xs font-medium text-brand-600">
          + Add
        </button>
      </div>
      {users.map((user, i) => (
        <div key={user.id ?? i} className="rounded-lg border border-gray-100">
          <div className="flex items-center gap-1 p-2">
            <button type="button" className="flex flex-1 items-center gap-1 text-left text-sm" onClick={() => setExpanded(expanded === i ? null : i)}>
              {expanded === i ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {user.name}
            </button>
            <button type="button" onClick={() => updateUsers(users.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {expanded === i && (
            <div className="space-y-2 border-t p-3">
              <Field label="Name">
                <input className={inputClass} value={user.name} onChange={(e) => { const n = [...users]; n[i] = { ...user, name: e.target.value }; updateUsers(n) }} />
              </Field>
              <Field label="Status">
                <select className={inputClass} value={user.status ?? 'online'} onChange={(e) => { const n = [...users]; n[i] = { ...user, status: e.target.value as PresenceUserItem['status'] }; updateUsers(n) }}>
                  <option value="online">Online</option>
                  <option value="away">Away</option>
                  <option value="busy">Busy</option>
                  <option value="offline">Offline</option>
                </select>
              </Field>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
