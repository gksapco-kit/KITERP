import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import { createLightboxItem, defaultLightboxItems } from '../../lib/lightboxDefaults'
import type { Block, BlockStyles, LightboxItem } from '../../types/builder'
import { ImageUploadField } from '../builder/ImageUploadField'
import { ThemeGradientFields } from './ThemeGradientFields'
import { ColumnsInput } from './ColumnsInput'
import { v4 as uuid } from 'uuid'

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

interface LightboxPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<BlockStyles>) => void
}

export function LightboxPropertiesFields({ block, onChange, onStylesChange }: LightboxPropertiesFieldsProps) {
  const p = block.props
  const items = p.lightboxItems ?? defaultLightboxItems()
  const [expanded, setExpanded] = useState<number | null>(items.length > 0 ? 0 : null)

  const updateItems = (next: LightboxItem[]) => onChange({ lightboxItems: next })

  const updateItem = (index: number, item: LightboxItem) => {
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
    const copy = { ...item, id: uuid(), title: item.title ? `${item.title} (copy)` : '' }
    const next = [...items]
    next.splice(index + 1, 0, copy)
    updateItems(next)
    setExpanded(index + 1)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Lightbox</p>

      <Field label="Section title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Lightbox Gallery" />
      </Field>

      <Field label="Section subtitle">
        <input className={inputClass} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>

      <Field label="Thumbnail layout">
        <select
          className={inputClass}
          value={p.lightboxGridLayout ?? 'grid'}
          onChange={(e) => onChange({ lightboxGridLayout: e.target.value as 'grid' | 'masonry' | 'featured' | 'filmstrip' })}
        >
          <option value="grid">Uniform grid</option>
          <option value="masonry">Masonry</option>
          <option value="featured">Featured hero</option>
          <option value="filmstrip">Horizontal filmstrip</option>
        </select>
      </Field>

      {(p.lightboxGridLayout ?? 'grid') === 'grid' && (
        <ColumnsInput value={p.columns ?? 3} onChange={(columns) => onChange({ columns })} min={2} max={5} />
      )}

      <Field label="Thumbnail section theme">
        <select
          className={inputClass}
          value={p.lightboxThumbTheme ?? 'light'}
          onChange={(e) => onChange({ lightboxThumbTheme: e.target.value as 'light' | 'dark' | 'minimal' })}
        >
          <option value="light">Light card</option>
          <option value="dark">Dark gradient</option>
          <option value="minimal">Minimal (no shell)</option>
        </select>
      </Field>

      <ThemeGradientFields block={block} theme={p.lightboxThumbTheme} onStylesChange={onStylesChange} showForThemes={['dark']} />

      <Field label="Fullscreen overlay">
        <select
          className={inputClass}
          value={p.lightboxOverlay ?? 'blur'}
          onChange={(e) => onChange({ lightboxOverlay: e.target.value as 'blur' | 'solid' | 'gradient' })}
        >
          <option value="blur">Blurred glass</option>
          <option value="solid">Solid dark</option>
          <option value="gradient">Gradient</option>
        </select>
      </Field>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Viewer</p>
        <ToggleField label="Show captions in viewer" checked={p.showLightboxCaption !== false} onChange={(v) => onChange({ showLightboxCaption: v })} />
        <ToggleField label="Show image counter" checked={p.showLightboxCounter !== false} onChange={(v) => onChange({ showLightboxCounter: v })} />
        <ToggleField label="Thumbnail strip in viewer" checked={p.showLightboxThumbnails !== false} onChange={(v) => onChange({ showLightboxThumbnails: v })} />
        <ToggleField label="Zoom icon on hover" checked={p.showLightboxZoomHint !== false} onChange={(v) => onChange({ showLightboxZoomHint: v })} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Images ({items.length})</span>
          <button
            type="button"
            onClick={() => {
              const next = [...items, createLightboxItem({ title: `Image ${items.length + 1}` })]
              updateItems(next)
              setExpanded(next.length - 1)
            }}
            className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <Plus className="h-3.5 w-3.5" /> Add image
          </button>
        </div>

        <ul className="space-y-2">
          {items.map((item, index) => {
            const open = expanded === index
            return (
              <li key={item.id ?? index} className="rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-1 p-2">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : index)}
                    className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium text-gray-800"
                  >
                    {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{item.title || `Image ${index + 1}`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateItem(index)}
                    title="Duplicate"
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    aria-label="Duplicate"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {open && (
                  <div className="space-y-3 border-t border-gray-200 bg-white p-3">
                    <ImageUploadField label="Image" value={item.imageUrl} onChange={(url) => updateItem(index, { ...item, imageUrl: url })} />
                    <Field label="Title">
                      <input
                        className={inputClass}
                        value={item.title ?? ''}
                        onChange={(e) => updateItem(index, { ...item, title: e.target.value })}
                        placeholder="Image title"
                      />
                    </Field>
                    <Field label="Caption (shown in lightbox)">
                      <textarea
                        className={inputClass}
                        rows={2}
                        value={item.caption ?? ''}
                        onChange={(e) => updateItem(index, { ...item, caption: e.target.value })}
                        placeholder="Optional caption"
                      />
                    </Field>
                    <Field label="Alt text">
                      <input
                        className={inputClass}
                        value={item.alt ?? ''}
                        onChange={(e) => updateItem(index, { ...item, alt: e.target.value })}
                        placeholder="Accessibility description"
                      />
                    </Field>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
