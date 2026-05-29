import type { Block, BlockStyles, TextAlign } from '../../types/builder'
import { ANIMATION_OPTIONS } from '../../lib/styleConstants'
import { isInlineBlockType, isMultiItemBlockType, supportsHeroBackgroundMode } from '../../lib/blockUtils'
import { BlockBackgroundFields } from './BlockBackgroundFields'
import { StyleTypographySliders } from './StyleTypographySliders'
import { TextColorFields } from './TextColorFields'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

interface StylePanelProps {
  block: Block
  onChange: (styles: Partial<BlockStyles>) => void
  isNestedInContainer?: boolean
}

export function StylePanel({ block, onChange, isNestedInContainer }: StylePanelProps) {
  const s = block.styles
  const heroBgInContent = supportsHeroBackgroundMode(block.type)
  const multiItem = isMultiItemBlockType(block.type)
  const inline = isInlineBlockType(block.type)
  const hasSectionHeader = block.props.text !== undefined || block.props.subtitle !== undefined

  if (block.type === 'container') {
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Style & Layout</p>
        <p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
          Container padding, background, and corner radius are in <strong>Content</strong> above. Use width below only if
          you need a fixed outer width.
        </p>
        <Field label="Width" hint="Usually leave auto for full-width containers.">
          <input
            className={inputClass}
            value={s.width ?? ''}
            onChange={(e) => onChange({ width: e.target.value || undefined })}
            placeholder="Auto (full width)"
          />
        </Field>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Style & Layout</p>

      {isNestedInContainer && (
        <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-800">
          Column width inside the container is set in <strong>Content</strong> above.
        </p>
      )}

      {multiItem && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <strong>Section styles</strong> apply to the block background and section title/subtitle. Open each card or item
          in the <strong>Content</strong> panel above to set per-item title, description, and typography.
        </p>
      )}

      {inline && (
        <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-800">
          Styles below apply to this {block.type} only. Background and size wrap the button/text — not full canvas width.
        </p>
      )}

      {heroBgInContent ? (
        <p className="text-xs text-gray-500">Background (solid color or photo) is set in Content above.</p>
      ) : (
        <BlockBackgroundFields styles={s} onChange={onChange} />
      )}

      {hasSectionHeader && (
        <TextColorFields
          styles={s}
          onChange={onChange}
          titleLabel="Section title color"
          subtitleLabel="Section subtitle color"
        />
      )}

      {!hasSectionHeader && !multiItem && (
        <TextColorFields styles={s} onChange={onChange} showTitle={false} showSubtitle={false} />
      )}

      <Field
        label="Block position"
        hint={
          s.width
            ? 'With a set width (e.g. 870px), this places the block on the page. Clear Width below for full-width layout.'
            : 'When width is auto (full), text alignment only affects text inside the block.'
        }
      >
        <select className={inputClass} value={s.textAlign ?? (s.width ? 'center' : 'left')} onChange={(e) => onChange({ textAlign: e.target.value as TextAlign })}>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Field>

      <Field label="Padding">
        <input className={inputClass} value={s.padding ?? ''} onChange={(e) => onChange({ padding: e.target.value })} placeholder="e.g. 24px 32px" />
      </Field>

      <Field
        label="Margin"
        hint="Outer spacing around the block. Stays inside the page — e.g. 0 0 32px for space below."
      >
        <input className={inputClass} value={s.margin ?? ''} onChange={(e) => onChange({ margin: e.target.value })} placeholder="e.g. 0 0 24px" />
      </Field>

      <Field
        label="Width"
        hint={
          s.width
            ? `Fixed at ${s.width} — not full width. Click Clear for edge-to-edge layout.`
            : 'Auto: block spans the full content area. Drag the canvas corner handle to set a custom width.'
        }
      >
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={s.width ?? ''}
            onChange={(e) => onChange({ width: e.target.value || undefined })}
            placeholder="Auto (full or fit)"
          />
          {s.width && (
            <button
              type="button"
              className="shrink-0 rounded-lg border border-gray-200 px-2 text-xs text-gray-500 hover:bg-gray-50"
              onClick={() => onChange({ width: undefined })}
            >
              Clear
            </button>
          )}
        </div>
      </Field>

      <Field label="Height">
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={s.height ?? ''}
            onChange={(e) => onChange({ height: e.target.value || undefined })}
            placeholder="Auto"
          />
          {s.height && (
            <button
              type="button"
              className="shrink-0 rounded-lg border border-gray-200 px-2 text-xs text-gray-500 hover:bg-gray-50"
              onClick={() => onChange({ height: undefined })}
            >
              Clear
            </button>
          )}
        </div>
      </Field>

      <Field label="Border radius">
        <input className={inputClass} value={s.borderRadius ?? ''} onChange={(e) => onChange({ borderRadius: e.target.value })} placeholder="e.g. 12px" />
      </Field>

      <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
        <input
          type="checkbox"
          checked={!!s.hideShadow}
          onChange={(e) => onChange({ hideShadow: e.target.checked || undefined })}
        />
        Hide shadow
      </label>
      <p className="text-[11px] text-gray-500">
        Removes drop shadows on this block, including built-in card and panel shadows (e.g. Category Split).
      </p>

      {!s.hideShadow && (
        <Field label="Box shadow">
          <input
            className={inputClass}
            value={s.boxShadow ?? ''}
            onChange={(e) => onChange({ boxShadow: e.target.value || undefined })}
            placeholder="0 4px 6px rgba(0,0,0,0.1)"
          />
        </Field>
      )}

      <Field label="Border">
        <div className="grid grid-cols-2 gap-2">
          <input className={inputClass} value={s.borderWidth ?? ''} onChange={(e) => onChange({ borderWidth: e.target.value })} placeholder="Width" />
          <input className={inputClass} value={s.borderColor ?? ''} onChange={(e) => onChange({ borderColor: e.target.value })} placeholder="Color" />
        </div>
      </Field>

      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Typography</p>
      <p className="text-[11px] text-gray-500">
        {multiItem
          ? 'Applies to section heading text and default body in this block — not individual cards.'
          : inline
            ? 'Applies to text inside this block (button label, heading, paragraph).'
            : 'Applies to all text in this block unless overridden per item in Content.'}
      </p>
      <StyleTypographySliders styles={s} onChange={onChange} />

      <Field label="Animation" hint="Entrance animation when the block appears on the page.">
        <select className={inputClass} value={s.animation ?? ''} onChange={(e) => onChange({ animation: e.target.value || undefined })}>
          {ANIMATION_OPTIONS.map((opt) => (
            <option key={opt.value || 'none'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Field>

      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Responsive visibility</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!s.hideOnMobile} onChange={(e) => onChange({ hideOnMobile: e.target.checked })} />
        Hide on mobile
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!s.hideOnDesktop} onChange={(e) => onChange({ hideOnDesktop: e.target.checked })} />
        Hide on desktop
      </label>
    </div>
  )
}
