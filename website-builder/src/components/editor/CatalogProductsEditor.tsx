import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { createDefaultProduct, resolveBlockProducts } from '../../lib/productDefaults'
import { useBuilderStore } from '../../store/useBuilderStore'
import type { Block, CatalogProduct } from '../../types/builder'
import { ImageUploadField } from '../builder/ImageUploadField'

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

interface CatalogProductsEditorProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
  maxProducts?: number
}

export function CatalogProductsEditor({ block, onChange, maxProducts }: CatalogProductsEditorProps) {
  const catalogProducts = useBuilderStore((s) => s.catalog.products)
  const products = resolveBlockProducts(block.props, catalogProducts).slice(0, maxProducts ?? 12)
  const [expanded, setExpanded] = useState<number | null>(products.length > 0 ? 0 : null)

  const updateProducts = (next: CatalogProduct[]) => onChange({ products: next })

  const updateProduct = (index: number, product: CatalogProduct) => {
    const next = [...products]
    next[index] = product
    updateProducts(next)
  }

  const removeProduct = (index: number) => {
    updateProducts(products.filter((_, i) => i !== index))
    if (expanded === index) setExpanded(null)
    else if (expanded != null && expanded > index) setExpanded(expanded - 1)
  }

  const duplicateProduct = (index: number) => {
    const item = products[index]
    if (!item) return
    const copy = { ...item, id: uuid(), name: item.name ? `${item.name} (copy)` : '' }
    const next = [...products]
    next.splice(index + 1, 0, copy)
    updateProducts(next)
    setExpanded(index + 1)
  }

  const addProduct = () => {
    if (maxProducts != null && products.length >= maxProducts) return
    const next = [...products, createDefaultProduct()]
    updateProducts(next)
    setExpanded(next.length - 1)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Products ({products.length})</span>
        <button
          type="button"
          onClick={addProduct}
          disabled={maxProducts != null && products.length >= maxProducts}
          className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      <ul className="space-y-2">
        {products.map((product, i) => {
          const isOpen = expanded === i
          return (
            <li key={product.id} className="rounded-lg border border-gray-200 bg-gray-50">
              <div className="flex items-center gap-1 p-2">
                <button type="button" className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium" onClick={() => setExpanded(isOpen ? null : i)}>
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="truncate">{product.name || `Product ${i + 1}`}</span>
                </button>
                <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100" onClick={() => duplicateProduct(i)}>
                  <Copy className="h-4 w-4" />
                </button>
                <button type="button" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => removeProduct(i)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {isOpen && (
                <div className="space-y-3 border-t border-gray-200 bg-white p-3">
                  <Field label="Name">
                    <input className={inputClass} value={product.name} onChange={(e) => updateProduct(i, { ...product, name: e.target.value })} />
                  </Field>
                  <Field label="Description">
                    <textarea className={inputClass} rows={2} value={product.description} onChange={(e) => updateProduct(i, { ...product, description: e.target.value })} />
                  </Field>
                  <ImageUploadField label="Image" value={product.imageUrl} onChange={(url) => updateProduct(i, { ...product, imageUrl: url })} />
                  <Field label="Price ($)">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className={inputClass}
                      value={product.price}
                      onChange={(e) => updateProduct(i, { ...product, price: Math.max(0, parseFloat(e.target.value) || 0) })}
                    />
                  </Field>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
