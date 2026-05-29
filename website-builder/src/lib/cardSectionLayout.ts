import type { BlockProps } from '../types/builder'

/** Default grid card image height (matches previous Tailwind h-44). */
export const DEFAULT_CARD_IMAGE_HEIGHT = '176px'

export const CARD_IMAGE_HEIGHT_PRESETS: { label: string; value: string }[] = [
  { label: 'Compact (120px)', value: '120px' },
  { label: 'Medium (176px)', value: '176px' },
  { label: 'Large (220px)', value: '220px' },
  { label: 'Extra large (280px)', value: '280px' },
]

export function resolveCardImageHeight(props: Pick<BlockProps, 'cardImageHeight'> | undefined): string {
  const raw = props?.cardImageHeight?.trim()
  if (!raw) return DEFAULT_CARD_IMAGE_HEIGHT
  if (/^\d+$/.test(raw)) return `${raw}px`
  return raw
}
