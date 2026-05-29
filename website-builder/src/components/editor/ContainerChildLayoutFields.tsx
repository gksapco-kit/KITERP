import type { Block, ContainerLayout } from '../../types/builder'
import { ContainerAlignFields } from './ContainerAlignFields'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}

interface ContainerChildLayoutFieldsProps {
  block: Block
  parentLayout: ContainerLayout
  onChange: (props: Partial<Block['props']>) => void
}

export function ContainerChildLayoutFields({
  block,
  parentLayout,
  onChange,
}: ContainerChildLayoutFieldsProps) {
  const span = block.props.containerSpan ?? 1
  const maxSpan = parentLayout === 'grid' ? 3 : parentLayout === 'row' ? 2 : 1

  return (
    <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/50 p-3">
      <div>
        <p className="text-xs font-semibold text-brand-800">Inside container — this item only</p>
        <p className="mt-0.5 text-[11px] text-gray-600">
          Overrides the whole-container settings below. Pick <strong>Same as container</strong> to follow the
          default.
        </p>
      </div>

      <ContainerAlignFields
        layout={parentLayout}
        scope="child"
        inherit
        alignX={block.props.containerChildAlignX}
        alignY={block.props.containerChildAlignY}
        onChange={({ alignX, alignY }) =>
          onChange({
            containerChildAlignX: alignX,
            containerChildAlignY: alignY,
          })
        }
      />

      {parentLayout !== 'column' && (
        <Field label="Column width">
          <select
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            value={span}
            onChange={(e) =>
              onChange({ containerSpan: Number(e.target.value) as 1 | 2 | 3 })
            }
          >
            <option value={1}>1 column</option>
            {maxSpan >= 2 && (
              <option value={2}>{parentLayout === 'row' ? 'Full row' : '2 columns'}</option>
            )}
            {maxSpan >= 3 && <option value={3}>Full width (3 columns)</option>}
          </select>
        </Field>
      )}
    </div>
  )
}
