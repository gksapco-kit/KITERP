import type { LucideIcon } from 'lucide-react'
import { Facebook, Instagram, Twitter, Youtube } from 'lucide-react'

export type FooterSocialPlatform = 'twitter' | 'facebook' | 'instagram' | 'youtube'

export const FOOTER_SOCIAL_PLATFORMS: Array<{
  key: FooterSocialPlatform
  label: string
  Icon: LucideIcon
}> = [
  { key: 'twitter', label: 'Twitter / X', Icon: Twitter },
  { key: 'facebook', label: 'Facebook', Icon: Facebook },
  { key: 'instagram', label: 'Instagram', Icon: Instagram },
  { key: 'youtube', label: 'YouTube', Icon: Youtube },
]

export const DEFAULT_FOOTER_SOCIAL_LINKS: Record<FooterSocialPlatform, string> = {
  twitter: '',
  facebook: '',
  instagram: '',
  youtube: '',
}

export function normalizeFooterSocialLinks(
  raw?: Record<string, string> | null,
): Record<FooterSocialPlatform, string> {
  const next = { ...DEFAULT_FOOTER_SOCIAL_LINKS }
  if (!raw || typeof raw !== 'object') return next
  for (const { key } of FOOTER_SOCIAL_PLATFORMS) {
    const val = raw[key]
    if (typeof val === 'string') next[key] = val.trim()
  }
  return next
}
