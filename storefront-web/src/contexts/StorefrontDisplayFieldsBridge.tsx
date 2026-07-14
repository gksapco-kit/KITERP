import { useContext, useMemo, type ReactNode } from 'react'
import { useBranch } from '@/contexts/BranchContext'
import { VendorContext } from '@/contexts/VendorContext'
import { resolveAssignedStorefrontTemplateId } from '@/lib/storefrontTemplateAssignment'
import { resolveTemplateDisplayFieldsFromSettings } from '@/lib/storefrontDisplayFields'

/** Re-resolves display fields from the active BU + assigned website template (inside BranchProvider). */
export function StorefrontDisplayFieldsBridge({ children }: { children: ReactNode }) {
  const parent = useContext(VendorContext)
  const { branches, branchCode } = useBranch()
  const templateId = useMemo(
    () => resolveAssignedStorefrontTemplateId(parent.vendor?.settings, branches, branchCode),
    [parent.vendor?.settings, branches, branchCode],
  )
  const displayFields = useMemo(
    () => resolveTemplateDisplayFieldsFromSettings(parent.vendor?.settings, templateId),
    [parent.vendor?.settings, templateId],
  )
  const value = useMemo(
    () => ({ ...parent, displayFields }),
    [parent, displayFields],
  )
  return <VendorContext.Provider value={value}>{children}</VendorContext.Provider>
}
