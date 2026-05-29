import type { Block, BlockStyles } from '../../types/builder'
import {
  DEFAULT_RATING_BREAKDOWN,
  PRODUCT_RATING_DEFAULTS,
} from '../../lib/productRatingDefaults'
import type { StarRatingSize } from '../builder/StarRating'

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

interface ProductRatingPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<BlockStyles>) => void
}

export function ProductRatingPropertiesFields({ block, onChange, onStylesChange }: ProductRatingPropertiesFieldsProps) {
  const p = block.props
  const s = block.styles
  const rating = p.rating ?? PRODUCT_RATING_DEFAULTS.rating
  const breakdown = p.ratingBreakdown ?? DEFAULT_RATING_BREAKDOWN
  const layout = p.productRatingLayout ?? PRODUCT_RATING_DEFAULTS.productRatingLayout

  const updateBreakdown = (stars: number, percent: number) => {
    const next = [5, 4, 3, 2, 1].map(
      (star) => breakdown.find((b) => b.stars === star) ?? { stars: star, percent: 0 },
    )
    const idx = next.findIndex((b) => b.stars === stars)
    if (idx >= 0) next[idx] = { stars, percent }
    onChange({ ratingBreakdown: next })
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Product Rating</p>

      <Field label="Section title (optional)">
        <input
          className={inputClass}
          value={p.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Customer ratings"
        />
      </Field>

      <Field label="Section subtitle (optional)">
        <input
          className={inputClass}
          value={p.subtitle ?? ''}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="What buyers are saying"
        />
      </Field>

      <Field label="Layout">
        <select
          className={inputClass}
          value={layout}
          onChange={(e) => onChange({ productRatingLayout: e.target.value as 'compact' | 'detailed' })}
        >
          <option value="detailed">Score + breakdown bars</option>
          <option value="compact">Inline stars only</option>
        </select>
      </Field>

      <Field label={`Overall rating (${rating.toFixed(1)})`}>
        <input
          type="range"
          min={0}
          max={5}
          step={0.1}
          className="h-2 w-full cursor-pointer accent-brand-600"
          value={rating}
          onChange={(e) => onChange({ rating: Number(e.target.value) })}
        />
      </Field>

      <Field label="Number of reviews">
        <input
          type="number"
          min={0}
          className={inputClass}
          value={p.reviewCount ?? 0}
          onChange={(e) => onChange({ reviewCount: Math.max(0, Number(e.target.value) || 0) })}
        />
      </Field>

      <Field label="Star size">
        <select
          className={inputClass}
          value={p.starSize ?? 'md'}
          onChange={(e) => onChange({ starSize: e.target.value as StarRatingSize })}
        >
          <option value="sm">Small</option>
          <option value="md">Medium</option>
          <option value="lg">Large</option>
        </select>
      </Field>

      <div className="space-y-2">
        <ToggleField
          label="Show numeric score"
          checked={p.showNumericScore !== false}
          onChange={(v) => onChange({ showNumericScore: v })}
        />
        <ToggleField
          label="Show review count"
          checked={p.showReviewCount !== false}
          onChange={(v) => onChange({ showReviewCount: v })}
        />
        {layout === 'detailed' && (
          <ToggleField
            label="Show rating breakdown"
            checked={p.showRatingBreakdown !== false}
            onChange={(v) => onChange({ showRatingBreakdown: v })}
          />
        )}
      </div>

      {layout === 'detailed' && p.showRatingBreakdown !== false && (
        <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Breakdown by stars</p>
          {[5, 4, 3, 2, 1].map((stars) => {
            const row = breakdown.find((b) => b.stars === stars) ?? { stars, percent: 0 }
            return (
              <Field key={stars} label={`${stars} star — ${row.percent}%`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  className="h-2 w-full cursor-pointer accent-amber-500"
                  value={row.percent}
                  onChange={(e) => updateBreakdown(stars, Number(e.target.value))}
                />
              </Field>
            )
          })}
        </div>
      )}

      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Card style</p>

      <Field label="Background">
        <input
          className={inputClass}
          value={s.backgroundColor ?? ''}
          onChange={(e) => onStylesChange({ backgroundColor: e.target.value || undefined })}
          placeholder="#ffffff"
        />
      </Field>

      <Field label="Border radius">
        <input
          className={inputClass}
          value={s.borderRadius ?? ''}
          onChange={(e) => onStylesChange({ borderRadius: e.target.value || undefined })}
          placeholder="16px"
        />
      </Field>

      <Field label="Padding">
        <input
          className={inputClass}
          value={s.padding ?? ''}
          onChange={(e) => onStylesChange({ padding: e.target.value || undefined })}
          placeholder="24px"
        />
      </Field>
    </div>
  )
}
