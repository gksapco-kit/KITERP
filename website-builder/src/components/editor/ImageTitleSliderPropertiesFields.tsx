import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { createImageTitleSlide, IMAGE_TITLE_SLIDER_DEFAULTS } from '../../lib/imageTitleSliderDefaults'
import type { Block, CardItem } from '../../types/builder'
import { ImageUploadField } from '../builder/ImageUploadField'
import { ColumnsInput } from './ColumnsInput'

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

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

export function ImageTitleSliderPropertiesFields({ block, onChange }: { block: Block; onChange: (p: Partial<Block['props']>) => void }) {
  const p = block.props
  const cards = p.cards ?? []
  const [expanded, setExpanded] = useState<number | null>(cards.length > 0 ? 0 : null)
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

  const addItem = () => {
    const next = [...cards, createImageTitleSlide({ title: `Item ${cards.length + 1}` })]
    updateCards(next)
    setExpanded(next.length - 1)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Image title slider</p>
      <p className="text-xs text-gray-500">Horizontal category strip — image and title only (optional badge).</p>

      <Field label="Section title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
      <Field label="Section subtitle">
        <input className={inputClass} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>

      <ColumnsInput
        label="Visible columns"
        value={p.columns ?? IMAGE_TITLE_SLIDER_DEFAULTS.columns}
        onChange={(columns) => onChange({ columns })}
        min={2}
        max={10}
      />

      <ToggleField
        label="Show navigation arrows"
        checked={p.showImageTitleSliderArrows !== false}
        onChange={(v) => onChange({ showImageTitleSliderArrows: v })}
      />
      <ToggleField
        label="Show badges (e.g. NEW)"
        checked={p.showImageTitleSliderBadges !== false}
        onChange={(v) => onChange({ showImageTitleSliderBadges: v })}
      />

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-gray-400">
          Items ({cards.length})
          {cards.length < (p.columns ?? IMAGE_TITLE_SLIDER_DEFAULTS.columns) && (
            <span className="ml-1 font-normal normal-case text-gray-400">
              · add { (p.columns ?? IMAGE_TITLE_SLIDER_DEFAULTS.columns) - cards.length} more to fill a row
            </span>
          )}
        </span>
        <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs font-medium text-brand-600">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      {cards.map((card, i) => {
        const isOpen = expanded === i
        return (
          <div key={card.id ?? i} className="rounded-lg border border-gray-100">
            <div className="flex items-center gap-1 p-2">
              <button type="button" className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm" onClick={() => setExpanded(isOpen ? null : i)}>
                {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                <span className="truncate">{card.title || `Item ${i + 1}`}</span>
              </button>
              <button type="button" onClick={() => removeCard(i)} className="text-gray-400 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {isOpen && (
              <div className="space-y-3 border-t p-3">
                <Field label="Title">
                  <input className={inputClass} value={card.title} onChange={(e) => updateCard(i, { ...card, title: e.target.value })} />
                </Field>
                <ImageUploadField label="Image" value={card.imageUrl} onChange={(url) => updateCard(i, { ...card, imageUrl: url })} />
                <Field label="Badge (optional)">
                  <input
                    className={inputClass}
                    value={card.badge ?? ''}
                    onChange={(e) => updateCard(i, { ...card, badge: e.target.value || undefined })}
                    placeholder="NEW"
                  />
                </Field>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
