import type { TemplateAttachment } from '@/api/crm'

export type TemplateSettings = {
  cta_label?: string
  cta_url?: string
  footer_text?: string
}

export const DEFAULT_WHATSAPP_BODY = `*Celebrate bigger and shop smarter!* 🌟

_Explore stunning collections designed for your upcoming celebrations._ ✨

*Avail exclusive offers:*
✅ Special offer for {{contact.first_name}}
✅ Limited-time discount on selected items
✅ Free consultation at our showroom

*Visit your nearest {{vendor.name}} showroom today.* 💫`

export const DEFAULT_WHATSAPP_FOOTER = '*T&C Apply\nReply STOP to Unsubscribe'

export const RICH_FORMAT_CHIPS = [
  { label: 'Bold', wrap: ['*', '*'], hint: '*text*' },
  { label: 'Italic', wrap: ['_', '_'], hint: '_text_' },
  { label: 'Check item', prefix: '✅ ' },
  { label: 'Sparkle', suffix: ' ✨' },
]

export function readTemplateSettings(raw?: TemplateSettings | Record<string, unknown> | null): TemplateSettings {
  if (!raw || typeof raw !== 'object') return {}
  return {
    cta_label: typeof raw.cta_label === 'string' ? raw.cta_label : '',
    cta_url: typeof raw.cta_url === 'string' ? raw.cta_url : '',
    footer_text: typeof raw.footer_text === 'string' ? raw.footer_text : '',
  }
}

export function formatRichMessageToHtml(text: string): string {
  if (!text.trim()) return ''
  const lines = text.split('\n')
  const parts: string[] = []
  let inList = false

  const inlineFmt = (line: string) =>
    line
      .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
      .replace(/_([^_\n]+)_/g, '<em>$1</em>')

  for (const raw of lines) {
    const trimmed = raw.trim()
    const isCheck = /^✅/.test(trimmed) || /^[-•]/.test(trimmed)
    if (isCheck) {
      if (!inList) {
        parts.push('<ul class="space-y-1.5 my-2 list-none p-0">')
        inList = true
      }
      const content = inlineFmt(trimmed.replace(/^✅\s*/, '').replace(/^[-•]\s*/, ''))
      parts.push(`<li class="flex gap-2 items-start"><span class="shrink-0">✅</span><span>${content}</span></li>`)
    } else {
      if (inList) {
        parts.push('</ul>')
        inList = false
      }
      if (trimmed) parts.push(`<p class="my-1 leading-relaxed">${inlineFmt(raw)}</p>`)
      else parts.push('<div class="h-2"></div>')
    }
  }
  if (inList) parts.push('</ul>')
  return parts.join('')
}

export function headerAttachment(attachments?: TemplateAttachment[] | null): TemplateAttachment | null {
  if (!attachments?.length) return null
  return attachments.find(a => a.is_header) ?? attachments[0] ?? null
}

/** Prefer rich/plain message body for email when the user edits the shared message field. */
export function resolveEmailBodyHtml(bodyHtml: string, bodyText: string): string {
  if (bodyText.trim()) return formatRichMessageToHtml(bodyText)
  return bodyHtml
}

export function insertAtCursor(
  value: string,
  insertion: string,
  selectionStart: number,
  selectionEnd: number,
): { value: string; cursor: number } {
  const before = value.slice(0, selectionStart)
  const after = value.slice(selectionEnd)
  const next = before + insertion + after
  const cursor = selectionStart + insertion.length
  return { value: next, cursor }
}

export function wrapSelection(
  value: string,
  wrap: [string, string],
  selectionStart: number,
  selectionEnd: number,
): { value: string; cursor: number } {
  const selected = value.slice(selectionStart, selectionEnd) || 'text'
  const insertion = wrap[0] + selected + wrap[1]
  const before = value.slice(0, selectionStart)
  const after = value.slice(selectionEnd)
  return {
    value: before + insertion + after,
    cursor: selectionStart + insertion.length,
  }
}
