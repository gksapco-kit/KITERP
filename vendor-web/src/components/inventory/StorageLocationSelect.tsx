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
  storeId: string
  value: string
  onChange: (id: string) => void
  className?: string
  allowEmpty?: boolean
  emptyLabel?: string
}

export function StorageLocationSelect({
  storeId,
  value,
  onChange,
  className,
  allowEmpty = true,
  emptyLabel = 'No specific location (BU-level)',
}: Props) {
  const { data, isLoading } = useStorageLocationTree(storeId || null)

  const options = useMemo((): SelectOption[] => {
    const flat = flattenLocations(data?.locations ?? [])
    const list: SelectOption[] = allowEmpty ? [{ value: '', label: emptyLabel }] : []
    return [...list, ...flat.map((o) => ({ value: o.id, label: o.label }))]
  }, [data?.locations, allowEmpty, emptyLabel])

  if (!storeId) {
    return (
      <p className="text-xs text-muted-foreground">Select a business unit first to pick a storage location.</p>
    )
  }

  if (isLoading) {
    return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
  }

  if (options.length <= (allowEmpty ? 1 : 0)) {
    return (
      <p className="text-xs text-muted-foreground">
        No storage locations for this unit.{' '}
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
    />
  )
}
