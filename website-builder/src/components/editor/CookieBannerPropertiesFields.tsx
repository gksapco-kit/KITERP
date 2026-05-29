import type { Block, BlockStyles } from '../../types/builder'
import type { CookieBannerLayout, CookieBannerPosition } from '../../lib/cookieBannerStyles'

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
        <input
          className={inputClass}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
        />
      </div>
    </Field>
  )
}

interface CookieBannerPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<BlockStyles>) => void
}

export function CookieBannerPropertiesFields({ block, onChange, onStylesChange }: CookieBannerPropertiesFieldsProps) {
  const p = block.props
  const s = block.styles
  const layout = p.cookieBannerLayout ?? 'bar'
  const isFloating = layout === 'floating'

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Cookie Banner</p>

      <Field label="Layout">
        <select
          className={inputClass}
          value={layout}
          onChange={(e) => onChange({ cookieBannerLayout: e.target.value as CookieBannerLayout })}
        >
          <option value="bar">Full-width bottom bar</option>
          <option value="floating">Floating card</option>
        </select>
      </Field>

      {isFloating && (
        <Field label="Card position">
          <select
            className={inputClass}
            value={p.cookieBannerPosition ?? 'bottom-center'}
            onChange={(e) => onChange({ cookieBannerPosition: e.target.value as CookieBannerPosition })}
          >
            <option value="bottom-left">Bottom left</option>
            <option value="bottom-center">Bottom center</option>
            <option value="bottom-right">Bottom right</option>
          </select>
        </Field>
      )}

      <Field label="Message">
        <textarea
          className={inputClass}
          rows={3}
          value={p.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="We use cookies to improve your experience…"
        />
      </Field>

      <Field label="Details (optional)">
        <textarea
          className={inputClass}
          rows={2}
          value={p.subtitle ?? ''}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="By clicking Accept, you agree…"
        />
      </Field>

      <Field label="Accept button">
        <input
          className={inputClass}
          value={p.buttonText ?? ''}
          onChange={(e) => onChange({ buttonText: e.target.value })}
          placeholder="Accept all"
        />
      </Field>

      <Field label="Show reject button">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={p.showCookieReject !== false}
            onChange={(e) => onChange({ showCookieReject: e.target.checked })}
          />
          Display reject / decline button
        </label>
      </Field>

      {p.showCookieReject !== false && (
        <Field label="Reject button label">
          <input
            className={inputClass}
            value={p.buttonText2 ?? ''}
            onChange={(e) => onChange({ buttonText2: e.target.value })}
            placeholder="Reject"
          />
        </Field>
      )}

      <Field label="Show privacy policy link">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={p.showCookiePolicyLink !== false}
            onChange={(e) => onChange({ showCookiePolicyLink: e.target.checked })}
          />
          Display policy link
        </label>
      </Field>

      {p.showCookiePolicyLink !== false && (
        <>
          <Field label="Policy link text">
            <input
              className={inputClass}
              value={p.cookiePolicyLinkText ?? ''}
              onChange={(e) => onChange({ cookiePolicyLinkText: e.target.value })}
              placeholder="Privacy policy"
            />
          </Field>
          <Field label="Policy link URL">
            <input
              className={inputClass}
              value={p.buttonLink ?? ''}
              onChange={(e) => onChange({ buttonLink: e.target.value })}
              placeholder="#privacy or /site/privacy"
            />
          </Field>
        </>
      )}

      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Appearance</p>

      <ColorInput
        label="Background"
        value={s.backgroundColor}
        fallback="#ffffff"
        onChange={(backgroundColor) => onStylesChange({ backgroundColor })}
      />

      <ColorInput
        label="Text color"
        value={s.textColor}
        fallback="#1f2937"
        onChange={(textColor) => onStylesChange({ textColor })}
      />

      <ColorInput
        label="Accept button color"
        value={s.gradientFrom}
        fallback="#4f46e5"
        onChange={(gradientFrom) => onStylesChange({ gradientFrom })}
      />

      <Field label="Padding">
        <input
          className={inputClass}
          value={s.padding ?? ''}
          onChange={(e) => onStylesChange({ padding: e.target.value || undefined })}
          placeholder="20px 24px"
        />
      </Field>

      <Field label="Border radius">
        <input
          className={inputClass}
          value={s.borderRadius ?? ''}
          onChange={(e) => onStylesChange({ borderRadius: e.target.value || undefined })}
          placeholder="12px"
        />
      </Field>

      <Field label="Shadow">
        <input
          className={inputClass}
          value={s.boxShadow ?? ''}
          onChange={(e) => onStylesChange({ boxShadow: e.target.value || undefined })}
          placeholder="0 8px 32px rgba(0,0,0,0.12)"
        />
      </Field>
    </div>
  )
}
