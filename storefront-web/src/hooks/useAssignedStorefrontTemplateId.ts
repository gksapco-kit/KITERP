import { useMemo } from 'react'
import { useBranch } from '@/contexts/BranchContext'
import { useVendor } from '@/contexts/VendorContext'
import {
  isAssignedStorefrontTemplatePending,
  resolveAssignedStorefrontTemplateId,
  resolveStoreSpecificAssignedTemplateId,
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

/** Per-branch catalog assignment only — no vendor-wide fallback in per_unit mode. */
export function useStoreSpecificAssignedTemplateId(): string | null {
  const { vendor } = useVendor()
  const { branchCode, branches, loading: branchesLoading } = useBranch()

  return useMemo(
    () =>
      resolveStoreSpecificAssignedTemplateId(vendor?.settings, branches, branchCode, {
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
