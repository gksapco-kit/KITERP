import {
  containerAlignHint,
  horizontalAlignChoices,
  horizontalAxisTitle,
  verticalAlignChoices,
  verticalAxisTitle,
  type AlignChoice,
} from '../../lib/containerAlignOptions'
import type { ContainerAlign, ContainerLayout } from '../../types/builder'

interface ContainerAlignFieldsProps {
  layout: ContainerLayout
  alignX?: ContainerAlign
  alignY?: ContainerAlign
  onChange: (patch: { alignX?: ContainerAlign; alignY?: ContainerAlign }) => void
  /** Per-child: first option inherits container default */
  inherit?: boolean
  scope: 'container' | 'child'
}

export function ContainerAlignFields({
  layout,
  alignX,
  alignY,
  onChange,
  inherit,
  scope,
}: ContainerAlignFieldsProps) {
  const hChoices = horizontalAlignChoices(inherit)
  const vChoices = verticalAlignChoices(inherit)
  const hValue = inherit ? (alignX ?? '') : (alignX ?? 'stretch')
  const vValue = inherit ? (alignY ?? '') : (alignY ?? 'stretch')

  return (
    <div className="space-y-4">
      <p className="rounded-md bg-gray-50 px-2.5 py-2 text-[11px] leading-relaxed text-gray-600">
        {containerAlignHint(layout, scope)}
      </p>

      <AlignAxisGroup
        title={horizontalAxisTitle(layout)}
        subtitle="Where this sits from left to right"
        choices={hChoices}
        value={hValue}
        onChange={(v) =>
          onChange({
            alignX: inherit ? (v ? (v as ContainerAlign) : undefined) : (v as ContainerAlign),
            alignY,
          })
        }
      />

      <AlignAxisGroup
        title={verticalAxisTitle(layout)}
        subtitle="Where this sits from top to bottom"
        choices={vChoices}
        value={vValue}
        onChange={(v) =>
          onChange({
            alignX,
            alignY: inherit ? (v ? (v as ContainerAlign) : undefined) : (v as ContainerAlign),
          })
        }
      />
    </div>
  )
}

function AlignAxisGroup({
  title,
  subtitle,
  choices,
  value,
  onChange,
}: {
  title: string
  subtitle: string
  choices: AlignChoice[]
  value: ContainerAlign | ''
  onChange: (value: ContainerAlign | '') => void
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold text-gray-800">{title}</p>
        <p className="text-[11px] text-gray-500">{subtitle}</p>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={title}>
        {choices.map((choice) => (
          <AlignOptionButton
            key={choice.value || 'inherit'}
            choice={choice}
            selected={value === choice.value}
            onSelect={() => onChange(choice.value)}
          />
        ))}
      </div>
    </div>
  )
}

function AlignOptionButton({
  choice,
  selected,
  onSelect,
}: {
  choice: AlignChoice
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-lg border px-2 py-2 text-center text-xs font-medium transition ${
        selected
          ? 'border-brand-500 bg-brand-50 text-brand-800 ring-1 ring-brand-200'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      {choice.label}
    </button>
  )
}
