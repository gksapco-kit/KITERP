import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { createDefaultCard } from '../../lib/cardDefaults'
import type { Block, CardItem } from '../../types/builder'
import { ItemContentStyleFields } from './ItemContentStyleFields'
import { ImageUploadField } from '../builder/ImageUploadField'
import { SectionViewAllFields } from './SectionViewAllFields'
import { CardSectionImageFields } from './CardSectionImageFields'

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

interface CardListPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function CardListPropertiesFields({ block, onChange }: CardListPropertiesFieldsProps) {
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

  const duplicateCard = (index: number) => {
    const item = cards[index]
    if (!item) return
    const copy = { ...item, id: uuid(), title: item.title ? `${item.title} (copy)` : '' }
    const next = [...cards]
    next.splice(index + 1, 0, copy)
    updateCards(next)
    setExpanded(index + 1)
  }

  const addCard = () => {
    const next = [...cards, createDefaultCard({ title: `Item ${cards.length + 1}` })]
    updateCards(next)
    setExpanded(next.length - 1)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Card list view</p>

      <Field label="Section title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Featured Items" />
      </Field>

      <Field label="Section subtitle">
        <input className={inputClass} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} placeholder="Browse our top picks" />
      </Field>

      <SectionViewAllFields block={block} onChange={onChange} />

      <CardSectionImageFields block={block} onChange={onChange} />

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Display</p>
        <ToggleField label="Show images" checked={p.showListImage !== false} onChange={(v) => onChange({ showListImage: v })} />
        <ToggleField label="Show badges" checked={p.showListBadge !== false} onChange={(v) => onChange({ showListBadge: v })} />
        <ToggleField label="Show prices" checked={p.showListPrice !== false} onChange={(v) => onChange({ showListPrice: v })} />
        <ToggleField label="Show buttons" checked={p.showListButton !== false} onChange={(v) => onChange({ showListButton: v })} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">List items ({cards.length})</span>
          <button
            type="button"
            onClick={addCard}
            className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <Plus className="h-3.5 w-3.5" /> Add item
          </button>
        </div>

        <ul className="space-y-2">
          {cards.map((card, i) => {
            const isOpen = expanded === i
            return (
              <li key={card.id ?? i} className="rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-1 p-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium text-gray-800"
                    onClick={() => setExpanded(isOpen ? null : i)}
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{card.title || `Item ${i + 1}`}</span>
                  </button>
                  <button
                    type="button"
                    title="Duplicate"
                    className="rounded p-1 text-gray-400 hover:bg-gray-100"
                    onClick={() => duplicateCard(i)}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => removeCard(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {isOpen && (
                  <div className="space-y-3 border-t border-gray-200 bg-white p-3">
                    <Field label="Title">
                      <input className={inputClass} value={card.title} onChange={(e) => updateCard(i, { ...card, title: e.target.value })} />
                    </Field>
                    <Field label="Description">
                      <textarea
                        className={inputClass}
                        rows={3}
                        value={card.description ?? ''}
                        onChange={(e) => updateCard(i, { ...card, description: e.target.value })}
                      />
                    </Field>
                    <ImageUploadField label="Image" value={card.imageUrl} onChange={(url) => updateCard(i, { ...card, imageUrl: url })} />
                    <Field label="Badge (optional)">
                      <input
                        className={inputClass}
                        value={card.badge ?? ''}
                        onChange={(e) => updateCard(i, { ...card, badge: e.target.value })}
                        placeholder="Sale, New"
                      />
                    </Field>
                    <Field label="Price (optional)">
                      <input
                        className={inputClass}
                        value={card.price ?? ''}
                        onChange={(e) => updateCard(i, { ...card, price: e.target.value })}
                        placeholder="$99"
                      />
                    </Field>
                    <Field label="Button text">
                      <input
                        className={inputClass}
                        value={card.buttonText ?? ''}
                        onChange={(e) => updateCard(i, { ...card, buttonText: e.target.value })}
                      />
                    </Field>
                    <Field label="Button link">
                      <input
                        className={inputClass}
                        value={card.link ?? ''}
                        onChange={(e) => updateCard(i, { ...card, link: e.target.value })}
                        placeholder="#products"
                      />
                    </Field>
                    <ItemContentStyleFields
                      style={card.contentStyle}
                      onChange={(contentStyle) => updateCard(i, { ...card, contentStyle })}
                      titleLabel="Item title color"
                      descriptionLabel="Item description color"
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        {cards.length === 0 && (
          <p className="py-4 text-center text-xs text-gray-400">Click &ldquo;Add item&rdquo; to create your first list card.</p>
        )}
      </div>
    </div>
  )
}
