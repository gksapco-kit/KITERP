import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { blockRegistry } from '../../lib/blockRegistry'
import {
  CONTAINER_PADDING_PRESETS,
  containerPaddingPresetValue,
} from '../../lib/containerLayout'
import { CONTAINER_QUICK_ADD } from '../../lib/containerQuickAdd'
import type { Block, BlockStyles, ContainerLayout } from '../../types/builder'
import { useBuilderStore } from '../../store/useBuilderStore'
import { BlockBackgroundFields } from './BlockBackgroundFields'
import { ContainerAddBar } from './ContainerAddBar'
import { ContainerAlignFields } from './ContainerAlignFields'

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

interface ContainerPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<BlockStyles>) => void
}

export function ContainerPropertiesFields({
  block,
  onChange,
  onStylesChange,
}: ContainerPropertiesFieldsProps) {
  const p = block.props
  const s = block.styles
  const children = block.children ?? []
  const addBlock = useBuilderStore((st) => st.addBlock)
  const removeBlock = useBuilderStore((st) => st.removeBlock)
  const selectBlock = useBuilderStore((st) => st.selectBlock)
  const reorderChild = useBuilderStore((st) => st.reorderContainerChild)
  const paddingPreset = containerPaddingPresetValue(s.padding)

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Container</p>
        <p className="text-xs text-gray-500">
          Group blocks side by side (e.g. map + form). Add with buttons below or drag from the palette.
        </p>

        <ContainerAddBar
          onAdd={(type) => addBlock(type, children.length, block.id)}
          compact
        />

        <Field label="Label (optional)">
          <input
            className={inputClass}
            value={p.containerLabel ?? ''}
            onChange={(e) => onChange({ containerLabel: e.target.value })}
            placeholder="Section"
          />
        </Field>

        <Field label="Inner layout">
          <select
            className={inputClass}
            value={p.containerLayout ?? 'row'}
            onChange={(e) => onChange({ containerLayout: e.target.value as ContainerLayout })}
          >
            <option value="row">Side by side (2 columns)</option>
            <option value="column">Stacked</option>
            <option value="grid">Grid (up to 3 columns)</option>
          </select>
        </Field>

        <Field label="Gap between items">
          <select
            className={inputClass}
            value={p.containerGap ?? 'md'}
            onChange={(e) => onChange({ containerGap: e.target.value as 'sm' | 'md' | 'lg' })}
          >
            <option value="sm">Small</option>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
          </select>
        </Field>

        <div className="space-y-3 border-t border-gray-100 pt-3">
          <div>
            <p className="text-xs font-semibold text-gray-800">Whole container — alignment</p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Default for every block inside. Change one block under <strong>Inside container</strong> when
              selected.
            </p>
          </div>
          <ContainerAlignFields
            layout={p.containerLayout ?? 'row'}
            scope="container"
            alignX={p.containerAlignX ?? 'stretch'}
            alignY={p.containerAlignY ?? 'stretch'}
            onChange={({ alignX, alignY }) =>
              onChange({
                containerAlignX: alignX,
                containerAlignY: alignY,
              })
            }
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Spacing & shape</p>

        <Field label="Padding">
          <select
            className={inputClass}
            value={paddingPreset}
            onChange={(e) => {
              const key = e.target.value
              if (key !== 'custom' && CONTAINER_PADDING_PRESETS[key]) {
                onStylesChange({ padding: CONTAINER_PADDING_PRESETS[key] })
              }
            }}
          >
            <option value="none">None</option>
            <option value="sm">Small (16px)</option>
            <option value="md">Medium (24px)</option>
            <option value="lg">Large (40px)</option>
            <option value="xl">Extra large (64px)</option>
            {paddingPreset === 'custom' && <option value="custom">Custom</option>}
          </select>
        </Field>

        <Field label="Custom padding" hint="Overrides preset when set">
          <input
            className={inputClass}
            value={s.padding ?? ''}
            onChange={(e) => onStylesChange({ padding: e.target.value || undefined })}
            placeholder="e.g. 24px 32px"
          />
        </Field>

        <Field label="Margin">
          <input
            className={inputClass}
            value={s.margin ?? ''}
            onChange={(e) => onStylesChange({ margin: e.target.value || undefined })}
            placeholder="e.g. 0 0 24px"
          />
        </Field>

        <Field label="Corner radius">
          <input
            className={inputClass}
            value={s.borderRadius ?? ''}
            onChange={(e) => onStylesChange({ borderRadius: e.target.value || undefined })}
            placeholder="e.g. 12px"
          />
        </Field>
      </div>

      <BlockBackgroundFields styles={s} onChange={onStylesChange} />

      {children.length > 0 && (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Inside ({children.length})
          </p>
          <ul className="space-y-1.5">
            {children.map((child, index) => {
              const label = blockRegistry[child.type]?.label ?? child.type
              return (
                <li
                  key={child.id}
                  className="flex items-center gap-1 rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-xs font-medium text-gray-700 hover:text-brand-600"
                    onClick={() => selectBlock(child.id)}
                  >
                    {label}
                  </button>
                  <button
                    type="button"
                    disabled={index === 0}
                    className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    onClick={() => reorderChild(block.id, child.id, 'up')}
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index >= children.length - 1}
                    className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    onClick={() => reorderChild(block.id, child.id, 'down')}
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-0.5 text-gray-400 hover:text-red-600"
                    onClick={() => removeBlock(child.id)}
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="text-[11px] text-gray-400">
            Quick add: {CONTAINER_QUICK_ADD.map((q) => q.label).join(', ')}
          </p>
        </div>
      )}
    </div>
  )
}
