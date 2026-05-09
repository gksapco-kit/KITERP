/** localStorage key for vendor /register draft persistence */
export const VENDOR_REGISTER_DRAFT_KEY = 'kiterp:vendor-register-draft'

export function clearVendorRegisterDraft(): void {
  try {
    localStorage.removeItem(VENDOR_REGISTER_DRAFT_KEY)
  } catch {
    /* ignore quota / private mode */
  }
}
