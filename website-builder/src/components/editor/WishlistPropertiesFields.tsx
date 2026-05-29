import { WISHLIST_DEFAULTS } from '../../lib/wishlistDefaults'
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

export function WishlistPropertiesFields({ block, onChange }: { block: Block; onChange: (p: Partial<Block['props']>) => void }) {
  const p = block.props
  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Wishlist</p>
      <Field label="Title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
      <Field label="Subtitle">
        <textarea className={inputClass} rows={2} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>
      <Field label="Layout">
        <select className={inputClass} value={p.wishlistLayout ?? WISHLIST_DEFAULTS.wishlistLayout} onChange={(e) => onChange({ wishlistLayout: e.target.value as 'grid' | 'list' })}>
          <option value="grid">Grid</option>
          <option value="list">List</option>
        </select>
      </Field>
      <ToggleField label="Show prices" checked={p.showWishlistPrices !== false} onChange={(v) => onChange({ showWishlistPrices: v })} />
      <CatalogProductsEditor block={block} onChange={onChange} />
    </div>
  )
}
