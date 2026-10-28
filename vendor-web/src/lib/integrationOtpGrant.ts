const STORAGE_KEY = 'kiterp.integrationOtpGrant'

type StoredGrant = { token: string; expiresAt: string }

export function readIntegrationOtpGrant(): string | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredGrant
    if (!parsed.token || !parsed.expiresAt || Date.parse(parsed.expiresAt) <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed.token
  } catch {
    return null
  }
}

export function storeIntegrationOtpGrant(token: string, expiresAt: string) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, expiresAt }))
}

export function clearIntegrationOtpGrant() {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function isIntegrationOtpRequired(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status !== 403) return false
  const data = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
  const detail = typeof data?.detail === 'string' ? data.detail : ''
  return /otp/i.test(detail)
}
