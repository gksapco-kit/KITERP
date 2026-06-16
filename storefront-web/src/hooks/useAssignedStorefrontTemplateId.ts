import { useMemo } from 'react'
import { useBranch } from '@/contexts/BranchContext'
import { useVendor } from '@/contexts/VendorContext'
import {
  isAssignedStorefrontTemplatePending,
  resolveAssignedStorefrontTemplateId,
} from '@/lib/storefrontTemplateAssignment'

export function useAssignedStorefrontTemplateId(): string | null {
  const { vendor } = useVendor()
  const { branchCode, branches, loading: branchesLoading } = useBranch()

  return useMemo(
    () =>
      resolveAssignedStorefrontTemplateId(vendor?.settings, branches, branchCode, {
        branchesLoading,
      }),
    [vendor?.settings, branches, branchCode, branchesLoading],
  )
}

export function useAssignedStorefrontTemplatePending(): boolean {
  const { vendor } = useVendor()
  const { branchCode, loading: branchesLoading } = useBranch()

  return useMemo(
    () => isAssignedStorefrontTemplatePending(vendor?.settings, branchCode, branchesLoading),
    [vendor?.settings, branchCode, branchesLoading],
  )
}
