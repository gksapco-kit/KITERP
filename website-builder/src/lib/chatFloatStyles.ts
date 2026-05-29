import type { CSSProperties } from 'react'
import type { BlockStyles } from '../types/builder'

export type ChatFloatPosition = 'bottom-right' | 'bottom-left'

export function chatFloatButtonStyle(styles: BlockStyles): CSSProperties {
  return {
    backgroundColor: styles.backgroundColor ?? '#25D366',
    color: styles.textColor ?? '#ffffff',
    padding: styles.padding ?? '14px',
    borderRadius: styles.borderRadius ?? '9999px',
    fontSize: styles.fontSize ?? '14px',
    fontWeight: styles.fontWeight ?? 600,
    boxShadow: styles.boxShadow ?? '0 4px 20px rgba(37, 211, 102, 0.45)',
    borderWidth: styles.borderWidth,
    borderColor: styles.borderColor,
    borderStyle: styles.borderStyle as CSSProperties['borderStyle'],
  }
}

export const CHAT_FLOAT_POSITION_CLASS: Record<ChatFloatPosition, string> = {
  'bottom-right': 'bottom-6 right-6',
  'bottom-left': 'bottom-6 left-6',
}

export function buildWhatsAppUrl(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return '#'
  const base = `https://wa.me/${digits}`
  const text = message?.trim()
  if (text) return `${base}?text=${encodeURIComponent(text)}`
  return base
}

export function resolveChatFloatUrl(
  provider: 'whatsapp' | 'custom' | undefined,
  phone: string | undefined,
  message: string | undefined,
  customUrl: string | undefined,
): string {
  if (provider === 'custom' && customUrl?.trim()) return customUrl.trim()
  return buildWhatsAppUrl(phone ?? '', message)
}
