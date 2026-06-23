import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Keyboard focus ring for buttons, links, and dropdown triggers (inset so rings aren't clipped by overflow-hidden). */
export const focusRingClassName =
  'focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-inset focus:ring-ring focus:border-primary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:border-primary'

export const solidButtonFocusClassName = 'btn-focus-solid focus-visible:outline-none'

export function hasSolidPrimaryBgClass(className?: string) {
  if (!className) return false
  return /(?:^|\s)bg-primary(?:\s|$)/.test(className)
}

/** Solid green CTA — gradient from-primary or opaque primary fills. */
export function isSolidPrimaryButtonClassName(className?: string) {
  if (!className) return false
  if (hasSolidPrimaryBgClass(className)) return true
  if (/(?:^|\s)bg-primary\/(?:90|85|80)(?:\s|$)/.test(className)) return true
  return /bg-gradient/.test(className) && /(?:^|\s)from-primary(?:\s|$)/.test(className)
}

export function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount)
}

export function formatDate(dateStr?: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

/** Pack assets referenced as /storefront-ui/* in website templates (not on backend). */
const STOREFRONT_UI_ASSET_URLS: Record<string, string> = {
  '/storefront-ui/restaurant-hero.jpg':
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80',
  '/storefront-ui/retail-hero.jpg':
    'https://images.unsplash.com/photo-1495121605193-b116b5b9c5fe?auto=format&fit=crop&w=1600&q=80',
  '/storefront-ui/hospital-hero.jpg':
    'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1600&q=80',
}

/** Resolve image URLs: absolute pass through; gallery pack stays on frontend; uploads use backend. */
export function mediaUrl(url?: string | null): string {
  return imgUrl(url)
}

export function imgUrl(url?: string | null): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) return url
  if (url.startsWith('/business-images')) return url
  const path = url.startsWith('/') ? url : `/${url}`
  const packAsset = STOREFRONT_UI_ASSET_URLS[path]
  if (packAsset) return packAsset
  if (path.startsWith('/storefront-ui/')) return path
  return `${BACKEND_BASE}${path}`
}
