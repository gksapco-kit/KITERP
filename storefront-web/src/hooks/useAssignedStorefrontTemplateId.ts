import { useMemo } from 'react'
import { useBranch } from '@/contexts/BranchContext'
import { useVendor } from '@/contexts/VendorContext'
import { resolveAssignedStorefrontTemplateId } from '@/lib/storefrontTemplateAssignment'

export function useAssignedStorefrontTemplateId(): string | null {
  const { vendor } = useVendor()
  const { branchCode, branches } = useBranch()

  return useMemo(
    () => resolveAssignedStorefrontTemplateId(vendor?.settings, branches, branchCode),
    [vendor?.settings, branches, branchCode],
  )
}
