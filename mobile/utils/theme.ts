import Constants from 'expo-constants'

/** Brand primary — vendor config at build time, else KITERP blue */
export const BRAND = {
  primary: (Constants.expoConfig?.extra as { primaryColor?: string } | undefined)?.primaryColor
    || '#64C3A0',
  primaryDark: '#4AA886',
  primarySoft: '#E8F8F2',
  bg: '#F5F7F6',
  card: '#FFFFFF',
  text: '#1A2E28',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
  warning: '#F59E0B',
  white: '#FFFFFF',
}

export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
  const h = hex.replace('#', '')
  return `#${h}${a}`
}
