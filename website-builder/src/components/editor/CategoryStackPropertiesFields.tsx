import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { createDefaultCard } from '../../lib/cardDefaults'
import { createDefaultStackCategory } from '../../lib/categoryStackDefaults'
import type { Block, CardItem, TabCategory } from '../../types/builder'
import { ImageUploadField } from '../builder/ImageUploadField'
import { ColumnsInput } from './ColumnsInput'
import { ItemContentStyleFields } from './ItemContentStyleFields'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

interface CategoryStackPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function CategoryStackPropertiesFields({ block, onChange }: CategoryStackPropertiesFieldsProps) {
  const p = block.props
  const categories = p.stackCategories ?? []
  const [expandedCat, setExpandedCat] = useState<number | null>(categories.length > 0 ? 0 : null)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  const updateCategories = (next: TabCategory[]) => onChange({ stackCategories: next })

  const updateCategory = (index: number, cat: TabCategory) => {
    const next = [...categories]
    next[index] = cat
    updateCategories(next)
  }

  const removeCategory = (index: number) => {
    updateCategories(categories.filter((_, i) => i !== index))
    if (expandedCat === index) setExpandedCat(null)
    else if (expandedCat != null && expandedCat > index) setExpandedCat(expandedCat - 1)
  }

  const addCategory = () => {
    const next = [...categories, createDefaultStackCategory(`Cat ${categories.length + 1}`, 6)]
    updateCategories(next)
    setExpandedCat(next.length - 1)
  }

  const updateItem = (catIndex: number, itemIndex: number, item: CardItem) => {
    const cat = categories[catIndex]
    if (!cat) return
    const items = [...cat.items]
    items[itemIndex] = item
    updateCategory(catIndex, { ...cat, items })
  }

  const removeItem = (catIndex: number, itemIndex: number) => {
    const cat = categories[catIndex]
    if (!cat) return
    updateCategory(catIndex, { ...cat, items: cat.items.filter((_, i) => i !== itemIndex) })
    setExpandedItem(null)
  }

  const addItem = (catIndex: number) => {
    const cat = categories[catIndex]
    if (!cat) return
    const item = createDefaultCard({ title: 'New item', badge: cat.label })
    updateCategory(catIndex, { ...cat, items: [...cat.items, item] })
    setExpandedItem(item.id ?? null)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Category stack</p>
      <p className="text-xs text-gray-500">
        Each category is a horizontal row. Preview shows a subset; See all opens the full category page. Item click
        opens the item detail page (live site / preview).
      </p>

      <Field label="Section title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Browse collections" />
      </Field>

      <Field label="Section subtitle (optional)">
        <input className={inputClass} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>

      <ColumnsInput
        value={p.columns ?? 4}
        onChange={(columns) => onChange({ columns })}
        min={1}
        max={8}
        label="Items per row (preview)"
      />

      <Field label="See all button text">
        <input
          className={inputClass}
          value={p.stackSeeAllLabel ?? 'See all'}
          onChange={(e) => onChange({ stackSeeAllLabel: e.target.value })}
        />
      </Field>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Categories ({categories.length})
          </span>
          <button
            type="button"
            onClick={addCategory}
            className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <Plus className="h-3.5 w-3.5" /> Add category
          </button>
        </div>

        {categories.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-xs text-gray-400">
            Add Cat 1, Cat 2, etc. Each gets its own row with items.
          </p>
        )}

                      <div className="space-y-2">
          {categories.map((cat, ci) => {
            const catOpen = expandedCat === ci
            return (
              <div key={cat.id} className="rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-1 p-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium text-gray-800"
                    onClick={() => setExpandedCat(catOpen ? null : ci)}
                  >
                    {catOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{cat.label || `Category ${ci + 1}`}</span>
                    <span className="text-xs font-normal text-gray-400">({cat.items.length} items)</span>
                  </button>
                  <button
                    type="button"
                    title="Delete category"
                    className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => removeCategory(ci)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {catOpen && (
                  <div className="space-y-3 border-t border-gray-200 bg-white p-3">
                    <Field label="Category name">
                      <input
                        className={inputClass}
                        value={cat.label}
                        onChange={(e) => updateCategory(ci, { ...cat, label: e.target.value })}
                        placeholder="Cat 1"
                      />
                    </Field>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600">Items</span>
                        <button
                          type="button"
                          onClick={() => addItem(ci)}
                          className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                        >
                          <Plus className="h-3 w-3" /> Add item
                        </button>
                      </div>

                      <div className="space-y-2">
                        {cat.items.map((item, ii) => {
                          const itemKey = item.id ?? `${ci}-${ii}`
                          const itemOpen = expandedItem === itemKey
                          return (
                            <div key={itemKey} className="rounded-md border border-gray-100 bg-gray-50">
                              <div className="flex items-center gap-1 p-2">
                                <button
                                  type="button"
                                  className="flex min-w-0 flex-1 items-center gap-1 text-left text-xs font-medium text-gray-700"
                                  onClick={() => setExpandedItem(itemOpen ? null : itemKey)}
                                >
                                  {itemOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                  <span className="truncate">{item.title || `Item ${ii + 1}`}</span>
                                </button>
                                <button
                                  type="button"
                                  title="Delete item"
                                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                  onClick={() => removeItem(ci, ii)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              {itemOpen && (
                                <div className="space-y-2 border-t border-gray-100 bg-white p-2">
                                  <Field label="Title">
                                    <input className={inputClass} value={item.title} onChange={(e) => updateItem(ci, ii, { ...item, title: e.target.value })} />
                                  </Field>
                                  <Field label="Description">
                                    <textarea className={inputClass} rows={2} value={item.description ?? ''} onChange={(e) => updateItem(ci, ii, { ...item, description: e.target.value })} />
                                  </Field>
                                  <ImageUploadField label="Image" value={item.imageUrl} onChange={(url) => updateItem(ci, ii, { ...item, imageUrl: url })} />
                                  <Field label="Badge">
                                    <input className={inputClass} value={item.badge ?? ''} onChange={(e) => updateItem(ci, ii, { ...item, badge: e.target.value })} />
                                  </Field>
                                  <Field label="Price">
                                    <input className={inputClass} value={item.price ?? ''} onChange={(e) => updateItem(ci, ii, { ...item, price: e.target.value })} />
                                  </Field>
                                  <Field label="Button text">
                                    <input className={inputClass} value={item.buttonText ?? ''} onChange={(e) => updateItem(ci, ii, { ...item, buttonText: e.target.value })} />
                                  </Field>
                                  <ItemContentStyleFields style={item.contentStyle} onChange={(contentStyle) => updateItem(ci, ii, { ...item, contentStyle })} titleLabel="Title color" descriptionLabel="Description color" />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
