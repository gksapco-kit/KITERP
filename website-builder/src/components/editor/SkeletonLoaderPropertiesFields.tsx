import type { Block } from '../../types/builder'
import { SKELETON_LOADER_DEFAULTS } from '../../lib/skeletonLoaderDefaults'

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

interface SkeletonLoaderPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function SkeletonLoaderPropertiesFields({ block, onChange }: SkeletonLoaderPropertiesFieldsProps) {
  const p = block.props
  const layout = p.skeletonLoaderLayout ?? SKELETON_LOADER_DEFAULTS.skeletonLoaderLayout

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Skeleton Loader</p>

        <Field label="Section title (optional)">
          <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Loading preview" />
        </Field>

        <Field label="Section subtitle (optional)">
          <input className={inputClass} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
        </Field>

        <Field label="Skeleton type">
          <select
            className={inputClass}
            value={layout}
            onChange={(e) =>
              onChange({ skeletonLoaderLayout: e.target.value as 'card' | 'text' | 'profile' | 'list' | 'grid' })
            }
          >
            <option value="card">Product card</option>
            <option value="text">Text lines</option>
            <option value="profile">Profile row</option>
            <option value="list">List rows</option>
            <option value="grid">Card grid</option>
          </select>
        </Field>

        <Field label="Animation">
          <select
            className={inputClass}
            value={p.skeletonAnimation ?? SKELETON_LOADER_DEFAULTS.skeletonAnimation}
            onChange={(e) => onChange({ skeletonAnimation: e.target.value as 'shimmer' | 'pulse' | 'none' })}
          >
            <option value="shimmer">Shimmer</option>
            <option value="pulse">Pulse</option>
            <option value="none">Static</option>
          </select>
        </Field>

        <Field label="Corner radius">
          <select
            className={inputClass}
            value={p.skeletonRounded ?? SKELETON_LOADER_DEFAULTS.skeletonRounded}
            onChange={(e) => onChange({ skeletonRounded: e.target.value as 'sm' | 'md' | 'lg' })}
          >
            <option value="sm">Small</option>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
          </select>
        </Field>

        {layout === 'text' && (
          <Field label="Line count">
            <input
              type="number"
              min={1}
              max={8}
              className={inputClass}
              value={p.skeletonLineCount ?? SKELETON_LOADER_DEFAULTS.skeletonLineCount}
              onChange={(e) => onChange({ skeletonLineCount: Number(e.target.value) || 1 })}
            />
          </Field>
        )}

        {(layout === 'list' || layout === 'grid') && (
          <Field label="Row count">
            <input
              type="number"
              min={1}
              max={6}
              className={inputClass}
              value={p.skeletonRowCount ?? SKELETON_LOADER_DEFAULTS.skeletonRowCount}
              onChange={(e) => onChange({ skeletonRowCount: Number(e.target.value) || 1 })}
            />
          </Field>
        )}

        {layout === 'grid' && (
          <Field label="Columns">
            <select
              className={inputClass}
              value={p.skeletonColumnCount ?? SKELETON_LOADER_DEFAULTS.skeletonColumnCount}
              onChange={(e) => onChange({ skeletonColumnCount: Number(e.target.value) })}
            >
              <option value={1}>1 column</option>
              <option value={2}>2 columns</option>
              <option value={3}>3 columns</option>
            </select>
          </Field>
        )}

        <p className="text-[11px] text-gray-400">
          Decorative loading placeholders for mockups and product page wireframes.
        </p>
      </div>
  )
}
