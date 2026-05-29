import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { CAROUSEL_DISPLAY_DEFAULTS } from '../../lib/carouselDefaults'
import { createDefaultBannerSlide } from '../../lib/bannerSliderDefaults'
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

interface HeroBannerSliderPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function HeroBannerSliderPropertiesFields({ block, onChange }: HeroBannerSliderPropertiesFieldsProps) {
  const p = block.props
  const slides = p.cards ?? []
  const [expanded, setExpanded] = useState<number | null>(slides.length > 0 ? 0 : null)

  const updateSlides = (next: CardItem[]) => onChange({ cards: next })

  const updateSlide = (index: number, slide: CardItem) => {
    const next = [...slides]
    next[index] = slide
    updateSlides(next)
  }

  const removeSlide = (index: number) => {
    updateSlides(slides.filter((_, i) => i !== index))
    if (expanded === index) setExpanded(null)
    else if (expanded != null && expanded > index) setExpanded(expanded - 1)
  }

  const addSlide = () => {
    const next = [...slides, createDefaultBannerSlide({ title: `Slide ${slides.length + 1}` })]
    updateSlides(next)
    setExpanded(next.length - 1)
  }

  const showArrows = p.showSlideArrows ?? CAROUSEL_DISPLAY_DEFAULTS.showSlideArrows
  const showDots = p.showSlideDots ?? CAROUSEL_DISPLAY_DEFAULTS.showSlideDots
  const showCounter = p.showSlideCounter ?? CAROUSEL_DISPLAY_DEFAULTS.showSlideCounter

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Banner slider</p>
      <p className="text-xs text-gray-500">Full-width hero slides with background image, headline, and button.</p>

      <Field label="Overlay darkness">
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={p.overlayOpacity ?? 0.45}
          onChange={(e) => onChange({ overlayOpacity: parseFloat(e.target.value) })}
          className="w-full"
        />
      </Field>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Display</p>
        <ToggleField label="Show prev/next arrows" checked={showArrows} onChange={(v) => onChange({ showSlideArrows: v })} />
        <ToggleField label="Show dot indicators" checked={showDots} onChange={(v) => onChange({ showSlideDots: v })} />
        <ToggleField label="Show slide counter" checked={showCounter} onChange={(v) => onChange({ showSlideCounter: v })} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Slides ({slides.length})</span>
          <button
            type="button"
            onClick={addSlide}
            className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <Plus className="h-3.5 w-3.5" /> Add slide
          </button>
        </div>

        <ul className="space-y-2">
          {slides.map((slide, index) => {
            const open = expanded === index
            return (
              <li key={slide.id ?? index} className="rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-1 p-2">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : index)}
                    className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium text-gray-800"
                  >
                    {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{slide.title || `Slide ${index + 1}`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSlide(index)}
                    title="Delete slide"
                    className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete slide"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {open && (
                  <div className="space-y-3 border-t border-gray-200 bg-white p-3">
                    <ImageUploadField
                      label="Background image"
                      value={slide.imageUrl}
                      onChange={(url) => updateSlide(index, { ...slide, imageUrl: url })}
                    />
                    <Field label="Headline">
                      <input
                        className={inputClass}
                        value={slide.title ?? ''}
                        onChange={(e) => updateSlide(index, { ...slide, title: e.target.value })}
                      />
                    </Field>
                    <Field label="Subtitle">
                      <textarea
                        className={inputClass}
                        rows={2}
                        value={slide.description ?? ''}
                        onChange={(e) => updateSlide(index, { ...slide, description: e.target.value })}
                      />
                    </Field>
                    <Field label="Button text">
                      <input
                        className={inputClass}
                        value={slide.buttonText ?? ''}
                        onChange={(e) => updateSlide(index, { ...slide, buttonText: e.target.value })}
                        placeholder="Get Started"
                      />
                    </Field>
                    <Field label="Button link">
                      <input
                        className={inputClass}
                        value={slide.link ?? ''}
                        onChange={(e) => updateSlide(index, { ...slide, link: e.target.value })}
                        placeholder="#products"
                      />
                    </Field>
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        {slides.length === 0 && (
          <p className="py-4 text-center text-xs text-gray-400">Click &ldquo;Add slide&rdquo; to create your first banner.</p>
        )}
      </div>
    </div>
  )
}
