import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { getStorefrontApiBaseUrl } from '@/lib/apiBase'

const VISITOR_KEY = 'asure_visitor_id'

function getVisitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY)
  if (!id) {
    id = `v_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
    localStorage.setItem(VISITOR_KEY, id)
  }
  return id
}

/**
 * Page views for the platform marketing site (kiterp.com), shown in
 * Super Admin → Website Analytics → Branch → KITERP.com.
 */
export function usePlatformJourneyBeacon() {
  const location = useLocation()
  const lastPathRef = useRef<string>('')

  useEffect(() => {
    const path = location.pathname + location.search
    if (path === lastPathRef.current) return
    lastPathRef.current = path

    const payload = {
      event_type: 'page_view',
      visitor_id: getVisitorId(),
      payload: {
        path,
        title: typeof document !== 'undefined' ? document.title : '',
        referrer: typeof document !== 'undefined' ? document.referrer : '',
        host: typeof window !== 'undefined' ? window.location.host : '',
      },
    }

    try {
      const url = `${getStorefrontApiBaseUrl()}/public/platform/journey/beacon`
      const body = JSON.stringify(payload)
      if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      } else {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => { /* ignore */ })
      }
    } catch {
      /* ignore */
    }
  }, [location.pathname, location.search])
}
