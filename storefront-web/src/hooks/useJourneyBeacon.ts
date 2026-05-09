import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '')
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
 * Sends lightweight `page_view` journey events to the backend so the CRM can
 * map customer journeys (channel → page → conversion).
 */
export function useJourneyBeacon(vendorId?: string, customerId?: string) {
  const location = useLocation()
  const lastPathRef = useRef<string>('')

  useEffect(() => {
    if (!vendorId) return
    const path = location.pathname + location.search
    if (path === lastPathRef.current) return
    lastPathRef.current = path

    const payload = {
      event_type: 'page_view',
      visitor_id: getVisitorId(),
      customer_id: customerId,
      payload: {
        path,
        title: typeof document !== 'undefined' ? document.title : '',
        referrer: typeof document !== 'undefined' ? document.referrer : '',
      },
    }
    try {
      const url = `${API_URL}/public/crm/journey/beacon/${vendorId}`
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
    } catch { /* ignore */ }
  }, [location.pathname, location.search, vendorId, customerId])
}

export function trackJourneyEvent(vendorId: string, eventType: string, payload?: Record<string, unknown>, customerId?: string) {
  if (!vendorId) return
  const body = JSON.stringify({
    event_type: eventType,
    visitor_id: getVisitorId(),
    customer_id: customerId,
    payload: payload || {},
  })
  const url = `${API_URL}/public/crm/journey/beacon/${vendorId}`
  if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
  } else {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body, keepalive: true,
    }).catch(() => { /* ignore */ })
  }
}
