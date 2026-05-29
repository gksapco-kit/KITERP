import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import {
  createProgressBarItem,
  defaultProgressSteps,
  defaultStackedProgressItems,
  PROGRESS_BAR_DEFAULTS,
} from '../../lib/progressBarDefaults'
import type { Block, BlockStyles, ProgressBarItem } from '../../types/builder'

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

interface ProgressBarPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<BlockStyles>) => void
}

export function ProgressBarPropertiesFields({ block, onChange, onStylesChange }: ProgressBarPropertiesFieldsProps) {
  const p = block.props
  const s = block.styles
  const layout = p.progressBarLayout ?? PROGRESS_BAR_DEFAULTS.progressBarLayout
  const percent = p.progressPercent ?? PROGRESS_BAR_DEFAULTS.progressPercent
  const items = p.progressItems ?? defaultProgressSteps()
  const [expanded, setExpanded] = useState<number | null>(null)

  const updateItems = (next: ProgressBarItem[]) => onChange({ progressItems: next })

  const updateItem = (index: number, item: ProgressBarItem) => {
    const next = [...items]
    next[index] = item
    updateItems(next)
  }

  const removeItem = (index: number) => {
    updateItems(items.filter((_, i) => i !== index))
    if (expanded === index) setExpanded(null)
    else if (expanded != null && expanded > index) setExpanded(expanded - 1)
  }

  const addItem = () => {
    const next = [...items, createProgressBarItem({ label: `Item ${items.length + 1}` })]
    updateItems(next)
    setExpanded(next.length - 1)
  }

  const resetItems = () => {
    updateItems(layout === 'stacked' ? defaultStackedProgressItems() : defaultProgressSteps())
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Progress Bar</p>

        <Field label="Section title">
          <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Progress" />
        </Field>

        <Field label="Section subtitle">
          <input className={inputClass} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
        </Field>

        <Field label="Layout">
          <select
            className={inputClass}
            value={layout}
            onChange={(e) => {
              const next = e.target.value as 'bar' | 'goal' | 'steps' | 'stacked'
              onChange({
                progressBarLayout: next,
                progressItems: next === 'stacked' ? defaultStackedProgressItems() : defaultProgressSteps(),
              })
            }}
          >
            <option value="goal">Goal tracker ($68 of $100)</option>
            <option value="bar">Simple bar</option>
            <option value="steps">Step milestones</option>
            <option value="stacked">Stacked bars</option>
          </select>
        </Field>

        <Field label="Bar height">
          <select
            className={inputClass}
            value={p.progressBarHeight ?? PROGRESS_BAR_DEFAULTS.progressBarHeight}
            onChange={(e) => onChange({ progressBarHeight: e.target.value as 'sm' | 'md' | 'lg' })}
          >
            <option value="sm">Small</option>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
          </select>
        </Field>

        <Field label="Bar color">
          <div className="flex gap-2">
              <input
                type="color"
                className="h-10 w-10 shrink-0 rounded border"
                value={p.progressBarColor ?? s.backgroundColor ?? PROGRESS_BAR_DEFAULTS.progressBarColor}
                onChange={(e) => {
                  onChange({ progressBarColor: e.target.value })
                  onStylesChange({ backgroundColor: e.target.value })
                }}
              />
              <input
                className={inputClass}
                value={p.progressBarColor ?? s.backgroundColor ?? ''}
                onChange={(e) => {
                  onChange({ progressBarColor: e.target.value })
                  onStylesChange({ backgroundColor: e.target.value })
                }}
                placeholder="#4f46e5"
              />
            </div>
        </Field>

        {(layout === 'bar' || layout === 'goal') && (
          <>
            <Field label={`Progress (${percent}%)`}>
              <input
                type="range"
                min={0}
                max={100}
                className="h-2 w-full cursor-pointer accent-brand-600"
                value={percent}
                onChange={(e) => onChange({ progressPercent: Number(e.target.value) })}
              />
            </Field>

            <ToggleField
              label="Show percentage"
              checked={p.showProgressPercent !== false}
              onChange={(v) => onChange({ showProgressPercent: v })}
            />
          </>
        )}

        {layout === 'bar' && (
          <>
            <Field label="Label">
              <input
                className={inputClass}
                value={p.progressLabel ?? ''}
                onChange={(e) => onChange({ progressLabel: e.target.value })}
                placeholder="Cart total"
              />
            </Field>
            <Field label="Value label">
              <input
                className={inputClass}
                value={p.progressValueLabel ?? ''}
                onChange={(e) => onChange({ progressValueLabel: e.target.value })}
                placeholder="$68 / $100"
              />
            </Field>
            <ToggleField
              label="Show value label"
              checked={p.showProgressValue !== false}
              onChange={(v) => onChange({ showProgressValue: v })}
            />
          </>
        )}

        {layout === 'goal' && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Current value">
              <input
                className={inputClass}
                value={p.progressCurrent ?? ''}
                onChange={(e) => onChange({ progressCurrent: e.target.value })}
                placeholder="$68"
              />
            </Field>
            <Field label="Target value">
              <input
                className={inputClass}
                value={p.progressTarget ?? ''}
                onChange={(e) => onChange({ progressTarget: e.target.value })}
                placeholder="$100"
              />
            </Field>
          </div>
        )}

        {(layout === 'steps' || layout === 'stacked') && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {layout === 'steps' ? 'Steps' : 'Bars'} ({items.length})
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
                <button type="button" onClick={resetItems} className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100">
                  Reset
                </button>
              </div>
            </div>

            <ul className="space-y-2">
              {items.map((item, i) => {
                const open = expanded === i
                return (
                  <li key={item.id ?? i} className="rounded-lg border border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-2 p-2">
                      <input
                        type="checkbox"
                        checked={item.enabled !== false}
                        onChange={(e) => updateItem(i, { ...item, enabled: e.target.checked })}
                        className="h-4 w-4 shrink-0 rounded border-gray-300"
                      />
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : i)}
                        className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium text-gray-800"
                      >
                        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                        <span className="truncate">{item.label}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {open && (
                      <div className="space-y-3 border-t border-gray-200 bg-white p-3">
                        <Field label="Label">
                          <input
                            className={inputClass}
                            value={item.label}
                            onChange={(e) => updateItem(i, { ...item, label: e.target.value })}
                          />
                        </Field>
                        {layout === 'stacked' ? (
                          <Field label={`Value (${item.value ?? 0}%)`}>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              className="h-2 w-full cursor-pointer accent-brand-600"
                              value={item.value ?? 0}
                              onChange={(e) => updateItem(i, { ...item, value: Number(e.target.value) })}
                            />
                          </Field>
                        ) : (
                          <ToggleField
                            label="Completed"
                            checked={item.completed === true}
                            onChange={(v) => updateItem(i, { ...item, completed: v })}
                          />
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
  )
}
