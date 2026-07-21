import { Label } from '@/components/ui/label'
import { ThemeSelect, type ThemeSelectOption } from '@/components/common/ThemeSelect'
import { BranchSelect } from '@/components/common/BranchSelect'
import { PlantSelect } from '@/components/common/PlantSelect'
import { BRANCH_LABEL, BRANCH_PLANT_LABEL } from '@/lib/businessUnitLabels'
import { cn } from '@/lib/utils'

export type BranchPlantKind = 'branch' | 'plant'

export type BranchPlantSelection =
  | { kind: '' }
  | { kind: BranchPlantKind; id: string }

const KIND_OPTIONS: ThemeSelectOption[] = [
  { value: 'branch', label: BRANCH_LABEL },
  { value: 'plant', label: 'Plant' },
]

interface BranchPlantSelectProps {
  /** Business unit that scopes both branches and plants. */
  businessUnitId?: string | null
  value: BranchPlantSelection
  onChange: (value: BranchPlantSelection) => void
  /** Adds an "All …" option on the value selector (value ""). */
  allowAll?: boolean
  className?: string
  disabled?: boolean
  id?: string
}

/**
 * Two-step Branch / Plant picker:
 * 1) choose type (Branch or Plant)
 * 2) choose the matching value in the field beside it
 */
export function BranchPlantSelect({
  businessUnitId,
  value,
  onChange,
  allowAll = true,
  className,
  disabled,
  id,
}: BranchPlantSelectProps) {
  const kind = value.kind
  const selectedId = value.kind ? value.id : ''
  const valueLabel = kind === 'plant' ? 'Plant' : kind === 'branch' ? BRANCH_LABEL : 'Value'

  const setKind = (next: string) => {
    if (next !== 'branch' && next !== 'plant') {
      onChange({ kind: '' })
      return
    }
    if (next === kind) return
    onChange({ kind: next, id: '' })
  }

  const setValueId = (nextId: string) => {
    if (!kind) return
    onChange({ kind, id: nextId })
  }

  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      <div className="min-w-[9rem] space-y-1.5">
        <Label className="text-xs text-muted-foreground">{BRANCH_PLANT_LABEL}</Label>
        <ThemeSelect
          id={id ? `${id}-kind` : undefined}
          value={kind}
          onChange={setKind}
          options={KIND_OPTIONS}
          placeholder="Choose…"
          disabled={disabled}
          aria-label={BRANCH_PLANT_LABEL}
        />
      </div>
      <div className="min-w-[14rem] flex-1 space-y-1.5">
        <Label className="text-xs text-muted-foreground">{valueLabel}</Label>
        {!kind ? (
          <ThemeSelect
            id={id ? `${id}-value` : undefined}
            value=""
            onChange={() => {}}
            options={[]}
            placeholder="Select type first…"
            disabled
            aria-label={`${BRANCH_PLANT_LABEL} value`}
          />
        ) : kind === 'branch' ? (
          <BranchSelect
            id={id ? `${id}-value` : undefined}
            businessUnitId={businessUnitId}
            value={selectedId}
            onChange={setValueId}
            allowAll={allowAll}
            disabled={disabled}
          />
        ) : (
          <PlantSelect
            id={id ? `${id}-value` : undefined}
            value={selectedId}
            onChange={setValueId}
            storeId={businessUnitId || null}
            allowAll={allowAll}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  )
}
