import { useMemo } from 'react'
import { useStorageLocationTree } from '@/hooks/useVendor'
import type { StorageLocation } from '@/types'
import { Loader2 } from 'lucide-react'
import { Select, type SelectOption } from '@/components/ui/select'

function flattenLocations(
  nodes: StorageLocation[],
  prefix = '',
): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = []
  for (const node of nodes) {
    out.push({ id: node.id, label: prefix + node.name })
    if (node.children?.length) {
      out.push(...flattenLocations(node.children, prefix + node.name + ' / '))
    }
  }
  return out
}

type Props = {
  /** Business unit scope (optional when plantId is set). */
  storeId?: string | null
  /** When set, locations are filtered to this plant. */
  plantId?: string | null
  value: string
  onChange: (id: string) => void
  className?: string
  allowEmpty?: boolean
  emptyLabel?: string
  disabled?: boolean
}

export function StorageLocationSelect({
  storeId = null,
  plantId = null,
  value,
  onChange,
  className,
  allowEmpty = true,
  emptyLabel = 'No specific location',
  disabled,
}: Props) {
  const { data, isLoading } = useStorageLocationTree(storeId || null, plantId || null)

  const options = useMemo((): SelectOption[] => {
    const flat = flattenLocations(data?.locations ?? [])
    const list: SelectOption[] = allowEmpty ? [{ value: '', label: emptyLabel }] : []
    return [...list, ...flat.map((o) => ({ value: o.id, label: o.label }))]
  }, [data?.locations, allowEmpty, emptyLabel])

  if (!storeId && !plantId) {
    return (
      <p className="text-xs text-muted-foreground">Select a plant first to pick a storage location.</p>
    )
  }

  if (isLoading) {
    return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
  }

  if (options.length <= (allowEmpty ? 1 : 0)) {
    return (
      <p className="text-xs text-muted-foreground">
        No storage locations for this plant.{' '}
        <a href="/storage-locations" className="text-primary underline">Create locations</a>
      </p>
    )
  }

  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      placeholder={emptyLabel}
      aria-label="Storage location"
      className={className}
      disabled={disabled}
    />
  )
}
