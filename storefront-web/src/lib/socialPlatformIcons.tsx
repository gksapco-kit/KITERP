import type { ComponentType, ReactNode } from 'react'
import {
  Globe, MessageCircle, Instagram, Facebook, Twitter, Youtube,
  Linkedin, Github, Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DEFAULT_SOCIAL_LINKS_ICON_STYLE,
  isSocialLinksIconStyle,
  type SocialLinksIconStyle,
} from '@/lib/socialLinksMode'

const BRAND_COLORS: Record<string, string> = {
  website: '#64748b',
  whatsapp: '#25D366',
  instagram: '#E4405F',
  facebook: '#1877F2',
  twitter: '#0f1419',
  x: '#0f1419',
  youtube: '#FF0000',
  linkedin: '#0A66C2',
  tiktok: '#000000',
  pinterest: '#BD081C',
  github: '#181717',
  telegram: '#26A5E4',
  snapchat: '#FFFC00',
}

const PLATFORM_EMOJI: Record<string, string> = {
  website: '🔗',
  whatsapp: '💬',
  instagram: '📷',
  facebook: '📘',
  twitter: '𝕏',
  x: '𝕏',
  youtube: '▶️',
  linkedin: '💼',
  tiktok: '🎵',
  pinterest: '📌',
  github: '🐙',
  telegram: '✈️',
  snapchat: '👻',
}

const FILLED_PATHS: Record<string, string> = {
  facebook:
    'M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.412c0-3.017 1.792-4.683 4.533-4.683 1.312 0 2.686.235 2.686.235v2.967h-1.514c-1.491 0-1.956.93-1.956 1.886v2.262h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z',
  instagram:
    'M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.336 3.608 1.311.975.975 1.249 2.242 1.311 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.336 2.633-1.311 3.608-.975.975-2.242 1.249-3.608 1.311-1.266.058-1.645.07-4.85.07-3.204 0-3.584-.012-4.85-.07-1.366-.062-2.633-.336-3.608-1.311-.975-.975-1.249-2.242-1.311-3.608C2.175 15.647 2.163 15.267 2.163 12s.012-3.584.07-4.85c.062-1.366.336-2.633 1.311-3.608.975-.975 2.242-1.249 3.608-1.311C8.416 2.175 8.796 2.163 12 2.163zM12 0C8.741 0 8.332.013 7.052.072 5.775.13 4.602.396 3.635 1.363 2.668 2.33 2.402 3.503 2.344 4.78 2.285 6.06 2.272 6.469 2.272 9.728v4.544c0 3.259.013 3.668.072 4.948.058 1.277.324 2.45 1.291 3.417.967.967 2.14 1.233 3.417 1.291 1.28.059 1.689.072 4.948.072s3.668-.013 4.948-.072c1.277-.058 2.45-.324 3.417-1.291.967-.967 1.233-2.14 1.291-3.417.059-1.28.072-1.689.072-4.948V9.728c0-3.259-.013-3.668-.072-4.948-.058-1.277-.324-2.45-1.291-3.417C19.398.396 18.225.13 16.948.072 15.668.013 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
  twitter:
    'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z',
  x:
    'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z',
  linkedin:
    'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  youtube:
    'M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  tiktok:
    'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  whatsapp:
    'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z',
  pinterest:
    'M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.097.118.112.224.083.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.748-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.987C24.007 5.367 18.641.001 12.017.001z',
  github:
    'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  telegram:
    'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
  snapchat:
    'M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.539-.074.832 0 .449-.225.844-.727 1.093-.659.39-1.693.645-2.774.645-.24 0-.45-.015-.659-.045-.659-.075-1.349-.225-2.059-.435-.405-.12-.809-.24-1.199-.24-.36 0-.754.12-1.199.27-.794.24-1.644.509-2.574.509-.809 0-1.559-.24-2.129-.645-.465-.375-.705-.779-.705-1.199 0-.225.03-.479.074-.704.045-.225.105-.479.15-.644.405-.105 1.23-.36 1.649-.779.405-.405.645-.959.645-1.593 0-.375-.075-.705-.18-1.005-.12-.345-.285-.659-.465-.929-.45-.659-1.139-1.019-1.799-1.019-.24 0-.465.045-.659.12-.405.135-.705.345-.915.555-.21.21-.36.435-.435.555-.075.12-.135.21-.18.255-.045.045-.09.075-.135.09-.045.015-.09.015-.135.015-.24 0-.435-.12-.585-.345-.15-.225-.225-.525-.225-.885 0-.66.24-1.365.705-1.995.465-.63 1.125-1.155 1.875-1.455.75-.3 1.575-.435 2.385-.435z',
}

