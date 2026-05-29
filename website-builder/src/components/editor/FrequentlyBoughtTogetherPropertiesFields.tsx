import { resolveBlockProducts } from '../../lib/productDefaults'
import { FREQUENTLY_BOUGHT_TOGETHER_DEFAULTS } from '../../lib/frequentlyBoughtTogetherDefaults'
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

export function FrequentlyBoughtTogetherPropertiesFields({ block, onChange }: { block: Block; onChange: (p: Partial<Block['props']>) => void }) {
  const p = block.props
  const catalog = useBuilderStore((s) => s.catalog.products)
  const products = resolveBlockProducts(p, catalog)

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Frequently bought together</p>
      <Field label="Title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
      <Field label="Subtitle">
        <textarea className={inputClass} rows={2} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>
      <Field label="CTA button">
        <input className={inputClass} value={p.buttonText ?? ''} onChange={(e) => onChange({ buttonText: e.target.value })} />
      </Field>
      <Field label="Layout">
        <select className={inputClass} value={p.bundleLayout ?? 'horizontal'} onChange={(e) => onChange({ bundleLayout: e.target.value as 'horizontal' | 'stacked' })}>
          <option value="horizontal">Horizontal</option>
          <option value="stacked">Stacked</option>
        </select>
      </Field>
      <Field label="Highlighted product">
        <select className={inputClass} value={p.bundleMainProductId ?? ''} onChange={(e) => onChange({ bundleMainProductId: e.target.value })}>
          {products.map((prod) => (
            <option key={prod.id} value={prod.id}>
              {prod.name}
            </option>
          ))}
        </select>
      </Field>
      <ToggleField label="Show savings" checked={p.showBundleSavings !== false} onChange={(v) => onChange({ showBundleSavings: v })} />
      <Field label="Savings percent">
        <input type="number" min={0} max={90} className={inputClass} value={p.bundleSavingsPercent ?? FREQUENTLY_BOUGHT_TOGETHER_DEFAULTS.bundleSavingsPercent} onChange={(e) => onChange({ bundleSavingsPercent: Number(e.target.value) })} />
      </Field>
      <Field label="Savings label">
        <input className={inputClass} value={p.bundleSavingsLabel ?? ''} onChange={(e) => onChange({ bundleSavingsLabel: e.target.value })} placeholder="Save {percent}% when bought together" />
      </Field>
      <CatalogProductsEditor block={block} onChange={onChange} maxProducts={5} />
    </div>
  )
}
