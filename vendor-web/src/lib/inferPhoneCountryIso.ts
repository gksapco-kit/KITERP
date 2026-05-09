/**
 * Infer a default phone country (ISO 3166-1 alpha-2) from the user's network
 * location and browser locale. Result is cached for the tab session.
 */
import { COUNTRIES } from '@/data/countries'

const CACHE_KEY = 'kiterp_inferred_phone_country_iso_v1'
const VALID = new Set(COUNTRIES.map(c => c.iso))

function normalize(iso: string | null | undefined): string | null {
  if (!iso) return null
  const u = String(iso).trim().toUpperCase()
  if (u.length !== 2) return null
  return VALID.has(u) ? u : null
}

/** Synchronous read of a previously inferred country (same tab session). */
export function getCachedInferredPhoneCountryIso(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return normalize(sessionStorage.getItem(CACHE_KEY))
  } catch {
    return null
  }
}

function cache(iso: string) {
  try {
    sessionStorage.setItem(CACHE_KEY, iso)
  } catch {
    /* private mode / quota */
  }
}

function regionFromNavigatorLocale(): string | null {
  try {
    const tags = [navigator.language, ...(navigator.languages ?? [])]
    for (const tag of tags) {
      if (!tag) continue
      const loc = new Intl.Locale(tag)
      if (loc.region) {
        const n = normalize(loc.region)
        if (n) return n
      }
    }
  } catch {
    /* older browsers */
  }
  return null
}

async function fetchJson<T>(url: string, ms: number): Promise<T | null> {
  const ac = new AbortController()
  const t = window.setTimeout(() => ac.abort(), ms)
  try {
    const r = await fetch(url, { signal: ac.signal, credentials: 'omit' })
    if (!r.ok) return null
    return (await r.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

/**
 * Best-effort country from IP geolocation, then browser locale. Caches in sessionStorage.
 * Returns `null` if nothing could be resolved (caller should use their own default, e.g. IN).
 */
export async function inferPhoneCountryIsoFromLocation(): Promise<string | null> {
  const cached = getCachedInferredPhoneCountryIso()
  if (cached) return cached

  // 1) ipapi.co — HTTPS, CORS-friendly for browser use
  const ipapi = await fetchJson<{ country_code?: string; error?: boolean }>('https://ipapi.co/json/', 5000)
  if (ipapi && !ipapi.error) {
    const n = normalize(ipapi.country_code)
    if (n) {
      cache(n)
      return n
    }
  }

  // 2) ipwho.is — backup
  const ipwho = await fetchJson<{ success?: boolean; country_code?: string }>('https://ipwho.is/?format=json', 5000)
  if (ipwho?.success && ipwho.country_code) {
    const n = normalize(ipwho.country_code)
    if (n) {
      cache(n)
      return n
    }
  }

  // 3) Browser locale (e.g. en-KZ, ru-KZ)
  const fromLocale = regionFromNavigatorLocale()
  if (fromLocale) {
    cache(fromLocale)
    return fromLocale
  }

  return null
}

/** Warm the cache as soon as the auth screen loads so the picker is right when the user switches to phone. */
export function prefetchInferredPhoneCountry(): void {
  if (typeof window === 'undefined') return
  if (getCachedInferredPhoneCountryIso()) return
  void inferPhoneCountryIsoFromLocation()
}
