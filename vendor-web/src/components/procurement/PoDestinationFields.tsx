import { useEffect, useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { BusinessUnitSelect } from '@/components/common/BusinessUnitSelect'
import {
  BranchPlantSelect,
  type BranchPlantSelection,
} from '@/components/common/BranchPlantSelect'
import { usePlants, useStorageLocationTree } from '@/hooks/useVendor'
import type { StorageLocation } from '@/types'
import { cn } from '@/lib/utils'

export type PoDestinationValue = {
  storeId: string
  scope: BranchPlantSelection
  storageLocationId: string
}

export function emptyPoDestination(storeId = ''): PoDestinationValue {
  return { storeId, scope: { kind: '' }, storageLocationId: '' }
}

/** Build destination state from a PO line (plant + SLoc). */
export function poDestinationFromLine(
  item?: { plant_id?: string | null; storage_location_id?: string | null } | null,
  storeId = '',
): PoDestinationValue {
  return {
    storeId,
    scope: item?.plant_id ? { kind: 'plant', id: item.plant_id } : { kind: '' },
    storageLocationId: item?.storage_location_id || '',
  }
}

/** Map destination UI state to line-level receive/create API fields. */
export function poDestinationToPayload(value: PoDestinationValue): {
  plant_id?: string
  storage_location_id?: string
} {
  return {
    plant_id: value.scope.kind === 'plant' && value.scope.id ? value.scope.id : undefined,
    storage_location_id: value.storageLocationId || undefined,
  }
}

/**
 * Map destination UI state to the document header's org dimensions.
 *
 * These are what the approver matrix routes on, so the branch falls back to the
 * business unit — picking a plant rather than a branch must not leave the
 * document unscoped.
 */
export function poDestinationToHeaderPayload(value: PoDestinationValue): {
  branch_id?: string
  plant_id?: string
} {
  const branchId = value.scope.kind === 'branch' && value.scope.id ? value.scope.id : value.storeId
  return {
    branch_id: branchId || undefined,
    plant_id: value.scope.kind === 'plant' && value.scope.id ? value.scope.id : undefined,
  }
}

function flattenStorageLocations(
  nodes: StorageLocation[],
  prefix = '',
): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = []
  for (const node of nodes) {
    const label = prefix ? `${prefix} / ${node.name}` : node.name
    out.push({ value: node.id, label })
    if (node.children?.length) {
      out.push(...flattenStorageLocations(node.children, label))
    }
  }
  return out
}

/**
 * Same Business Unit → Branch/Plant → Storage Location inputs used on PO create.
 */
export function PoDestinationFields({
  value,
  onChange,
  className,
  compact = false,
  showBusinessUnit = true,
  showBranchPlant = true,
  showStorageLocation = true,
}: {
  value: PoDestinationValue
  onChange: (next: PoDestinationValue) => void
  className?: string
  /** Tighter spacing for dense receive rows. */
  compact?: boolean
  showBusinessUnit?: boolean
  showBranchPlant?: boolean
  showStorageLocation?: boolean
}) {
  const plantId = value.scope.kind === 'plant' ? value.scope.id : ''
  const branchId = value.scope.kind === 'branch' ? value.scope.id : ''
  const { data: plantsData } = usePlants(value.storeId || null)
  const plants = plantsData?.plants ?? []
  const selectedPlant = plants.find((p) => p.id === plantId)

  // If we only know plant_id (from PO line), resolve its business unit once plants load.
  useEffect(() => {
    if (value.storeId || value.scope.kind !== 'plant' || !value.scope.id) return
    const plant = plants.find((p) => p.id === value.scope.id)
    if (plant?.store_id) {
      onChange({ ...value, storeId: plant.store_id })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when plant list resolves store
  }, [plants, value.scope, value.storeId])

  const locationStoreId = branchId || selectedPlant?.store_id || value.storeId || null
  const { data: locationsData, isLoading: locationsLoading } = useStorageLocationTree(
    locationStoreId,
    plantId || null,
  )
  const locationOptions = useMemo(
    () => flattenStorageLocations(locationsData?.locations ?? []),
    [locationsData?.locations],
  )

  const gap = compact ? 'gap-2' : 'gap-x-4 gap-y-4'
  const labelClass = 'text-[10px] font-semibold uppercase tracking-wide text-gray-400'
  const controlH = compact ? 'h-9' : 'h-8'

  return (
    <div
      className={cn(
        compact
          ? 'flex flex-wrap items-start'
          : 'grid grid-cols-1 items-start sm:grid-cols-2 lg:grid-cols-4',
        gap,
        className,
      )}
    >
      {showBusinessUnit && (
        <div className={cn('min-w-0 space-y-1.5', compact && 'min-w-[10rem] flex-1')}>
          <div className="flex h-4 items-center">
            <Label className={labelClass}>Business Unit</Label>
          </div>
          <BusinessUnitSelect
            value={value.storeId}
            onChange={(id) =>
              onChange({
                storeId: id,
                scope: { kind: '' },
                storageLocationId: '',
              })
            }
            autoSelectDefault={false}
            className="w-full min-w-0"
            triggerClassName={controlH}
          />
        </div>
      )}

      {showBranchPlant && (
        <BranchPlantSelect
          businessUnitId={value.storeId || null}
          value={value.scope}
          onChange={(next) =>
            onChange({
              ...value,
              scope: next,
              storageLocationId: '',
            })
          }
          allowAll={false}
          className={cn(
            'min-w-0',
            compact ? 'min-w-[16rem] flex-[1.75] flex-nowrap' : 'sm:col-span-2 lg:col-span-2',
          )}
          triggerClassName={controlH}
          labelClassName={labelClass}
          labelHeightClassName="h-4"
        />
      )}

      {showStorageLocation && (
        <div className={cn('min-w-0 space-y-1.5', compact && 'min-w-[10rem] flex-1')}>
          <div className="flex h-4 items-center">
            <Label className={labelClass}>Storage Location</Label>
          </div>
          <Select
            value={value.storageLocationId}
            onChange={(id) => onChange({ ...value, storageLocationId: id })}
            options={selectOptionsWithBlank(
              !value.scope.kind
                ? 'Select Branch or Plant first…'
                : locationsLoading
                  ? 'Loading…'
                  : locationOptions.length
                    ? 'Select location…'
                    : 'No locations found',
              locationOptions,
            )}
            placeholder={
              !value.scope.kind
                ? 'Select Branch or Plant first…'
                : locationsLoading
                  ? 'Loading…'
                  : 'Select location…'
            }
            disabled={!value.scope.kind || locationsLoading}
            aria-label="Storage location"
            className="w-full min-w-0"
            triggerClassName={`${controlH} w-full`}
          />
        </div>
      )}
    </div>
  )
}
