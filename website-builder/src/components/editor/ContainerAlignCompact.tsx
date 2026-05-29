import { horizontalAlignChoices, verticalAlignChoices } from '../../lib/containerAlignOptions'
import type { ContainerAlign } from '../../types/builder'

interface ContainerAlignCompactProps {
  alignX?: ContainerAlign
  alignY?: ContainerAlign
  onAlignX: (v: ContainerAlign | undefined) => void
  onAlignY: (v: ContainerAlign | undefined) => void
}

export function ContainerAlignCompact({ alignX, alignY, onAlignX, onAlignY }: ContainerAlignCompactProps) {
  const hChoices = horizontalAlignChoices(true)
  const vChoices = verticalAlignChoices(true)

  return (
    <div className="flex flex-col gap-1 border-l border-gray-200 pl-1.5">
      <CompactAxisRow
        label="Horizontal"
        value={alignX}
        choices={hChoices}
        onChange={onAlignX}
      />
      <CompactAxisRow
        label="Vertical"
        value={alignY}
        choices={vChoices}
        onChange={onAlignY}
      />
    </div>
  )
}

function CompactAxisRow({
  label,
  value,
  choices,
  onChange,
}: {
  label: string
  value?: ContainerAlign
  choices: ReturnType<typeof horizontalAlignChoices>
  onChange: (v: ContainerAlign | undefined) => void
}) {
  const current = value ?? ''

  return (
    <div className="flex flex-wrap items-center gap-0.5">
      <span className="mr-0.5 w-[4.25rem] shrink-0 text-[9px] font-medium leading-tight text-gray-500">
        {label}
      </span>
      {choices.map((opt) => (
        <button
          key={opt.value || 'auto'}
          type="button"
          title={opt.label}
          onClick={() => onChange(opt.value ? (opt.value as ContainerAlign) : undefined)}
          className={`rounded px-1 py-0.5 text-[9px] font-medium leading-none ${
            current === opt.value
              ? 'bg-brand-100 text-brand-800'
              : 'text-gray-500 hover:bg-white hover:text-gray-800'
          }`}
        >
          {opt.shortLabel}
        </button>
      ))}
    </div>
  )
}
