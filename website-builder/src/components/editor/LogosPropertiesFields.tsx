import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import {
  BRAND_IMAGE_FIT_OPTIONS,
  BRAND_IMAGE_POSITION_OPTIONS,
  clampBrandImageZoom,
  DEFAULT_BRAND_IMAGE_FIT,
  DEFAULT_BRAND_IMAGE_ZOOM,
  MAX_BRAND_IMAGE_ZOOM,
  MIN_BRAND_IMAGE_ZOOM,
} from '../../lib/brandImageStyle'
import { clampIntervalSeconds, normalizeLogosLayout } from '../../lib/sectionSlider'
import { createDefaultLogo, LOGOS_DISPLAY_DEFAULTS, resolveLogoItems } from '../../lib/logosDefaults'
import type { Block, LogoItem } from '../../types/builder'
import { ImageUploadField } from '../builder/ImageUploadField'
import { SliderLayoutFields } from './SliderLayoutFields'

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
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

interface LogosPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function LogosPropertiesFields({ block, onChange }: LogosPropertiesFieldsProps) {
  const p = block.props
  const items = p.logoItems?.length ? p.logoItems : resolveLogoItems(p)
  const [expanded, setExpanded] = useState<number | null>(items.length > 0 ? 0 : null)
  const layout = normalizeLogosLayout(p.logosLayout ?? LOGOS_DISPLAY_DEFAULTS.logosLayout)

  const updateItems = (next: LogoItem[]) => onChange({ logoItems: next, logos: undefined })

  const updateItem = (index: number, item: LogoItem) => {
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
    const copy = { ...item, id: uuid(), name: item.name ? `${item.name} (copy)` : '' }
    const next = [...items]
    next.splice(index + 1, 0, copy)
    updateItems(next)
    setExpanded(index + 1)
  }

  const addLogo = () => {
    const next = [...items, createDefaultLogo({ name: `Brand ${items.length + 1}` })]
    updateItems(next)
    setExpanded(next.length - 1)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Trusted By</p>

      <Field label="Section title (optional)">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Trusted By" />
      </Field>

      <Field label="Section subtitle (optional)">
        <input className={inputClass} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>

      <SliderLayoutFields
        layout={layout}
        layoutOptions={[
          { value: 'manualSlider', label: 'Logo carousel (arrows + dots)' },
          { value: 'autoSlider', label: 'Auto carousel (continuous)' },
        ]}
        onLayoutChange={(logosLayout) =>
          onChange({ logosLayout: logosLayout as 'manualSlider' | 'autoSlider' })
        }
        intervalSeconds={p.sliderIntervalSeconds}
        onIntervalChange={(sliderIntervalSeconds) =>
          onChange({ sliderIntervalSeconds: clampIntervalSeconds(sliderIntervalSeconds) })
        }
        columns={p.columns ?? 6}
        onColumnsChange={(columns) => onChange({ columns })}
        columnsMin={2}
        columnsMax={6}
        showColumnsWhen={['manualSlider']}
      />

      <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">All brands</p>
        <ToggleField
          label="Show brand tiles"
          checked={p.logosShowBrandTile ?? LOGOS_DISPLAY_DEFAULTS.logosShowBrandTile}
          onChange={(logosShowBrandTile) => onChange({ logosShowBrandTile })}
        />
        <ToggleField
          label="Show brand names"
          checked={p.logosShowBrandNames ?? LOGOS_DISPLAY_DEFAULTS.logosShowBrandNames}
          onChange={(logosShowBrandNames) => onChange({ logosShowBrandNames })}
        />
        <ToggleField
          label="Grayscale images (color on hover)"
          checked={p.logosGrayscale ?? LOGOS_DISPLAY_DEFAULTS.logosGrayscale}
          onChange={(v) => onChange({ logosGrayscale: v })}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Brands ({items.length})</span>
          <button type="button" onClick={addLogo} className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100">
            <Plus className="h-3.5 w-3.5" /> Add brand
          </button>
        </div>

        <ul className="space-y-2">
          {items.map((item, i) => {
            const isOpen = expanded === i
            const brandImage = item.imageUrl || item.backgroundImage || ''
            return (
              <li key={item.id ?? i} className="rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-1 p-2">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium text-gray-800" onClick={() => setExpanded(isOpen ? null : i)}>
                    {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{item.name || `Brand ${i + 1}`}</span>
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
                    <Field label="Brand name">
                      <input className={inputClass} value={item.name} onChange={(e) => updateItem(i, { ...item, name: e.target.value })} />
                    </Field>

                    <ImageUploadField
                      label="Brand image"
                      value={brandImage}
                      onChange={(imageUrl) =>
                        updateItem(i, {
                          ...item,
                          imageUrl,
                          backgroundImage: imageUrl,
                        })
                      }
                    />

                    {brandImage && (
                      <>
                        <Field label="Image fit">
                          <select
                            className={inputClass}
                            value={item.imageFit ?? DEFAULT_BRAND_IMAGE_FIT}
                            onChange={(e) =>
                              updateItem(i, { ...item, imageFit: e.target.value as 'contain' | 'cover' })
                            }
                          >
                            {BRAND_IMAGE_FIT_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        {(item.imageFit ?? DEFAULT_BRAND_IMAGE_FIT) === 'cover' && (
                          <Field label="Image focus">
                            <select
                              className={inputClass}
                              value={item.imagePosition ?? 'center'}
                              onChange={(e) => updateItem(i, { ...item, imagePosition: e.target.value })}
                            >
                              {BRAND_IMAGE_POSITION_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </Field>
                        )}
                        <Field label={`Image zoom (${item.imageZoom ?? DEFAULT_BRAND_IMAGE_ZOOM}%)`}>
                          <input
                            type="range"
                            min={MIN_BRAND_IMAGE_ZOOM}
                            max={MAX_BRAND_IMAGE_ZOOM}
                            step={5}
                            value={item.imageZoom ?? DEFAULT_BRAND_IMAGE_ZOOM}
                            onChange={(e) =>
                              updateItem(i, { ...item, imageZoom: clampBrandImageZoom(Number(e.target.value)) })
                            }
                            className="w-full"
                          />
                        </Field>
                      </>
                    )}

                    <Field label="Link (optional)">
                      <input className={inputClass} value={item.link ?? ''} onChange={(e) => updateItem(i, { ...item, link: e.target.value })} placeholder="https://..." />
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
