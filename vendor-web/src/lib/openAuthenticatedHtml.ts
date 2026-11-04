import axios from 'axios'
import { withNoScriptCsp } from '@/lib/htmlSafety'

/** Fetch HTML with auth (axios), then open in a new tab via blob URL (same as offer-letter preview). */
export async function openAuthenticatedHtml(htmlPromise: Promise<string>): Promise<void> {
  const raw = await htmlPromise
  if (!raw?.trim()) {
    throw new Error('empty_response')
  }
  const html = withNoScriptCsp(raw)
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  if (!win) {
    URL.revokeObjectURL(url)
    throw new Error('popup_blocked')
  }
}

export function messageForAuthenticatedHtmlError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'popup_blocked') {
      return 'Allow pop-ups to view the payslip.'
    }
    if (error.message === 'empty_response') {
      return 'Payslip came back empty from the server.'
    }
  }
  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    if (typeof data === 'object' && data && 'detail' in data) {
      const detail = (data as { detail: unknown }).detail
      if (typeof detail === 'string') return detail
      if (Array.isArray(detail)) {
        return detail.map(d => (typeof d === 'object' && d && 'msg' in d ? String((d as { msg: unknown }).msg) : String(d))).join(', ')
      }
    }
    if (typeof data === 'string' && data.trim()) return data.slice(0, 240)
    if (error.response?.status) {
      return `Could not load payslip (HTTP ${error.response.status}).`
    }
  }
  return 'Could not load payslip — check your session and try again.'
}
