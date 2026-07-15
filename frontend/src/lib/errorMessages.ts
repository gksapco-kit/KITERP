import type { AxiosError } from 'axios'

/** True when the request never got a useful HTTP response (offline, proxy down, timeout). */
export function isAxiosNetworkError(error: unknown): boolean {
  const ax = error as AxiosError
  if (ax?.response) return false
  const code = ax?.code ?? ''
  const msg = ax?.message ?? ''
  return (
    code === 'ERR_NETWORK'
    || code === 'ECONNABORTED'
    || msg.includes('Network Error')
    || msg.toLowerCase().includes('timeout')
  )
}

/** True when the server rejected credentials or the session is invalid. */
export function isAxiosAuthError(error: unknown): boolean {
  const ax = error as AxiosError
  const status = ax?.response?.status
  return status === 401 || status === 403
}
