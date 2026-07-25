import { useEffect, useState } from 'react'
import { PageLoading } from '@/components/common/Loading'
import { useAuthHydrated } from '@/hooks/useAuthHydrated'
import {
  ADMIN_EMBED_AUTH_RESPONSE,
  ADMIN_EMBED_REQUEST_AUTH,
  type AdminEmbedAuthResponse,
} from '@/lib/adminEmbedAuth'
import { useAuthStore } from '@/stores/authStore'

const AUTH_WAIT_MS = 12_000

/** Acquire admin session inside third-party nested embed iframes (vendor → admin embed). */
export default function EmbedAuthGate({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthHydrated()
  const accessToken = useAuthStore(s => s.accessToken)
  const setTokens = useAuthStore(s => s.setTokens)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!hydrated) return

    if (accessToken) {
      setReady(true)
      setFailed(false)
      return
    }

    setReady(false)
    setFailed(false)

    const urlToken = new URLSearchParams(window.location.search).get('access_token')?.trim()
    if (urlToken) {
      setTokens({
        access_token: urlToken,
        refresh_token: '',
        token_type: 'bearer',
      })
      setReady(true)
      return
    }

    const origin = window.location.origin
    const topWin = window.top

    const applyToken = (token: string, refreshToken = '') => {
      setTokens({
        access_token: token,
        refresh_token: refreshToken,
        token_type: 'bearer',
      })
      setReady(true)
      setFailed(false)
    }

    const requestAuth = () => {
      if (topWin && topWin !== window) {
        topWin.postMessage({ type: ADMIN_EMBED_REQUEST_AUTH }, origin)
      }
    }

    requestAuth()
    const retry = window.setInterval(requestAuth, 800)

    const timeout = window.setTimeout(() => {
      window.clearInterval(retry)
      setFailed(true)
    }, AUTH_WAIT_MS)

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return
      const data = event.data as AdminEmbedAuthResponse | null
      if (!data || data.type !== ADMIN_EMBED_AUTH_RESPONSE) return
      if (!data.accessToken) return

      applyToken(data.accessToken, data.refreshToken || '')
      window.clearTimeout(timeout)
      window.clearInterval(retry)
    }

    window.addEventListener('message', onMessage)
    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(retry)
      window.removeEventListener('message', onMessage)
    }
  }, [hydrated, accessToken, setTokens])

  if (!hydrated || !ready) {
    if (failed) {
      return (
        <div className="flex min-h-[16rem] flex-col items-center justify-center gap-2 p-6 text-center text-sm text-gray-600">
          <p className="font-medium text-gray-900">Could not load Careers inbox</p>
          <p>Reopen HR Management from the admin portal and try again.</p>
        </div>
      )
    }
    return <PageLoading />
  }

  return <>{children}</>
}
