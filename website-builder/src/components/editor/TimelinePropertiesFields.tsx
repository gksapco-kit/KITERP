import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { createTimelineEvent, defaultTimelineEvents, TIMELINE_DEFAULTS } from '../../lib/timelineDefaults'
import type { Block, BlockStyles, TimelineEventItem } from '../../types/builder'
import { ThemeGradientFields } from './ThemeGradientFields'
import { ImageUploadField } from '../builder/ImageUploadField'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
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

interface TimelinePropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<BlockStyles>) => void
}

export function TimelinePropertiesFields({ block, onChange, onStylesChange }: TimelinePropertiesFieldsProps) {
  const p = block.props
  const events = p.timelineEvents ?? defaultTimelineEvents()
  const [expanded, setExpanded] = useState<number | null>(0)

  const updateEvents = (next: TimelineEventItem[]) => onChange({ timelineEvents: next })

  const updateEvent = (index: number, event: TimelineEventItem) => {
    const next = [...events]
    next[index] = event
    updateEvents(next)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Timeline</p>

      <Field label="Section title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>

      <Field label="Section subtitle">
        <input className={inputClass} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>

      <Field label="Layout">
        <select
          className={inputClass}
          value={p.timelineLayout ?? TIMELINE_DEFAULTS.timelineLayout}
          onChange={(e) => onChange({ timelineLayout: e.target.value as 'vertical' | 'alternating' | 'horizontal' | 'compact' })}
        >
          <option value="alternating">Alternating (zigzag)</option>
          <option value="vertical">Vertical</option>
          <option value="horizontal">Horizontal scroll</option>
          <option value="compact">Compact list</option>
        </select>
      </Field>

      <Field label="Theme">
        <select
          className={inputClass}
          value={p.timelineTheme ?? 'premium'}
          onChange={(e) => onChange({ timelineTheme: e.target.value as 'light' | 'premium' | 'dark' })}
        >
          <option value="premium">Premium</option>
          <option value="light">Light</option>
          <option value="dark">Dark gradient</option>
        </select>
      </Field>

      <ThemeGradientFields block={block} theme={p.timelineTheme} onStylesChange={onStylesChange} showForThemes={['premium', 'dark']} />

      <ToggleField label="Show dates" checked={p.showTimelineDates !== false} onChange={(v) => onChange({ showTimelineDates: v })} />
      <ToggleField label="Show connector line" checked={p.showTimelineConnector !== false} onChange={(v) => onChange({ showTimelineConnector: v })} />
      <ToggleField label="Show tags" checked={p.showTimelineTags !== false} onChange={(v) => onChange({ showTimelineTags: v })} />

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Events ({events.length})</p>
        <button
          type="button"
          onClick={() => {
            const next = [...events, createTimelineEvent({ title: `Milestone ${events.length + 1}`, date: '2026' })]
            updateEvents(next)
            setExpanded(next.length - 1)
          }}
          className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      <div className="space-y-2">
        {events.map((event, i) => {
          const open = expanded === i
          return (
            <div key={event.id ?? i} className="rounded-lg border border-gray-200 bg-gray-50">
              <div className="flex items-center gap-1 p-2">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium text-gray-800"
                  onClick={() => setExpanded(open ? null : i)}
                >
                  {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <span className="truncate">
                    {event.date ? `${event.date} — ` : ''}
                    {event.title}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateEvents(events.filter((_, idx) => idx !== i))
                    if (expanded === i) setExpanded(null)
                  }}
                  className="rounded p-1 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {open && (
                <div className="space-y-3 border-t border-gray-200 bg-white p-3">
                  <Field label="Date / period">
                    <input
                      className={inputClass}
                      value={event.date ?? ''}
                      onChange={(e) => updateEvent(i, { ...event, date: e.target.value })}
                      placeholder="Mar 2024, Q1 2026, 2025"
                    />
                  </Field>
                  <Field label="Title">
                    <input className={inputClass} value={event.title} onChange={(e) => updateEvent(i, { ...event, title: e.target.value })} />
                  </Field>
                  <Field label="Description">
                    <textarea
                      className={inputClass}
                      rows={3}
                      value={event.description ?? ''}
                      onChange={(e) => updateEvent(i, { ...event, description: e.target.value })}
                    />
                  </Field>
                  <Field label="Tag (optional)">
                    <input
                      className={inputClass}
                      value={event.tag ?? ''}
                      onChange={(e) => updateEvent(i, { ...event, tag: e.target.value })}
                      placeholder="Launch, Milestone"
                    />
                  </Field>
                  <ImageUploadField
                    label="Image (optional)"
                    value={event.imageUrl}
                    onChange={(url) => updateEvent(i, { ...event, imageUrl: url })}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
