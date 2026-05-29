import { ImageUploadField } from '../builder/ImageUploadField'
import type { Block } from '../../types/builder'

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

const COMMERCE_BANNER_TYPES = new Set([
  'couponBanner',
  'flashSaleBanner',
  'splitCategoryBanner',
  'offerStripBanner',
  'trustStripBanner',
  'groceryDealBanner',
  'fashionPromoBanner',
])

export function isCommerceBannerType(type: string): boolean {
  return COMMERCE_BANNER_TYPES.has(type)
}

interface CommerceBannerPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function CommerceBannerPropertiesFields({ block, onChange }: CommerceBannerPropertiesFieldsProps) {
  const { type, props: p } = block
  const features = p.features ?? []

  const updateFeature = (index: number, patch: Partial<{ title: string; description: string }>) => {
    const next = features.map((f, i) => (i === index ? { ...f, ...patch } : f))
    onChange({ features: next })
  }

  const showTextFields = type !== 'trustStripBanner'
  const showButton = type !== 'trustStripBanner'

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Banner content</p>
      <p className="text-xs text-gray-400">Double-click text on the canvas to edit inline where supported.</p>

      {showTextFields && (
        <>
          <Field label="Headline">
            <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
          </Field>
          <Field label="Description">
            <textarea
              className={inputClass}
              rows={2}
              value={p.subtitle ?? ''}
              onChange={(e) => onChange({ subtitle: e.target.value })}
            />
          </Field>
        </>
      )}

      {p.badge !== undefined && type !== 'offerStripBanner' && (
        <Field label="Badge label">
          <input className={inputClass} value={p.badge ?? ''} onChange={(e) => onChange({ badge: e.target.value })} />
        </Field>
      )}

      {type === 'couponBanner' && (
        <Field label="Coupon code">
          <input
            className={`${inputClass} font-mono uppercase tracking-wider`}
            value={p.couponCode ?? ''}
            onChange={(e) => onChange({ couponCode: e.target.value.toUpperCase() })}
            placeholder="SAVE20"
          />
        </Field>
      )}

      {type === 'flashSaleBanner' && (
        <Field label="Ends at (display text)">
          <input
            className={inputClass}
            value={p.endsAt ?? ''}
            onChange={(e) => onChange({ endsAt: e.target.value })}
            placeholder="Sunday 11:59 PM"
          />
        </Field>
      )}

      {(type === 'offerStripBanner' || type === 'groceryDealBanner') && (
        <Field label="Icon (emoji)">
          <input className={inputClass} value={p.icon ?? ''} onChange={(e) => onChange({ icon: e.target.value })} placeholder="🛒" />
        </Field>
      )}

      {type === 'splitCategoryBanner' && (
        <>
          <Field label="Image side">
            <select
              className={inputClass}
              value={p.splitImageSide ?? 'right'}
              onChange={(e) => onChange({ splitImageSide: e.target.value as 'left' | 'right' })}
            >
              <option value="left">Image left</option>
              <option value="right">Image right</option>
            </select>
          </Field>
          <ImageUploadField label="Category image" value={p.imageUrl} onChange={(url) => onChange({ imageUrl: url })} />
        </>
      )}

      {(type === 'groceryDealBanner' || type === 'fashionPromoBanner') && (
        <ImageUploadField label="Banner image" value={p.imageUrl} onChange={(url) => onChange({ imageUrl: url })} />
      )}

      {type === 'fashionPromoBanner' && (
        <Field label="Image overlay (0–1)">
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            className={inputClass}
            value={p.overlayOpacity ?? 0.45}
            onChange={(e) => onChange({ overlayOpacity: Number(e.target.value) })}
          />
        </Field>
      )}

      {showButton && (
        <>
          <Field label="Button text">
            <input className={inputClass} value={p.buttonText ?? ''} onChange={(e) => onChange({ buttonText: e.target.value })} />
          </Field>
          <Field label="Button link">
            <input
              className={inputClass}
              value={p.buttonLink ?? ''}
              onChange={(e) => onChange({ buttonLink: e.target.value })}
              placeholder="#products"
            />
          </Field>
        </>
      )}

      {type === 'trustStripBanner' && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Trust points</p>
          {features.map((f, i) => (
            <div key={i} className="rounded-lg border border-gray-100 p-3 space-y-2">
              <p className="text-xs font-medium text-gray-500">Item {i + 1}</p>
              <input
                className={inputClass}
                value={f.title}
                onChange={(e) => updateFeature(i, { title: e.target.value })}
                placeholder="Title"
              />
              <input
                className={inputClass}
                value={f.description ?? ''}
                onChange={(e) => updateFeature(i, { description: e.target.value })}
                placeholder="Description"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
