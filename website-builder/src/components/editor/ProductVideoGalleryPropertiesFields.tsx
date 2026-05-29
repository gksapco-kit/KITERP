import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import {
  createDefaultProductVideoItem,
  PRODUCT_VIDEO_GALLERY_DEFAULTS,
} from '../../lib/productVideoGalleryDefaults'
import { toEmbedVideoUrl } from '../../lib/videoEmbedUtils'
import type { Block, CardItem } from '../../types/builder'
import { ImageUploadField } from '../builder/ImageUploadField'
import { ItemContentStyleFields } from './ItemContentStyleFields'
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

interface ProductVideoGalleryPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function ProductVideoGalleryPropertiesFields({ block, onChange }: ProductVideoGalleryPropertiesFieldsProps) {
  const p = block.props
  const cards = p.cards ?? []
  const [expanded, setExpanded] = useState<number | null>(cards.length > 0 ? 0 : null)

  const showTitle = p.showProductVideoTitle ?? PRODUCT_VIDEO_GALLERY_DEFAULTS.showProductVideoTitle
  const showCaption = p.showProductVideoCaption ?? PRODUCT_VIDEO_GALLERY_DEFAULTS.showProductVideoCaption

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

  const addVideo = () => {
    const next = [...cards, createDefaultProductVideoItem({ title: `Video ${cards.length + 1}` })]
    updateCards(next)
    setExpanded(next.length - 1)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Product Video Gallery</p>

      <Field label="Section title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Product Videos" />
      </Field>

      <Field label="Section subtitle">
        <input
          className={inputClass}
          value={p.subtitle ?? ''}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="Watch demos and reviews"
        />
      </Field>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Display</p>
        <ToggleField label="Show video titles" checked={showTitle} onChange={(v) => onChange({ showProductVideoTitle: v })} />
        <ToggleField label="Show captions" checked={showCaption} onChange={(v) => onChange({ showProductVideoCaption: v })} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Videos ({cards.length})</span>
          <button
            type="button"
            onClick={addVideo}
            className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <Plus className="h-3.5 w-3.5" /> Add video
          </button>
        </div>

        <ul className="space-y-2">
          {cards.map((card, index) => {
            const open = expanded === index
            const embedPreview = toEmbedVideoUrl(card.videoUrl)
            return (
              <li key={card.id ?? index} className="rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-1 p-2">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : index)}
                    className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium text-gray-800"
                  >
                    {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{card.title || `Video ${index + 1}`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateCard(index)}
                    title="Duplicate"
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    aria-label="Duplicate video"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCard(index)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove video"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {open && (
                  <div className="space-y-3 border-t border-gray-200 bg-white p-3">
                    <Field
                      label="Video URL (YouTube embed or watch link)"
                      hint={embedPreview ? `Embed: ${embedPreview}` : undefined}
                    >
                      <input
                        className={inputClass}
                        value={card.videoUrl ?? ''}
                        onChange={(e) => updateCard(index, { ...card, videoUrl: e.target.value })}
                        placeholder="https://www.youtube.com/embed/..."
                      />
                    </Field>
                    <ImageUploadField
                      label="Poster / thumbnail"
                      value={card.imageUrl}
                      onChange={(url) => updateCard(index, { ...card, imageUrl: url })}
                    />
                    <Field label="Title">
                      <input
                        className={inputClass}
                        value={card.title ?? ''}
                        onChange={(e) => updateCard(index, { ...card, title: e.target.value })}
                        placeholder="Video title"
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
                      titleLabel="Title color"
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
