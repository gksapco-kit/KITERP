import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { applyFieldMappings } from '@/lib/fieldMappingRuntime'
import { useAuthStore } from '@/stores/authStore'
import { useVendorStore } from '@/stores/vendorStore'

/** Loads vendor field mappings into runtime registry for labels + Models page. */
export function FieldMappingProvider({ children }: { children: React.ReactNode }) {
  const vendorId = useVendorStore((s) => s.vendor?.id)
  const accessToken = useAuthStore((s) => s.accessToken)

  const { data } = useQuery({
    queryKey: ['schema-field-mappings', vendorId],
    queryFn: () => vendorApi.listSchemaFieldMappings(),
    enabled: Boolean(vendorId) && Boolean(accessToken),
    staleTime: 60_000,
  })

  useEffect(() => {
    applyFieldMappings(data?.items ?? [])
  }, [data?.items])

  return <>{children}</>
}
