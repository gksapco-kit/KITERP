/**
 * Employee field-tracking for Expo mobile.
 *
 * Uses expo-location + expo-task-manager to send GPS breadcrumbs
 * to the backend every ~60 seconds while the employee is clocked in.
 *
 * Install dependencies:
 *   npx expo install expo-location expo-task-manager expo-battery
 *
 * Add to app.json / app.config.js:
 *   {
 *     "plugins": [
 *       ["expo-location", { "locationAlwaysAndWhenInUsePermission": "Allow KIT ERP to use your location for field tracking while on duty." }]
 *     ],
 *     "ios": { "infoPlist": { "UIBackgroundModes": ["location", "fetch"] } }
 *   }
 */

import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { hrApi } from '../api/hr'

export const LOCATION_TASK_NAME = 'KITERP_FIELD_LOCATION_TASK'

/** Called by TaskManager in the background with new GPS positions. */
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.warn('[LocationTask] error:', error.message)
    return
  }

  const locations: Location.LocationObject[] = data?.locations ?? []
  if (!locations.length) return

  const pos = locations[locations.length - 1] // most recent
  const payload = {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? undefined,
    speed: pos.coords.speed,
    heading: pos.coords.heading,
    recorded_at: new Date(pos.timestamp).toISOString(),
    source: 'app' as const,
  }

  try {
    await hrApi.sendLocationPing(payload)
  } catch {
    // Silently swallow — background tasks cannot surface UI errors
  }
})

/** Request location permissions from the user. Returns true if granted. */
export async function requestLocationPermission(): Promise<boolean> {
  const { status: fg } = await Location.requestForegroundPermissionsAsync()
  if (fg !== 'granted') return false
  const { status: bg } = await Location.requestBackgroundPermissionsAsync()
  return bg === 'granted'
}

/** Start background location updates (call on clock-in). */
export async function startLocationTracking(): Promise<boolean> {
  const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false)
  if (already) return true

  const granted = await requestLocationPermission()
  if (!granted) return false

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 60_000,          // at most every 60 seconds
    distanceInterval: 50,          // or every 50 metres of movement
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'KIT ERP — Field Tracking Active',
      notificationBody: 'Your location is being shared with HR while you are on duty.',
      notificationColor: '#2563eb',
    },
  })
  return true
}

/** Stop background location updates (call on clock-out or app logout). */
export async function stopLocationTracking(): Promise<void> {
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false)
  if (running) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME)
  }
}

/** Returns true when background updates are running. */
export async function isLocationTrackingActive(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false)
}

/** Get a single one-shot position (for clock-in/out capture). */
export async function getOneShot(): Promise<{ lat: number; lng: number; accuracy?: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return null
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    })
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? undefined,
    }
  } catch {
    return null
  }
}