const OUTLINE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  website: Globe,
  whatsapp: MessageCircle,
  instagram: Instagram,
  facebook: Facebook,
  twitter: Twitter,
  x: Twitter,
  youtube: Youtube,
  linkedin: Linkedin,
  github: Github,
  telegram: Send,
}

function normalizePlatform(platform: string): string {
  return platform.toLowerCase()
}

function FilledGlyph({
  platform,
  className,
  color,
}: {
  platform: string
  className?: string
  color?: string
}) {
  const key = normalizePlatform(platform)
  const path = FILLED_PATHS[key]
  if (!path) {
    const OutlineIcon = OUTLINE_ICONS[key] ?? Globe
    return <OutlineIcon className={className} aria-hidden />
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor" style={color ? { color } : undefined}>
      <path d={path} />
    </svg>
  )
}

type GlyphKind = 'outline' | 'filled' | 'brand' | 'mono'

function renderGlyph(
  platform: string,
  kind: GlyphKind,
  className?: string,
): ReactNode {
  const key = normalizePlatform(platform)

  if (kind === 'brand') {
    return (
      <FilledGlyph
        platform={key}
        className={className}
        color={BRAND_COLORS[key] ?? 'currentColor'}
      />
    )
  }

  if (kind === 'filled') {
    return <FilledGlyph platform={key} className={className} />
  }

  if (kind === 'mono') {
    const OutlineIcon = OUTLINE_ICONS[key]
    if (OutlineIcon) {
      return <OutlineIcon className={cn(className, 'text-muted-foreground opacity-80')} aria-hidden />
    }
    return <FilledGlyph platform={key} className={cn(className, 'text-muted-foreground opacity-70')} />
  }

  const OutlineIcon = OUTLINE_ICONS[key]
  if (OutlineIcon) {
    return <OutlineIcon className={className} aria-hidden />
  }
  return <FilledGlyph platform={key} className={cn(className, 'opacity-80')} />
}

function glyphKindForStyle(style: SocialLinksIconStyle, bare: boolean): GlyphKind | 'emoji' {
  if (style === 'emoji') return 'emoji'
  if (style === 'outline') return 'outline'
  if (style === 'brand' || style === 'brand_badge') return 'brand'
  if (style === 'mono') return 'mono'
  if (bare && (style === 'rounded' || style === 'circle')) return 'filled'
  return 'filled'
}

function wrapBadge(content: ReactNode, wrapperClass: string, style?: React.CSSProperties) {
  return (
    <span
      className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center', wrapperClass)}
      style={style}
    >
      {content}
    </span>
  )
}

export function SocialPlatformIcon({
  platform,
  style,
  className,
  bare = false,
}: {
  platform: string
  style: SocialLinksIconStyle
  className?: string
  /** Skip outer badge wrappers — for inputs that already provide icon chrome. */
  bare?: boolean
}) {
  const key = normalizePlatform(platform)
  const glyphClass = cn('h-4 w-4', className)
  const glyphKind = glyphKindForStyle(style, bare)

  if (glyphKind === 'emoji') {
    return (
      <span className={cn('inline-flex items-center justify-center text-base leading-none', className)} aria-hidden>
        {PLATFORM_EMOJI[key] ?? '🔗'}
      </span>
    )
  }

  const glyph = renderGlyph(key, glyphKind, glyphClass)

  if (bare) return glyph

  if (style === 'rounded') {
    return wrapBadge(glyph, 'rounded-lg bg-muted text-foreground ring-1 ring-inset ring-border')
  }

  if (style === 'circle') {
    return wrapBadge(glyph, 'rounded-full bg-muted text-foreground ring-1 ring-inset ring-border')
  }

  if (style === 'brand_badge') {
    const brandColor = BRAND_COLORS[key] ?? '#64748b'
    const onBrand = renderGlyph(key, 'filled', cn(glyphClass, 'text-white'))
    return wrapBadge(onBrand, 'rounded-full text-white shadow-sm', { backgroundColor: brandColor })
  }

  return glyph
}

export function readSocialIconStyleFromSettings(
  settings?: Record<string, unknown> | null,
): SocialLinksIconStyle {
  const raw = settings?.social_links_icon_style
  return isSocialLinksIconStyle(raw) ? raw : DEFAULT_SOCIAL_LINKS_ICON_STYLE
}
