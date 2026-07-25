export type HrScope = 'central' | 'per_business_unit'

export type HrModuleSettings = {
  hr_enabled: boolean
  hr_scope: HrScope
  hr_business_unit_ids: string[]
}

export function readHrModuleSettings(
  settings: Record<string, unknown> | undefined | null,
): HrModuleSettings {
  const hr_enabled = settings?.hr_enabled !== false
  const hr_scope: HrScope =
    settings?.hr_scope === 'per_business_unit' ? 'per_business_unit' : 'central'
  const raw = settings?.hr_business_unit_ids
  const hr_business_unit_ids = Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === 'string')
    : []
  return { hr_enabled, hr_scope, hr_business_unit_ids }
}

/** Whether the HR sidebar section should appear for the current business-unit context. */
export function isHrNavVisible(
  settings: Record<string, unknown> | undefined | null,
  selectedStoreId: string | undefined,
): boolean {
  const { hr_enabled, hr_scope, hr_business_unit_ids } = readHrModuleSettings(settings)
  if (!hr_enabled) return false
  if (hr_scope === 'central') return true
  if (selectedStoreId) return hr_business_unit_ids.includes(selectedStoreId)
  return hr_business_unit_ids.length > 0
}

export const HR_RECRUITMENT_COMMON_MEETING_URL_KEY = 'hr_recruitment_common_meeting_url'

export function readRecruitmentCommonMeetingUrl(
  settings: Record<string, unknown> | undefined | null,
): string {
  const raw = settings?.[HR_RECRUITMENT_COMMON_MEETING_URL_KEY]
  return typeof raw === 'string' ? raw.trim() : ''
}
