const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const REQUEST_HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'en',
  'User-Agent': 'KITERP-WebsiteBuilder/1.0',
}

export type GeocodeResult = {
  lat: number
  lng: number
  displayName: string
}

/** Parse "19.0760, 72.8777" style coordinate strings. */
export function parseLatLngPair(raw: string): { lat: number; lng: number } | null {
  const match = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (!match) return null
  const lat = parseFloat(match[1])
  const lng = parseFloat(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const q = query.trim()
  if (!q) return null

  const coords = parseLatLngPair(q)
  if (coords) {
    return {
      lat: coords.lat,
      lng: coords.lng,
      displayName: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
    }
  }

  const url = `${NOMINATIM_BASE}/search?format=json&limit=1&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: REQUEST_HEADERS })
  if (!res.ok) return null
  const data = (await res.json()) as { lat?: string; lon?: string; display_name?: string }[]
  const hit = data[0]
  if (!hit?.lat || !hit?.lon) return null
  const lat = parseFloat(hit.lat)
  const lng = parseFloat(hit.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return {
    lat,
    lng,
    displayName: hit.display_name?.trim() || q,
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}`
  const res = await fetch(url, { headers: REQUEST_HEADERS })
  if (!res.ok) return null
  const data = (await res.json()) as { display_name?: string }
  return data.display_name?.trim() || null
}
