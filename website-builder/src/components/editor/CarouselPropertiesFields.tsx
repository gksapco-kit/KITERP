import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { CAROUSEL_DISPLAY_DEFAULTS, createDefaultSlide } from '../../lib/carouselDefaults'
import type { Block, CardItem } from '../../types/builder'
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

interface CarouselPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function CarouselPropertiesFields({ block, onChange }: CarouselPropertiesFieldsProps) {
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
    if (cards.length <= 1) return
    updateCards(cards.filter((_, i) => i !== index))
    if (expanded === index) setExpanded(null)
    else if (expanded != null && expanded > index) setExpanded(expanded - 1)
  }

  const addSlide = () => {
    const next = [...cards, createDefaultSlide({ title: `Slide ${cards.length + 1}` })]
    updateCards(next)
    setExpanded(next.length - 1)
  }

  const showTitle = p.showSlideTitle ?? CAROUSEL_DISPLAY_DEFAULTS.showSlideTitle
  const showCaption = p.showSlideCaption ?? CAROUSEL_DISPLAY_DEFAULTS.showSlideCaption
  const showArrows = p.showSlideArrows ?? CAROUSEL_DISPLAY_DEFAULTS.showSlideArrows
  const showDots = p.showSlideDots ?? CAROUSEL_DISPLAY_DEFAULTS.showSlideDots
  const showCounter = p.showSlideCounter ?? CAROUSEL_DISPLAY_DEFAULTS.showSlideCounter

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Carousel</p>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Display</p>
        <ToggleField label="Show slide title" checked={showTitle} onChange={(v) => onChange({ showSlideTitle: v })} />
        <ToggleField label="Show caption" checked={showCaption} onChange={(v) => onChange({ showSlideCaption: v })} />
        <ToggleField label="Show prev/next arrows" checked={showArrows} onChange={(v) => onChange({ showSlideArrows: v })} />
        <ToggleField label="Show dot indicators" checked={showDots} onChange={(v) => onChange({ showSlideDots: v })} />
        <ToggleField label="Show slide counter" checked={showCounter} onChange={(v) => onChange({ showSlideCounter: v })} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Slides ({cards.length})</span>
          <button
            type="button"
            onClick={addSlide}
            className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <Plus className="h-3.5 w-3.5" /> Add slide
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
                    <span className="truncate">{card.title || `Slide ${index + 1}`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCard(index)}
                    disabled={cards.length <= 1}
                    title={cards.length <= 1 ? 'Keep at least one slide' : 'Delete slide'}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Remove slide"
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
                        placeholder="Slide title"
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
