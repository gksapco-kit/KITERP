import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import {
  ADMIN_EMBED_AUTH_RESPONSE,
  ADMIN_EMBED_REQUEST_AUTH,
  type AdminEmbedAuthResponse,
} from '@/lib/adminEmbedAuth'

/** Top-level admin window: share session with nested /dashboard/embed iframes. */
export default function AdminEmbedAuthBridge() {
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== ADMIN_EMBED_REQUEST_AUTH) return
      const source = event.source
      if (!source || typeof (source as Window).postMessage !== 'function') return

      const { accessToken, refreshToken } = useAuthStore.getState()
      if (!accessToken) return

      const payload: AdminEmbedAuthResponse = {
        type: ADMIN_EMBED_AUTH_RESPONSE,
        accessToken,
        refreshToken: refreshToken ?? '',
      }
      ;(source as Window).postMessage(payload, event.origin)
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return null
}
