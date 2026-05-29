import { INFINITE_SCROLL_DEFAULTS } from '../../lib/infiniteScrollDefaults'
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

export function InfiniteScrollPropertiesFields({ block, onChange }: { block: Block; onChange: (p: Partial<Block['props']>) => void }) {
  const p = block.props
  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Infinite scroll</p>
      <Field label="Title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
      <Field label="Subtitle">
        <textarea className={inputClass} rows={2} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>
      <Field label="Load trigger">
        <select className={inputClass} value={p.infiniteScrollTrigger ?? 'button'} onChange={(e) => onChange({ infiniteScrollTrigger: e.target.value as 'button' | 'scroll' })}>
          <option value="button">Load more button</option>
          <option value="scroll">Scroll sentinel</option>
        </select>
      </Field>
      <Field label="Initial products shown">
        <input type="number" min={1} max={12} className={inputClass} value={p.infiniteScrollInitialCount ?? INFINITE_SCROLL_DEFAULTS.infiniteScrollInitialCount} onChange={(e) => onChange({ infiniteScrollInitialCount: Number(e.target.value) })} />
      </Field>
      <Field label="Products per load">
        <input type="number" min={1} max={12} className={inputClass} value={p.infiniteScrollLoadCount ?? INFINITE_SCROLL_DEFAULTS.infiniteScrollLoadCount} onChange={(e) => onChange({ infiniteScrollLoadCount: Number(e.target.value) })} />
      </Field>
      <Field label="Columns">
        <input type="number" min={2} max={4} className={inputClass} value={p.infiniteScrollColumns ?? INFINITE_SCROLL_DEFAULTS.infiniteScrollColumns} onChange={(e) => onChange({ infiniteScrollColumns: Number(e.target.value) })} />
      </Field>
      <Field label="Load more button label">
        <input className={inputClass} value={p.buttonText ?? ''} onChange={(e) => onChange({ buttonText: e.target.value })} />
      </Field>
      <ToggleField label="Show loading spinner" checked={p.showInfiniteScrollLoader !== false} onChange={(v) => onChange({ showInfiniteScrollLoader: v })} />
      <ToggleField label="Show prices" checked={p.showInfiniteScrollPrices !== false} onChange={(v) => onChange({ showInfiniteScrollPrices: v })} />
      <CatalogProductsEditor block={block} onChange={onChange} />
    </div>
  )
}
