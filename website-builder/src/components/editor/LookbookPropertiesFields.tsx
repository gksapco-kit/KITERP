import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import { createLookbookItem, LOOKBOOK_DISPLAY_DEFAULTS } from '../../lib/lookbookDefaults'
import type { Block, CardItem } from '../../types/builder'
import { ImageUploadField } from '../builder/ImageUploadField'
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

interface LookbookPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function LookbookPropertiesFields({ block, onChange }: LookbookPropertiesFieldsProps) {
  const p = block.props
  const cards = p.cards ?? []
  const [expanded, setExpanded] = useState<number | null>(cards.length > 0 ? 0 : null)

  const layout = p.lookbookLayout ?? LOOKBOOK_DISPLAY_DEFAULTS.lookbookLayout

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

  const addLook = () => {
    const next = [...cards, createLookbookItem({ title: `Look ${cards.length + 1}`, badge: `Look ${String(cards.length + 1).padStart(2, '0')}` })]
    updateCards(next)
    setExpanded(next.length - 1)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Lookbook</p>

      <Field label="Section title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="The Lookbook" />
      </Field>

      <Field label="Section subtitle">
        <textarea
          className={inputClass}
          rows={2}
          value={p.subtitle ?? ''}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="Seasonal styles…"
        />
      </Field>

      <Field label="Layout">
        <select
          className={inputClass}
          value={layout}
          onChange={(e) => onChange({ lookbookLayout: e.target.value as 'editorial' | 'grid' | 'strip' })}
        >
          <option value="editorial">Editorial mosaic</option>
          <option value="grid">Even grid</option>
          <option value="strip">Horizontal scroll</option>
        </select>
      </Field>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Display</p>
        <ToggleField label="Show look labels" checked={p.showLookbookBadge !== false} onChange={(v) => onChange({ showLookbookBadge: v })} />
        <ToggleField label="Show titles" checked={p.showLookbookTitle !== false} onChange={(v) => onChange({ showLookbookTitle: v })} />
        <ToggleField label="Show captions" checked={p.showLookbookCaption !== false} onChange={(v) => onChange({ showLookbookCaption: v })} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Looks ({cards.length})</span>
          <button
            type="button"
            onClick={addLook}
            className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <Plus className="h-3.5 w-3.5" /> Add look
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
                    <span className="truncate">{card.title || card.badge || `Look ${index + 1}`}</span>
                  </button>
                  <button type="button" onClick={() => duplicateCard(index)} className="rounded p-1 text-gray-400 hover:bg-gray-100" aria-label="Duplicate">
                    <Copy className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => removeCard(index)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {open && (
                  <div className="space-y-3 border-t border-gray-200 bg-white p-3">
                    <ImageUploadField label="Photo" value={card.imageUrl} onChange={(url) => updateCard(index, { ...card, imageUrl: url })} />
                    <Field label="Look label">
                      <input
                        className={inputClass}
                        value={card.badge ?? ''}
                        onChange={(e) => updateCard(index, { ...card, badge: e.target.value })}
                        placeholder="Look 01"
                      />
                    </Field>
                    <Field label="Title">
                      <input
                        className={inputClass}
                        value={card.title ?? ''}
                        onChange={(e) => updateCard(index, { ...card, title: e.target.value })}
                      />
                    </Field>
                    <Field label="Caption">
                      <textarea
                        className={inputClass}
                        rows={2}
                        value={card.description ?? ''}
                        onChange={(e) => updateCard(index, { ...card, description: e.target.value })}
                      />
                    </Field>
                    <Field label="Shop link (optional)">
                      <input
                        className={inputClass}
                        value={card.link ?? ''}
                        onChange={(e) => updateCard(index, { ...card, link: e.target.value })}
                        placeholder="#products"
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
