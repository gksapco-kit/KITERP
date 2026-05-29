import type { Block, BlockStyles } from '../../types/builder'
import { STICKY_ADD_TO_CART_DEFAULTS } from '../../lib/stickyAddToCartDefaults'
import { ImageUploadField } from '../builder/ImageUploadField'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
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

function ColorInput({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string
  value?: string
  fallback: string
  onChange: (v: string) => void
}) {
  const hex = value?.startsWith('#') ? value : fallback
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input type="color" className="h-10 w-10 shrink-0 rounded border" value={hex} onChange={(e) => onChange(e.target.value)} />
        <input className={inputClass} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={fallback} />
      </div>
    </Field>
  )
}

interface StickyAddToCartPropertiesFieldsProps {
  block: Block
  catalog: { products: { id: string; name: string }[]; services: { id: string; name: string }[] }
  onChange: (props: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<BlockStyles>) => void
}

export function StickyAddToCartPropertiesFields({
  block,
  catalog,
  onChange,
  onStylesChange,
}: StickyAddToCartPropertiesFieldsProps) {
  const p = block.props
  const s = block.styles
  const linkedType = p.linkedItemType ?? STICKY_ADD_TO_CART_DEFAULTS.linkedItemType
  const catalogItems = linkedType === 'service' ? catalog.services : catalog.products

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Sticky Add to Cart</p>

      <Field label="Link to catalog product (optional)" hint="When set, name, price, and image come from the catalog">
        <select
          className={inputClass}
          value={p.linkedItemId ?? ''}
          onChange={(e) => onChange({ linkedItemId: e.target.value || undefined })}
        >
          <option value="">Manual product details</option>
          {catalogItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>

      {!p.linkedItemId && (
        <>
          <Field label="Product name">
            <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
          </Field>
          <Field label="Subtitle (optional)">
            <input className={inputClass} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
          </Field>
          <ImageUploadField label="Product image" value={p.imageUrl ?? ''} onChange={(imageUrl) => onChange({ imageUrl })} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Price">
              <input
                className={inputClass}
                value={p.productPrice ?? ''}
                onChange={(e) => onChange({ productPrice: e.target.value })}
                placeholder="$79.00"
              />
            </Field>
            <Field label="Compare at (optional)">
              <input
                className={inputClass}
                value={p.compareAtPrice ?? ''}
                onChange={(e) => onChange({ compareAtPrice: e.target.value })}
                placeholder="$99.00"
              />
            </Field>
          </div>
        </>
      )}

      <Field label="Button label">
        <input
          className={inputClass}
          value={p.buttonText ?? ''}
          onChange={(e) => onChange({ buttonText: e.target.value })}
          placeholder="Add to cart"
        />
      </Field>

      <ToggleField
        label="Show product image"
        checked={p.showStickyAtcImage !== false}
        onChange={(v) => onChange({ showStickyAtcImage: v })}
      />

      <ToggleField
        label="Show quantity selector"
        checked={p.showStickyAtcQuantity !== false}
        onChange={(v) => onChange({ showStickyAtcQuantity: v })}
      />

      <ToggleField
        label="Reveal after scrolling"
        checked={p.stickyAtcRevealOnScroll !== false}
        onChange={(v) => onChange({ stickyAtcRevealOnScroll: v })}
      />

      {p.stickyAtcRevealOnScroll !== false && (
        <Field label="Scroll threshold (px)">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={p.stickyAtcScrollThreshold ?? STICKY_ADD_TO_CART_DEFAULTS.stickyAtcScrollThreshold}
            onChange={(e) => onChange({ stickyAtcScrollThreshold: Number(e.target.value) || 0 })}
          />
        </Field>
      )}

      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Button appearance</p>

      <ColorInput
        label="Button background"
        value={s.backgroundColor}
        fallback="#111827"
        onChange={(backgroundColor) => onStylesChange({ backgroundColor })}
      />

      <ColorInput
        label="Button text color"
        value={s.textColor}
        fallback="#ffffff"
        onChange={(textColor) => onStylesChange({ textColor })}
      />

      <Field label="Button border radius">
        <input
          className={inputClass}
          value={s.borderRadius ?? ''}
          onChange={(e) => onStylesChange({ borderRadius: e.target.value || undefined })}
          placeholder="12px"
        />
      </Field>
    </div>
  )
}
