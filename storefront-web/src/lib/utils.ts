import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

export function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount)
}

export function formatDate(dateStr?: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

/** Resolve image URLs: absolute pass through; gallery pack stays on frontend; uploads use backend. */
export function mediaUrl(url?: string | null): string {
  return imgUrl(url)
}

export function imgUrl(url?: string | null): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) return url
  if (url.startsWith('/business-images')) return url
  return `${BACKEND_BASE}${url}`
}
