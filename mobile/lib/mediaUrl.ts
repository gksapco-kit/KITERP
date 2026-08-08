import Constants from 'expo-constants'

/**
 * API is typically `https://host/api/v1` — media files live on the host origin
 * as `/uploads/...`.
 */
function mediaOrigin(): string {
  const storefront =
    (Constants.expoConfig?.extra as { storefrontBaseUrl?: string } | undefined)
      ?.storefrontBaseUrl ||
    process.env.EXPO_PUBLIC_STOREFRONT_URL ||
    ''

  if (storefront) {
    return storefront.replace(/\/$/, '')
  }

  const api =
    process.env.EXPO_PUBLIC_API_URL ||
    (__DEV__ ? 'http://10.0.2.2:8000/api/v1' : 'https://kiterp.com/api/v1')

  return api.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '') || 'https://kiterp.com'
}

/**
 * Turn relative upload paths into absolute URLs for React Native Image.
 * Website does this via `mediaUrl` / `imgUrl`; RN cannot load `/uploads/...` alone.
 */
export function mediaUrl(url?: string | null): string {
  if (!url) return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file:')
  ) {
    return trimmed
  }
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${mediaOrigin()}${path}`
}

export function productImageUrl(
  product?: { images?: { url?: string; is_primary?: boolean }[] } | null,
): string {
  const images = product?.images || []
  const primary = images.find((i) => i.is_primary && i.url) || images[0]
  return mediaUrl(primary?.url)
}
