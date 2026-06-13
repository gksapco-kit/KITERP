import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { applyFieldMappings } from '@/lib/fieldMappingRuntime'
import { useVendorStore } from '@/stores/vendorStore'

/** Loads vendor field mappings into runtime registry for labels + Models page. */
export function FieldMappingProvider({ children }: { children: React.ReactNode }) {
  const vendorId = useVendorStore((s) => s.vendor?.id)

  const { data } = useQuery({
    queryKey: ['schema-field-mappings', vendorId],
    queryFn: () => vendorApi.listSchemaFieldMappings(),
    enabled: Boolean(vendorId),
    staleTime: 60_000,
  })

  useEffect(() => {
    applyFieldMappings(data?.items ?? [])
  }, [data?.items])

  return <>{children}</>
}
