/** Vendor settings key: pay-later approval uses a checkbox instead of typing "approved". */
export const PAY_LATER_APPROVE_BY_CHECKBOX_KEY = 'pay_later_approve_by_checkbox'

export function payLaterApproveByCheckbox(
  settings: Record<string, unknown> | null | undefined,
): boolean {
  return Boolean(settings?.[PAY_LATER_APPROVE_BY_CHECKBOX_KEY])
}
