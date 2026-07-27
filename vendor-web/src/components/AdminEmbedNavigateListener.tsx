import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ADMIN_EMBED_NAVIGATE,
  ADMIN_EMBED_NAVIGATED,
  ADMIN_EMBED_READY,
  isTrustedAdminEmbedOrigin,
  sanitizeEmbedNavigatePath,
} from '@/lib/adminEmbedBridge'
import { isVendorAdminEmbed } from '@/lib/adminEmbed'

function notifyParent(type: string, extra?: Record<string, unknown>) {
  try {
    window.parent.postMessage({ type, ...extra }, '*')
  } catch {
    /* ignore */
  }
}

/**
 * When platform admin HR embeds vendor-web, menu switches soft-navigate via
 * postMessage instead of reloading the iframe document.
 */
export default function AdminEmbedNavigateListener() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isVendorAdminEmbed()) return undefined

    const onMessage = (event: MessageEvent) => {
      if (!isTrustedAdminEmbedOrigin(event.origin)) return
      if (event.data?.type !== ADMIN_EMBED_NAVIGATE) return

      const path = sanitizeEmbedNavigatePath(event.data?.path)
      if (!path) return

      const [pathname, qs = ''] = path.split('?')
      const search = qs ? `?${qs}` : ''
      const embedSearch =
        search.includes('embed=')
          ? search
          : search
            ? `${search}&embed=1`
            : '?embed=1'

      navigate({ pathname, search: embedSearch })
      notifyParent(ADMIN_EMBED_NAVIGATED, { path: pathname })
    }

    window.addEventListener('message', onMessage)
    notifyParent(ADMIN_EMBED_READY)

    return () => window.removeEventListener('message', onMessage)
  }, [navigate])

  return null
}
