import { resolveBlockProducts } from '../../lib/productDefaults'
import { BUNDLE_BUILDER_DEFAULTS } from '../../lib/bundleBuilderDefaults'
import { useBuilderStore } from '../../store/useBuilderStore'
import type { Block } from '../../types/builder'
import { CatalogProductsEditor } from './CatalogProductsEditor'

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

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

export function BundleBuilderPropertiesFields({ block, onChange }: { block: Block; onChange: (p: Partial<Block['props']>) => void }) {
  const p = block.props
  const catalog = useBuilderStore((s) => s.catalog.products)
  const products = resolveBlockProducts(p, catalog)
  const previewIds = p.bundleBuilderPreviewSelectedIds ?? []

  const togglePreview = (id: string) => {
    const next = previewIds.includes(id) ? previewIds.filter((x) => x !== id) : [...previewIds, id]
    onChange({ bundleBuilderPreviewSelectedIds: next })
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Bundle builder</p>
      <Field label="Title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
      <Field label="Subtitle">
        <textarea className={inputClass} rows={2} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>
      <Field label="Min items">
        <input type="number" min={1} max={6} className={inputClass} value={p.bundleBuilderMinItems ?? BUNDLE_BUILDER_DEFAULTS.bundleBuilderMinItems} onChange={(e) => onChange({ bundleBuilderMinItems: Number(e.target.value) })} />
      </Field>
      <Field label="Max items">
        <input type="number" min={1} max={8} className={inputClass} value={p.bundleBuilderMaxItems ?? BUNDLE_BUILDER_DEFAULTS.bundleBuilderMaxItems} onChange={(e) => onChange({ bundleBuilderMaxItems: Number(e.target.value) })} />
      </Field>
      <Field label="Discount percent">
        <input type="number" min={0} max={50} className={inputClass} value={p.bundleBuilderDiscountPercent ?? BUNDLE_BUILDER_DEFAULTS.bundleBuilderDiscountPercent} onChange={(e) => onChange({ bundleBuilderDiscountPercent: Number(e.target.value) })} />
      </Field>
      <Field label="CTA button">
        <input className={inputClass} value={p.buttonText ?? ''} onChange={(e) => onChange({ buttonText: e.target.value })} />
      </Field>
      <ToggleField label="Show savings" checked={p.showBundleBuilderSavings !== false} onChange={(v) => onChange({ showBundleBuilderSavings: v })} />
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Editor preview selection</p>
        <ul className="space-y-1">
          {products.map((prod) => (
            <li key={prod.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50">
                <input type="checkbox" checked={previewIds.includes(prod.id)} onChange={() => togglePreview(prod.id)} className="rounded" />
                {prod.name}
              </label>
            </li>
          ))}
        </ul>
      </div>
      <CatalogProductsEditor block={block} onChange={onChange} />
    </div>
  )
}
