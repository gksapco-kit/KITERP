import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import {
  clampIntervalSeconds,
  DEFAULT_SLIDER_INTERVAL_SECONDS,
  normalizeTestimonialLayout,
  resolveTestimonialAutoSlide,
} from '../../lib/sectionSlider'
import { createDefaultTestimonial, resolveTestimonialItems, TESTIMONIAL_DISPLAY_DEFAULTS } from '../../lib/testimonialDefaults'
import type { Block, TestimonialItem } from '../../types/builder'
import { ImageUploadField } from '../builder/ImageUploadField'
import { ItemContentStyleFields } from './ItemContentStyleFields'
import { SliderLayoutFields } from './SliderLayoutFields'

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

interface TestimonialPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function TestimonialPropertiesFields({ block, onChange }: TestimonialPropertiesFieldsProps) {
  const p = block.props
  const items = p.testimonialItems?.length ? p.testimonialItems : resolveTestimonialItems(p)
  const [expanded, setExpanded] = useState<number | null>(items.length > 0 ? 0 : null)
  const layout = normalizeTestimonialLayout(p.testimonialLayout ?? TESTIMONIAL_DISPLAY_DEFAULTS.testimonialLayout)

  const updateItems = (next: TestimonialItem[]) => {
    onChange({
      testimonialItems: next,
      quote: undefined,
      author: undefined,
      role: undefined,
    })
  }

  const updateItem = (index: number, item: TestimonialItem) => {
    const next = [...items]
    next[index] = item
    updateItems(next)
  }

  const removeItem = (index: number) => {
    updateItems(items.filter((_, i) => i !== index))
    if (expanded === index) setExpanded(null)
    else if (expanded != null && expanded > index) setExpanded(expanded - 1)
  }

  const duplicateItem = (index: number) => {
    const item = items[index]
    if (!item) return
    const copy = { ...item, id: uuid(), author: item.author ? `${item.author} (copy)` : '' }
    const next = [...items]
    next.splice(index + 1, 0, copy)
    updateItems(next)
    setExpanded(index + 1)
  }

  const addItem = () => {
    const next = [...items, createDefaultTestimonial()]
    updateItems(next)
    setExpanded(next.length - 1)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Testimonials</p>

      <Field label="Section title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="What Our Customers Say" />
      </Field>

      <Field label="Section subtitle">
        <textarea
          className={inputClass}
          rows={2}
          value={p.subtitle ?? ''}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="Short intro below the title"
        />
      </Field>

      <SliderLayoutFields
        layout={layout}
        layoutOptions={[
          { value: 'featured', label: 'Featured' },
          { value: 'manualSlider', label: 'Manual slider' },
        ]}
        onLayoutChange={(testimonialLayout) =>
          onChange({
            testimonialLayout: testimonialLayout as 'featured' | 'manualSlider',
          })
        }
        intervalSeconds={p.sliderIntervalSeconds}
        onIntervalChange={(sliderIntervalSeconds) =>
          onChange({ sliderIntervalSeconds: clampIntervalSeconds(sliderIntervalSeconds) })
        }
        showIntervalWhen={[]}
      />

      <ToggleField
        label="Auto slider"
        checked={p.testimonialAutoSlide ?? resolveTestimonialAutoSlide(p)}
        onChange={(testimonialAutoSlide) => onChange({ testimonialAutoSlide })}
      />

      {(p.testimonialAutoSlide ?? resolveTestimonialAutoSlide(p)) && (
        <Field label="Auto slide interval (seconds)">
          <input
            type="number"
            min={2}
            max={30}
            step={1}
            className={inputClass}
            value={p.sliderIntervalSeconds ?? DEFAULT_SLIDER_INTERVAL_SECONDS}
            onChange={(e) =>
              onChange({ sliderIntervalSeconds: clampIntervalSeconds(Number(e.target.value)) })
            }
          />
          <p className="mt-1 text-[11px] text-gray-400">Time between slides. Hover to pause.</p>
        </Field>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Display</p>
        <ToggleField
          label="Show star ratings"
          checked={p.showTestimonialRating ?? TESTIMONIAL_DISPLAY_DEFAULTS.showTestimonialRating}
          onChange={(v) => onChange({ showTestimonialRating: v })}
        />
        <ToggleField
          label="Show avatars"
          checked={p.showTestimonialAvatar ?? TESTIMONIAL_DISPLAY_DEFAULTS.showTestimonialAvatar}
          onChange={(v) => onChange({ showTestimonialAvatar: v })}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Testimonials ({items.length})</span>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <Plus className="h-3.5 w-3.5" /> Add testimonial
          </button>
        </div>

        <ul className="space-y-2">
          {items.map((item, i) => {
            const isOpen = expanded === i
            return (
              <li key={item.id ?? i} className="rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-1 p-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium text-gray-800"
                    onClick={() => setExpanded(isOpen ? null : i)}
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{item.author || `Testimonial ${i + 1}`}</span>
                  </button>
                  <button type="button" title="Duplicate" className="rounded p-1 text-gray-400 hover:bg-gray-100" onClick={() => duplicateItem(i)}>
                    <Copy className="h-4 w-4" />
                  </button>
                  <button type="button" title="Delete" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => removeItem(i)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {isOpen && (
                  <div className="space-y-3 border-t border-gray-200 bg-white p-3">
                    <Field label="Quote">
                      <textarea
                        className={inputClass}
                        rows={4}
                        value={item.quote}
                        onChange={(e) => updateItem(i, { ...item, quote: e.target.value })}
                      />
                    </Field>
                    <Field label="Author name">
                      <input className={inputClass} value={item.author} onChange={(e) => updateItem(i, { ...item, author: e.target.value })} />
                    </Field>
                    <Field label="Role / title">
                      <input
                        className={inputClass}
                        value={item.role ?? ''}
                        onChange={(e) => updateItem(i, { ...item, role: e.target.value })}
                        placeholder="Customer, CEO, etc."
                      />
                    </Field>
                    <Field label="Star rating (1–5)">
                      <input
                        type="number"
                        min={0}
                        max={5}
                        className={inputClass}
                        value={item.rating ?? 5}
                        onChange={(e) => updateItem(i, { ...item, rating: Math.min(5, Math.max(0, Number(e.target.value))) })}
                      />
                    </Field>
                    <ImageUploadField
                      label="Avatar photo (optional)"
                      value={item.imageUrl}
                      onChange={(url) => updateItem(i, { ...item, imageUrl: url })}
                    />
                    <ItemContentStyleFields
                      style={item.contentStyle}
                      onChange={(contentStyle) => updateItem(i, { ...item, contentStyle })}
                      titleLabel="Quote text color"
                      descriptionLabel="Author / role color"
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        {items.length === 0 && (
          <p className="py-4 text-center text-xs text-gray-400">Click &ldquo;Add testimonial&rdquo; to get started.</p>
        )}
      </div>
    </div>
  )
}
