import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { getVendorSlug } from './vendorConfig'

/** Android emulator: host machine is 10.0.2.2, not 127.0.0.1/localhost. */
function rewriteLoopbackForAndroid(base: string): string {
  if (Platform.OS !== 'android') return base
  return base
    .replace('://127.0.0.1', '://10.0.2.2')
    .replace('://localhost', '://10.0.2.2')
}

/**
 * Base origin for the storefront SPA (no trailing slash).
 * Priority:
 * 1. EXPO_PUBLIC_STOREFRONT_URL
 * 2. vendor config / app.extra.storefrontBaseUrl
 * 3. __DEV__ → loopback :3002
 * 4. production → https://kiterp.com
 */
export function getStorefrontBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_STOREFRONT_URL?.trim()
  if (fromEnv) return rewriteLoopbackForAndroid(fromEnv.replace(/\/$/, ''))

  const fromExtra = (Constants.expoConfig?.extra?.storefrontBaseUrl as string | undefined)?.trim()
  if (fromExtra) return rewriteLoopbackForAndroid(fromExtra.replace(/\/$/, ''))

  if (__DEV__) {
    return rewriteLoopbackForAndroid('http://127.0.0.1:3002')
  }

  return 'https://kiterp.com'
}

/** Full customer store URL for the locked vendor, e.g. …/testotp */
export function getBrandedStorefrontUrl(path = ''): string {
  const slug = getVendorSlug()
  if (!slug) return getStorefrontBaseUrl()

  const base = `${getStorefrontBaseUrl()}/${encodeURIComponent(slug)}`
  if (!path || path === '/') return base

  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}
