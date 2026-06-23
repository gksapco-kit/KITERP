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

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

const BACKEND_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace('/api/v1', '')

export function mediaUrl(url?: string | null): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) return url
  return `${BACKEND_BASE}${url}`
}
