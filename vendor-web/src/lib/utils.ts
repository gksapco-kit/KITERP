import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { MouseEvent } from 'react'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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

/**
 * Derive the backend origin (e.g. http://localhost:8000) from the available env vars.
 * Priority: VITE_BACKEND_URL → VITE_API_URL stripped of /api/v1 → VITE_API_BASE → fallback.
 */
function backendOrigin(): string {
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '')
  if (import.meta.env.VITE_API_URL)     return import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '')
  if (import.meta.env.VITE_API_BASE)    return import.meta.env.VITE_API_BASE.replace(/\/$/, '')
  return 'http://localhost:8000'
}

/**
 * Resolve any image/media URL stored in the DB.
 * - Absolute URLs (http/https/data:) pass through unchanged.
 * - Builder gallery pack assets under /business-images stay on the frontend origin.
 * - Other relative paths like /uploads/... are prefixed with the backend origin.
 */
export function mediaUrl(url?: string | null): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url
  if (url.startsWith('/business-images')) return url
  const base = backendOrigin()
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`
}
