import { CART_DRAWER_DEFAULTS } from '../../lib/cartDrawerDefaults'
import type { Block } from '../../types/builder'

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

export function CartDrawerPropertiesFields({ block, onChange }: { block: Block; onChange: (p: Partial<Block['props']>) => void }) {
  const p = block.props
  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Cart drawer</p>
      <Field label="Drawer title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
      <Field label="Subtitle">
        <input className={inputClass} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>
      <Field label="Trigger button label">
        <input className={inputClass} value={p.buttonText ?? CART_DRAWER_DEFAULTS.buttonText} onChange={(e) => onChange({ buttonText: e.target.value })} />
      </Field>
      <Field label="Checkout button label">
        <input className={inputClass} value={p.buttonText2 ?? 'Checkout'} onChange={(e) => onChange({ buttonText2: e.target.value })} />
      </Field>
      <Field label="Slide from">
        <select className={inputClass} value={p.cartDrawerSide ?? 'right'} onChange={(e) => onChange({ cartDrawerSide: e.target.value as 'left' | 'right' })}>
          <option value="right">Right</option>
          <option value="left">Left</option>
        </select>
      </Field>
      <Field label="Theme">
        <select className={inputClass} value={p.cartDrawerTheme ?? 'light'} onChange={(e) => onChange({ cartDrawerTheme: e.target.value as 'light' | 'dark' })}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </Field>
      <ToggleField label="Open drawer in editor preview" checked={p.cartDrawerPreviewOpen !== false} onChange={(v) => onChange({ cartDrawerPreviewOpen: v })} />
      <ToggleField label="Show subtotal" checked={p.showCartDrawerSubtotal !== false} onChange={(v) => onChange({ showCartDrawerSubtotal: v })} />
      <ToggleField label="Show checkout button" checked={p.showCartDrawerCheckout !== false} onChange={(v) => onChange({ showCartDrawerCheckout: v })} />
    </div>
  )
}
