/** Persisted KIT ERP dashboard color themes (primary / accent palette). */
import { KIT_ERP_PALETTE } from '@/lib/kitErpColorPalette'

export type KitErpThemeId = 'mint' | 'kit-brand' | 'ocean' | 'indigo' | 'amber' | 'rose' | 'slate'

export const DEFAULT_KIT_ERP_THEME_ID: KitErpThemeId = 'mint'

export type KitErpThemeOption = {
  id: KitErpThemeId
  name: string
  description: string
  /** Preview swatches — primary, accent, surface */
  swatches: [string, string, string]
}

export const KIT_ERP_THEME_OPTIONS: KitErpThemeOption[] = [
  {
    id: 'mint',
    name: 'KIT Mint',
    description: 'Default brand green — calm and familiar.',
    swatches: ['#64C3A0', '#2D6B52', '#F4F7F9'],
  },
  {
    id: 'kit-brand',
    name: 'KIT Brand',
    description: 'Official KIT ERP palette — mint, purple & warm orange.',
    swatches: [KIT_ERP_PALETTE.primary, KIT_ERP_PALETTE.secondary, KIT_ERP_PALETTE.background],
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    description: 'Crisp blue accents for a modern SaaS feel.',
    swatches: ['#0EA5E9', '#0369A1', '#F0F9FF'],
  },
  {
    id: 'indigo',
    name: 'Indigo Pro',
    description: 'Deep indigo highlights with a polished look.',
    swatches: ['#6366F1', '#4338CA', '#EEF2FF'],
  },
  {
    id: 'amber',
    name: 'Warm Amber',
    description: 'Energetic amber tones for a bold workspace.',
    swatches: ['#F59E0B', '#B45309', '#FFFBEB'],
  },
  {
    id: 'rose',
    name: 'Rose Coral',
    description: 'Soft rose accents with a friendly tone.',
    swatches: ['#F43F5E', '#BE123C', '#FFF1F2'],
  },
  {
    id: 'slate',
    name: 'Slate Neutral',
    description: 'Understated slate — minimal color distraction.',
    swatches: ['#64748B', '#334155', '#F8FAFC'],
  },
]

export function getKitErpThemeOption(id: KitErpThemeId): KitErpThemeOption {
  return KIT_ERP_THEME_OPTIONS.find((t) => t.id === id) ?? KIT_ERP_THEME_OPTIONS[0]
}
