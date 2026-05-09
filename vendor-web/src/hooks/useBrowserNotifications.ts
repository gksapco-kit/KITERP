/**
 * Browser Push Notification API hook.
 * Handles permission requests and showing desktop notifications.
 */
import { useState, useEffect, useCallback } from 'react'

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

const VENDOR_ICON = '/favicon.ico'

export function useBrowserNotifications() {
  const isSupported = typeof window !== 'undefined' && 'Notification' in window

  const [permission, setPermission] = useState<PermissionState>(() => {
    if (!isSupported) return 'unsupported'
    return Notification.permission as PermissionState
  })

  // Keep in sync if the user changes browser settings externally
  useEffect(() => {
    if (!isSupported) return
    setPermission(Notification.permission as PermissionState)
  }, [isSupported])

  const request = useCallback(async (): Promise<PermissionState> => {
    if (!isSupported) return 'unsupported'
    const result = await Notification.requestPermission()
    setPermission(result as PermissionState)
    return result as PermissionState
  }, [isSupported])

  const show = useCallback(
    (title: string, body: string, options?: { tag?: string; icon?: string }) => {
      if (!isSupported || Notification.permission !== 'granted') return
      try {
        const n = new Notification(title, {
          body,
          icon: options?.icon ?? VENDOR_ICON,
          tag: options?.tag,
          silent: true, // we handle sound ourselves
        })
        // Auto-close after 6 s
        setTimeout(() => n.close(), 6000)
      } catch {
        // Some browsers restrict Notification outside of SW context — ignore
      }
    },
    [isSupported],
  )

  return { isSupported, permission, request, show }
}
