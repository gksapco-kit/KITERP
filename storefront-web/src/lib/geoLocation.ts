/**
 * Thin wrapper around the browser Geolocation API.
 * Used for employee clock-in/out and background location pings.
 */

export interface GeoCoords {
  lat: number
  lng: number
  accuracy?: number
  speed?: number | null
  heading?: number | null
}

/** Attempt to get current position; resolves null if unavailable or denied. */
export async function getCurrentPosition(
  options: PositionOptions = { enableHighAccuracy: true, timeout: 8000 },
): Promise<GeoCoords | null> {
  if (!navigator.geolocation) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
        })
      },
      () => resolve(null),
      options,
    )
  })
}

/** Returns battery level (0-100) if the Battery API is available, otherwise null. */
export async function getBatteryLevel(): Promise<number | null> {
  try {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number }> }
    if (typeof nav.getBattery === 'function') {
      const bat = await nav.getBattery()
      return Math.round(bat.level * 100)
    }
  } catch {
    // ignore
  }
  return null
}
