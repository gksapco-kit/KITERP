import { getStorefrontApiBaseUrl } from '@/lib/apiBase'

const DIRECT_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.ogv', '.ogg']

/** Seek a fraction of a second so browsers paint a poster frame instead of a black tile. */
export function videoPreviewSrc(url: string): string {
  const trimmed = url.trim()
  if (!trimmed || trimmed.includes('#')) return trimmed
  return `${trimmed}#t=0.15`
}

/** True when the URL points to a directly-playable video file (e.g. uploaded from a device). */
export function isDirectVideoFile(url: string): boolean {
  const trimmed = url.trim().toLowerCase()
  if (!trimmed) return false
  let path = trimmed
  try {
    // Base handles relative /uploads/… paths as well as absolute URLs.
    path = new URL(trimmed, 'http://local').pathname
  } catch {
    path = trimmed.split('?')[0].split('#')[0]
  }
  return DIRECT_VIDEO_EXTENSIONS.some(ext => path.endsWith(ext))
}

const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'instagr.am', 'www.instagr.am'])
const INSTAGRAM_KINDS = new Set(['p', 'reel', 'reels', 'tv'])

/** Normalize Instagram post/reel/TV path kind for the official embed endpoint. */
function normalizeInstagramKind(kind: string): 'p' | 'reel' | 'tv' | null {
  if (kind === 'p') return 'p'
  if (kind === 'tv') return 'tv'
  if (kind === 'reel' || kind === 'reels') return 'reel'
  return null
}

/**
 * Convert Instagram post / reel / IGTV URLs to the official embed iframe src.
 * Accepts watch URLs and already-embed URLs.
 */
export function getInstagramEmbedUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  try {
    const u = new URL(trimmed)
    if (!INSTAGRAM_HOSTS.has(u.hostname.toLowerCase())) return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null

    const kind = normalizeInstagramKind(parts[0].toLowerCase())
    if (!kind) return null

    const code = parts[1]
    if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) return null

    // Prefer captioned=false clean player; trailing /embed is required for iframe.
    return `https://www.instagram.com/${kind}/${code}/embed`
  } catch {
    return null
  }
}

export function isInstagramEmbedUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase()
  if (!trimmed) return false
  try {
    const u = new URL(trimmed)
    if (!INSTAGRAM_HOSTS.has(u.hostname.toLowerCase())) return false
    return u.pathname.includes('/embed') || INSTAGRAM_KINDS.has(u.pathname.split('/').filter(Boolean)[0] || '')
  } catch {
    return Boolean(getInstagramEmbedUrl(trimmed))
  }
}

/** Shortcode from an Instagram watch or embed URL, if present. */
export function getInstagramShortcode(url: string): string | null {
  const embed = getInstagramEmbedUrl(url)
  if (!embed) return null
  try {
    const parts = new URL(embed).pathname.split('/').filter(Boolean)
    return parts[1] || null
  } catch {
    return null
  }
}

/** True when the player should show a poster first and open on click (YouTube / Instagram). */
export function usesClickToPlayPoster(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed || isDirectVideoFile(trimmed)) return false
  if (getInstagramEmbedUrl(trimmed)) return true
  const embed = getVideoEmbedUrl(trimmed)
  return Boolean(embed?.includes('youtube.com/embed/'))
}

/** Resolve YouTube / Vimeo / Instagram watch URLs to embed iframe src. */
export function getVideoEmbedUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  try {
    const u = new URL(trimmed)
    const host = u.hostname.toLowerCase()

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      const id = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop()
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (host.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop()
      return id ? `https://player.vimeo.com/video/${id}` : null
    }

    const ig = getInstagramEmbedUrl(trimmed)
    if (ig) return ig

    // Unknown http(s) URL — allow only if it already looks like an embeddable player URL.
    // Do not pass raw Instagram watch pages through (they refuse to frame).
    if (INSTAGRAM_HOSTS.has(host)) return null
    return trimmed
  } catch {
    return null
  }
}

/**
 * Poster image for click-to-play tiles.
 * YouTube: stable mqdefault. Instagram: proxied via our API (browser can't hotlink IG CDN).
 */
export function getVideoThumbnailUrl(url: string): string | null {
  const embed = getVideoEmbedUrl(url)
  if (!embed) return null
  if (embed.includes('youtube.com/embed/')) {
    const id = embed.replace(/^https:\/\/www\.youtube\.com\/embed\//, '').split('?')[0]
    return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null
  }
  if (getInstagramShortcode(url)) {
    const base = getStorefrontApiBaseUrl().replace(/\/$/, '')
    return `${base}/public/sites/video-poster?url=${encodeURIComponent(url.trim())}`
  }
  return null
}
