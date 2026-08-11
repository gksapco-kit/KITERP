import Constants from 'expo-constants'

const extra = (Constants.expoConfig?.extra || {}) as { primaryColor?: string } | undefined
const configuredPrimary = extra?.primaryColor?.trim() || ''
const primary = configuredPrimary || '#64C3A0'
const usingCustomPrimary = Boolean(configuredPrimary)

/** Brand primary — vendor config at build time, else KITERP mint */
export const BRAND = {
  primary,
  primaryDark: usingCustomPrimary ? primary : '#4AA886',
  primarySoft: usingCustomPrimary ? '#DBEAFE' : '#E8F8F2',
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
