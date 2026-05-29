import type { CSSProperties } from 'react'
import type { BlockStyles } from '../types/builder'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'
export type ToastPosition =
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'bottom-center'

export const TOAST_VARIANT_STYLES: Record<
  ToastVariant,
  { accent: string; iconBg: string; defaultBg: string; defaultText: string }
> = {
  success: {
    accent: '#16a34a',
    iconBg: '#dcfce7',
    defaultBg: '#ffffff',
    defaultText: '#111827',
  },
  error: {
    accent: '#dc2626',
    iconBg: '#fee2e2',
    defaultBg: '#ffffff',
    defaultText: '#111827',
  },
  warning: {
    accent: '#d97706',
    iconBg: '#fef3c7',
    defaultBg: '#ffffff',
    defaultText: '#111827',
  },
  info: {
    accent: '#2563eb',
    iconBg: '#dbeafe',
    defaultBg: '#ffffff',
    defaultText: '#111827',
  },
}

export const TOAST_POSITION_CLASS: Record<ToastPosition, string> = {
  'top-right': 'top-6 right-6',
  'top-left': 'top-6 left-6',
  'bottom-right': 'bottom-6 right-6',
  'bottom-left': 'bottom-6 left-6',
  'top-center': 'top-6 left-1/2 -translate-x-1/2',
  'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
}

export function toastNotificationStyle(styles: BlockStyles, variant: ToastVariant): CSSProperties {
  const v = TOAST_VARIANT_STYLES[variant]
  return {
    backgroundColor: styles.backgroundColor ?? v.defaultBg,
    color: styles.textColor ?? v.defaultText,
    padding: styles.padding ?? '14px 16px',
    borderRadius: styles.borderRadius ?? '12px',
    boxShadow: styles.boxShadow ?? '0 10px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0,0,0,0.04)',
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
    borderLeftColor: v.accent,
    maxWidth: styles.maxWidth ?? '360px',
    width: styles.width ?? 'min(360px, calc(100vw - 48px))',
  }
}
