import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { MouseEvent } from 'react'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Keyboard-only focus for outlined / ghost buttons — offset ring (no double border). */
export const focusRingClassName =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'

/** Marker + tab focus outer line for solid mint/primary buttons (see globals.css). */
export const solidGreenTabFocusClassName = 'kit-solid-green-btn'

/** Tab focus only — white gap + mint outer line; styled in globals.css */
export const solidButtonFocusClassName =
  `btn-focus-solid btn-outer-line ${solidGreenTabFocusClassName} focus-visible:outline-none`

/** Native <button> / link CTA — solid green fill + shared tab-focus chrome */
export const nativeSolidGreenButtonClassName =
  `bg-primary text-white hover:bg-primary/90 ${solidGreenTabFocusClassName}`

/** Default field edge — #9ca3afc4 light / theme --input-color via CSS var. */
export const formFieldBorderClassName = 'border-[1.5px] border-[color:var(--input-color)]'

/** Panel / card outer edge — same weight + #9ca3afc4 (--border-color) as app surfaces. */
export const surfaceBorderClassName = 'border-[1.5px] border-[color:var(--border-color)]'

export const surfacePanelClassName = `rounded-lg ${surfaceBorderClassName} bg-card`

/** Table wrapper — rounded frame on all four corners; overflow clips header to curve. */
export const tableShellClassName = `kiterp-table-shell shadow-sm rounded-lg`

/** Filter / form panel above tables — same border chrome as table shell. */
export const filterPanelClassName = `kiterp-filter-panel shadow-sm rounded-lg p-6`

/** Bordered shell wrapping icon + borderless search input — green focus via :focus-within in globals.css */
export const searchFieldShellClassName =
  `flex items-center gap-2 rounded-xl ${formFieldBorderClassName} bg-background transition-[border-color,box-shadow] duration-150`

/** Inner input inside searchFieldShellClassName — suppress own focus chrome */
export const searchFieldInnerInputClassName =
  'min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0'

/** True when class list includes solid `bg-primary` (not bg-primary/10). */
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

/**
 * Base chrome for native inputs / textareas / selects.
 * Focus ring is applied globally (globals.css) — do not add ring-offset on fields.
 */
export const formFieldClassName =
  `${formFieldBorderClassName} bg-background text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark]`

/** Alias — inset focus for custom triggers that are not native inputs. */
export const formFieldFocusClassName = focusRingClassName

/** Close modal only when clicking the dimmed backdrop, not when events bubble from inputs inside the panel. */
export function onModalBackdropClick(onClose: () => void) {
  return (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }
}

export function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount)
}

export function formatDate(dateStr?: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export function formatDateTime(dateStr?: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

import { normalizeLoopbackOrigin } from '@/lib/loopbackHost'

/**
 * Derive the backend origin (e.g. http://127.0.0.1:8000) from the available env vars.
 * Priority: VITE_BACKEND_URL → VITE_API_URL stripped of /api/v1 → VITE_API_BASE → fallback.
 */
function backendOrigin(): string {
  if (import.meta.env.VITE_BACKEND_URL) return normalizeLoopbackOrigin(import.meta.env.VITE_BACKEND_URL.replace(/\/$/, ''))
  if (import.meta.env.VITE_API_URL) return normalizeLoopbackOrigin(import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '').replace(/\/$/, ''))
  if (import.meta.env.VITE_API_BASE) return normalizeLoopbackOrigin(import.meta.env.VITE_API_BASE.replace(/\/$/, ''))
  return 'http://127.0.0.1:8000'
}

/**
 * Resolve any image/media URL stored in the DB.
 * - Absolute URLs (http/https/data:) pass through unchanged.
 * - Builder gallery pack assets under /business-images stay on the frontend origin.
 * - Other relative paths like /uploads/... are prefixed with the backend origin.
 */
export function mediaUrl(url?: string | null): string {
  if (!url) return ''
  if (url.startsWith('blob:')) return url
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url
  if (url.startsWith('/business-images')) return url
  const base = backendOrigin()
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`
}

const IMAGE_FILE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'])

/** Accept images when the browser omits MIME type (common on Windows). */
export function isLikelyImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  const ext = file.name.split('.').pop()?.toLowerCase()
  return !!ext && IMAGE_FILE_EXTENSIONS.has(ext)
}
