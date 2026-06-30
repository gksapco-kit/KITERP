import { useMemo } from 'react'
import { ThemeSelect, type ThemeSelectOption } from '@/components/common/ThemeSelect'
import { usePlants, useStores } from '@/hooks/useVendor'

interface PlantSelectProps {
  value: string
  onChange: (plantId: string) => void
  /** Scope plants to this business unit; omit / empty string loads all vendor plants. */
  storeId?: string | null
  /** Adds an "All plants" option (value ""). */
  allowAll?: boolean
  className?: string
  disabled?: boolean
  id?: string
}

/** Single plant selector — themed custom list (not native OS dropdown). */
export function PlantSelect({
  value,
  onChange,
  storeId,
  allowAll = false,
  className,
  disabled,
  id,
}: PlantSelectProps) {
  const { data: storesData } = useStores()
  const stores = storesData?.stores ?? []
  const activeStores = useMemo(
    () => stores.filter(s => s.is_active !== false),
    [stores],
  )

  const { data: plantsData, isLoading } = usePlants(storeId ? storeId : null)
  const plants = plantsData?.plants ?? []

  const options = useMemo((): ThemeSelectOption[] => {
    const list: ThemeSelectOption[] = []
    if (allowAll) {
      list.push({ value: '', label: 'All plants', hint: 'No filter applied' })
    }
    const showStoreSuffix = !storeId && activeStores.length > 1
    for (const p of plants) {
      const base = p.code ? `${p.name} (${p.code})` : p.name
      if (!showStoreSuffix) {
        list.push({ value: p.id, label: base })
        continue
      }
      const store = activeStores.find(s => s.id === p.store_id)
      const storeLabel = store
        ? (store.code ? `${store.name} (${store.code})` : store.name)
        : null
      list.push({
        value: p.id,
        label: storeLabel ? `${base} — ${storeLabel}` : base,
      })
    }
    return list
  }, [plants, allowAll, storeId, activeStores])

  return (
    <ThemeSelect
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={
        isLoading
          ? 'Loading…'
          : allowAll
            ? 'All plants'
            : 'Select a plant…'
      }
      disabled={disabled || isLoading}
      className={className}
      aria-label="Plant"
    />
  )
}
