import type { CSSProperties } from 'react'
import type { BlockStyles } from '../types/builder'

export function backToTopButtonStyle(styles: BlockStyles): CSSProperties {
  return {
    backgroundColor: styles.backgroundColor ?? '#4f46e5',
    color: styles.textColor ?? '#ffffff',
    padding: styles.padding ?? '12px 20px',
    borderRadius: styles.borderRadius ?? '9999px',
    fontSize: styles.fontSize,
    fontWeight: styles.fontWeight,
    boxShadow: styles.boxShadow ?? '0 4px 14px rgba(0, 0, 0, 0.15)',
    borderWidth: styles.borderWidth,
    borderColor: styles.borderColor,
    borderStyle: styles.borderStyle as CSSProperties['borderStyle'],
  }
}

export const BACK_TO_TOP_POSITION_CLASS: Record<
  'bottom-right' | 'bottom-left' | 'bottom-center',
  string
> = {
  'bottom-right': 'bottom-6 right-6',
  'bottom-left': 'bottom-6 left-6',
  'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
}
