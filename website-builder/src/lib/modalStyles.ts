import type { CSSProperties } from 'react'
import type { BlockStyles } from '../types/builder'

export type ModalLayout = 'classic' | 'glass' | 'sheet' | 'split'
export type ModalIcon = 'none' | 'gift' | 'sparkles' | 'bell' | 'percent' | 'mail'

export const MODAL_MAX_WIDTH = '448px'
export const MODAL_SPLIT_MAX_WIDTH = '560px'

export const MODAL_ICON_STYLES: Record<
  Exclude<ModalIcon, 'none'>,
  { accent: string; iconBg: string; gradient: string }
> = {
  gift: {
    accent: '#7c3aed',
    iconBg: '#ede9fe',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
  },
  sparkles: {
    accent: '#2563eb',
    iconBg: '#dbeafe',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)',
  },
  bell: {
    accent: '#d97706',
    iconBg: '#fef3c7',
    gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
  },
  percent: {
    accent: '#059669',
    iconBg: '#d1fae5',
    gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
  },
  mail: {
    accent: '#db2777',
    iconBg: '#fce7f3',
    gradient: 'linear-gradient(135deg, #db2777 0%, #ec4899 100%)',
  },
}

export function modalPanelStyle(
  styles: BlockStyles,
  layout: ModalLayout,
): CSSProperties {
  const base: CSSProperties = {
    color: styles.textColor ?? '#111827',
    borderRadius: layout === 'sheet' ? '24px 24px 0 0' : (styles.borderRadius ?? '20px'),
    boxShadow:
      styles.boxShadow ??
      '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.04)',
    maxWidth: styles.maxWidth ?? (layout === 'split' ? MODAL_SPLIT_MAX_WIDTH : MODAL_MAX_WIDTH),
    width: '100%',
    overflow: 'hidden',
  }

  if (layout === 'glass') {
    return {
      ...base,
      backgroundColor: styles.backgroundColor ?? 'rgba(255, 255, 255, 0.82)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.45)',
    }
  }

  return {
    ...base,
    backgroundColor: styles.backgroundColor ?? '#ffffff',
  }
}

export function modalPrimaryButtonStyle(styles: BlockStyles, accentGradient: string): CSSProperties {
  return {
    background: styles.gradientFrom && styles.gradientTo
      ? `linear-gradient(135deg, ${styles.gradientFrom}, ${styles.gradientTo})`
      : accentGradient,
    color: '#ffffff',
    borderRadius: styles.borderRadius ? `calc(${styles.borderRadius} / 2.5)` : '12px',
  }
}

export function modalBackdropStyle(opacity: number, blur: boolean): CSSProperties {
  return {
    backgroundColor: `rgba(15, 23, 42, ${opacity})`,
    backdropFilter: blur ? 'blur(6px)' : undefined,
    WebkitBackdropFilter: blur ? 'blur(6px)' : undefined,
  }
}
