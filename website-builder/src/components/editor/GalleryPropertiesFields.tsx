import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import { createDefaultGalleryItem, GALLERY_DISPLAY_DEFAULTS } from '../../lib/galleryDefaults'
import type { Block, CardItem } from '../../types/builder'
import { ImageUploadField } from '../builder/ImageUploadField'
import { ColumnsInput } from './ColumnsInput'
import { ItemContentStyleFields } from './ItemContentStyleFields'
import { v4 as uuid } from 'uuid'

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

interface GalleryPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function GalleryPropertiesFields({ block, onChange }: GalleryPropertiesFieldsProps) {
  const p = block.props
  const cards = p.cards ?? []
  const [expanded, setExpanded] = useState<number | null>(cards.length > 0 ? 0 : null)

  const showTitle = p.showGalleryTitle ?? GALLERY_DISPLAY_DEFAULTS.showGalleryTitle
  const showCaption = p.showGalleryCaption ?? GALLERY_DISPLAY_DEFAULTS.showGalleryCaption
  const showLightbox = p.showGalleryLightbox ?? GALLERY_DISPLAY_DEFAULTS.showGalleryLightbox
  const layout = p.galleryLayout ?? GALLERY_DISPLAY_DEFAULTS.galleryLayout

  const updateCards = (next: CardItem[]) => onChange({ cards: next })

  const updateCard = (index: number, card: CardItem) => {
    const next = [...cards]
    next[index] = card
    updateCards(next)
  }

  const removeCard = (index: number) => {
    updateCards(cards.filter((_, i) => i !== index))
    if (expanded === index) setExpanded(null)
    else if (expanded != null && expanded > index) setExpanded(expanded - 1)
  }

  const duplicateCard = (index: number) => {
    const item = cards[index]
    if (!item) return
    const copy = { ...item, id: uuid(), title: item.title ? `${item.title} (copy)` : '' }
    const next = [...cards]
    next.splice(index + 1, 0, copy)
    updateCards(next)
    setExpanded(index + 1)
  }

  const addImage = () => {
    const next = [...cards, createDefaultGalleryItem({ title: `Photo ${cards.length + 1}` })]
    updateCards(next)
    setExpanded(next.length - 1)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Gallery</p>

      <Field label="Section title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Photo Gallery" />
      </Field>

      <Field label="Section subtitle">
        <input className={inputClass} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} placeholder="Browse our work" />
      </Field>

      <ColumnsInput value={p.columns ?? 3} onChange={(columns) => onChange({ columns })} min={2} max={5} />

      <Field label="Caption layout">
        <select
          className={inputClass}
          value={layout}
          onChange={(e) => onChange({ galleryLayout: e.target.value as 'overlay' | 'below' })}
        >
          <option value="overlay">On hover (overlay)</option>
          <option value="below">Below image</option>
        </select>
      </Field>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Display</p>
        <ToggleField label="Show image titles" checked={showTitle} onChange={(v) => onChange({ showGalleryTitle: v })} />
        <ToggleField label="Show captions" checked={showCaption} onChange={(v) => onChange({ showGalleryCaption: v })} />
        <ToggleField label="Enable lightbox (click to enlarge)" checked={showLightbox} onChange={(v) => onChange({ showGalleryLightbox: v })} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Images ({cards.length})</span>
          <button
            type="button"
            onClick={addImage}
            className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <Plus className="h-3.5 w-3.5" /> Add image
          </button>
        </div>

        <ul className="space-y-2">
          {cards.map((card, index) => {
            const open = expanded === index
            return (
              <li key={card.id ?? index} className="rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-1 p-2">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : index)}
                    className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium text-gray-800"
                  >
                    {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{card.title || `Image ${index + 1}`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateCard(index)}
                    title="Duplicate"
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    aria-label="Duplicate image"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCard(index)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove image"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {open && (
                  <div className="space-y-3 border-t border-gray-200 bg-white p-3">
                    <ImageUploadField
                      label="Image"
                      value={card.imageUrl}
                      onChange={(url) => updateCard(index, { ...card, imageUrl: url })}
                    />
                    <Field label="Title">
                      <input
                        className={inputClass}
                        value={card.title ?? ''}
                        onChange={(e) => updateCard(index, { ...card, title: e.target.value })}
                        placeholder="Image title"
                      />
                    </Field>
                    <Field label="Caption">
                      <textarea
                        className={inputClass}
                        rows={2}
                        value={card.description ?? ''}
                        onChange={(e) => updateCard(index, { ...card, description: e.target.value })}
                        placeholder="Optional caption"
                      />
                    </Field>
                    <ItemContentStyleFields
                      style={card.contentStyle}
                      onChange={(contentStyle) => updateCard(index, { ...card, contentStyle })}
                      titleLabel="Image title color"
                      descriptionLabel="Caption color"
                    />
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
