import type { CSSProperties } from 'react'
import type { BlockStyles } from '../types/builder'

export type CookieBannerLayout = 'bar' | 'floating'
export type CookieBannerPosition = 'bottom-left' | 'bottom-right' | 'bottom-center'

export const COOKIE_BANNER_FLOAT_POSITION: Record<CookieBannerPosition, string> = {
  'bottom-left': 'bottom-4 left-4 right-4 sm:right-auto sm:max-w-md',
  'bottom-right': 'bottom-4 left-4 right-4 sm:left-auto sm:max-w-md',
  'bottom-center': 'bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:max-w-lg sm:-translate-x-1/2',
}

export function cookieBannerPanelStyle(styles: BlockStyles): CSSProperties {
  return {
    backgroundColor: styles.backgroundColor ?? '#ffffff',
    color: styles.textColor ?? '#1f2937',
    padding: styles.padding ?? '20px 24px',
    borderRadius: styles.borderRadius ?? '12px',
    boxShadow: styles.boxShadow ?? '0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0,0,0,0.05)',
    borderWidth: styles.borderWidth,
    borderColor: styles.borderColor,
    borderStyle: styles.borderStyle as CSSProperties['borderStyle'],
  }
}

export function cookieBannerAcceptStyle(styles: BlockStyles): CSSProperties {
  return {
    backgroundColor: styles.gradientFrom ?? '#4f46e5',
    color: '#ffffff',
    borderRadius: styles.borderRadius ? `calc(${styles.borderRadius} / 2)` : '8px',
  }
}
