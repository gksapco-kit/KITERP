import { useContext, useMemo, type ReactNode } from 'react'
import { useBranch } from '@/contexts/BranchContext'
import { VendorContext } from '@/contexts/VendorContext'
import {
  isAssignedStorefrontTemplatePending,
  resolveAssignedStorefrontTemplateId,
} from '@/lib/storefrontTemplateAssignment'
import {
  createDefaultTemplateDisplayFields,
  resolveTemplateDisplayFieldsFromSettings,
  type TemplateDisplayFields,
} from '@/lib/storefrontDisplayFields'

/** Hide every toggle until the default unit's template is known, so badges do not flash on. */
function hiddenUntilBranchResolved(): TemplateDisplayFields {
  const defaults = createDefaultTemplateDisplayFields()
  const hide = (map: Record<string, boolean>) =>
    Object.fromEntries(Object.keys(map).map((key) => [key, false]))
  return { product: hide(defaults.product), service: hide(defaults.service) }
}

const PENDING_DISPLAY_FIELDS = hiddenUntilBranchResolved()

/** Re-resolves display fields from the active BU + assigned website template (inside BranchProvider). */
export function StorefrontDisplayFieldsBridge({ children }: { children: ReactNode }) {
  const parent = useContext(VendorContext)
  const { branches, branchCode, loading } = useBranch()
  const templatePending = isAssignedStorefrontTemplatePending(
    parent.vendor?.settings,
    branchCode,
    loading,
  )
  const templateId = useMemo(
    () => resolveAssignedStorefrontTemplateId(parent.vendor?.settings, branches, branchCode, {
      branchesLoading: loading,
    }),
    [parent.vendor?.settings, branches, branchCode, loading],
  )
  const displayFields = useMemo(
    () => (
      templatePending
        ? PENDING_DISPLAY_FIELDS
        : resolveTemplateDisplayFieldsFromSettings(parent.vendor?.settings, templateId)
    ),
    [parent.vendor?.settings, templateId, templatePending],
  )
  const value = useMemo(
    () => ({ ...parent, displayFields }),
    [parent, displayFields],
  )
  return <VendorContext.Provider value={value}>{children}</VendorContext.Provider>
}
