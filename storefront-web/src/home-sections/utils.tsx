import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { SectionProps } from './types'

/** In-app preview (e.g. vendor builder): avoid nested routers by handling navigation locally. */
export function SectionNavLink({
  to,
  className,
  style,
  children,
  onPreviewNavigate,
  /** When `onPreviewNavigate` is set but this is false (vendor builder edit mode), render non-navigating chrome. */
  previewNavigateEnabled = true,
}: {
  to: string
  className?: string
  style?: CSSProperties
  children: ReactNode
  onPreviewNavigate?: (to: string) => void
  previewNavigateEnabled?: boolean
}) {
  if (onPreviewNavigate && !previewNavigateEnabled) {
    return (
      <span className={className} style={style} role="presentation">
        {children}
      </span>
    )
  }
  if (onPreviewNavigate) {
    const internal = to.startsWith('/') && !to.startsWith('//')
    if (!internal) {
      return (
        <a href={to} className={className} style={style} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      )
    }
    return (
      <a
        href={to}
        className={className}
        style={style}
        onClick={(e) => {
          e.preventDefault()
          onPreviewNavigate(to)
        }}
      >
        {children}
      </a>
    )
  }
  return (
    <Link to={to} className={className} style={style}>
      {children}
    </Link>
  )
}

export function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}

export type FieldTypographyOpts = {
  /**
   * When set with builder `_fs_*` px values, use a viewport-aware clamp so large
   * headline/subtitle sizes do not overflow on narrow screens (editorial heroes).
   */
  fluidMaxPx?: boolean
}

/** Per-field typography from builder: `_fc_<fieldKey>` (hex colour), `_fs_<fieldKey>` (px font size). */
export function fieldTypographyStyle(
  props: SectionProps,
  fieldKey: string,
  opts?: FieldTypographyOpts,
): CSSProperties {
  const fcKey = `_fc_${fieldKey}`
  const fsKey = `_fs_${fieldKey}`
  const colorRaw = props[fcKey]
  const fsRaw = props[fsKey]
  const color = typeof colorRaw === 'string' && colorRaw.trim() ? colorRaw.trim() : ''
  const fsStr = typeof fsRaw === 'string' ? fsRaw.trim() : ''
  const out: CSSProperties = {}
  if (color) out.color = color
  if (fsStr) {
    const n = parseInt(fsStr, 10)
    if (!Number.isNaN(n) && n >= 8 && n <= 120) {
      const fluid =
        opts?.fluidMaxPx &&
        (fieldKey === 'headline' || fieldKey === 'subtitle')
      if (fluid) {
        const min = fieldKey === 'headline' ? '0.8125rem' : '0.8125rem'
        /** Prefer smaller of vw- and dvh-based ramps so type tracks capped hero imagery on short mobile viewports. */
        const pref =
          fieldKey === 'headline'
            ? 'min(0.2rem + 2.25vw, 0.34rem + 3.7dvh)'
            : 'min(0.22rem + 1.55vw, 0.3rem + 1.85dvh)'
        const maxPx = fieldKey === 'headline' ? Math.min(n, 54) : Math.min(n, 28)
        out.fontSize = `clamp(${min}, ${pref}, ${maxPx}px)`
      } else {
        out.fontSize = `${n}px`
      }
    }
  }
  return out
}

/** storefront-ui templates: Atelier retail, Verde restaurant, Solace healthcare */
export type EditorialKitId = 'atelier' | 'verde' | 'solace'

export function editorialKitHero(templateId: string | undefined, props: SectionProps): EditorialKitId | null {
  const bs = str(props.bg_style as string, '')
  if (bs === 'atelier' || bs === 'verde' || bs === 'solace') return bs as EditorialKitId
  if (templateId === 'atelier' || templateId === 'verde' || templateId === 'solace') return templateId as EditorialKitId
  return null
}

export function editorialKitFromTemplate(templateId: string | undefined): EditorialKitId | null {
  if (templateId === 'atelier' || templateId === 'verde' || templateId === 'solace') return templateId
  return null
}

export function accentInText(text: string, accent: string, emClass: string, emStyle?: CSSProperties) {
  if (!accent || !text) return text
  const idx = text.toLowerCase().indexOf(accent.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <em className={emClass} style={emStyle}>{text.slice(idx, idx + accent.length)}</em>
      {text.slice(idx + accent.length)}
    </>
  )
}

export function storefrontHref(raw: unknown, storePath: (p: string) => string, fallbackPath: string): string {
  const v = str(raw as string, '')
  if (!v) return storePath(fallbackPath)
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('mailto:') || v.startsWith('tel:')) return v
  if (v.startsWith('internal:')) return storePath(v.slice('internal:'.length) || fallbackPath)
  if (v.startsWith('/')) return storePath(v)
  return storePath(fallbackPath)
}

export function radiusClass(br?: string): string {
  if (br === 'sharp') return 'rounded-none'
  if (br === 'pill') return 'rounded-full'
  return 'rounded-xl'
}

export function heroHeightClass(h?: string): string {
  if (h === 'compact') return 'py-8 sm:py-12'
  if (h === 'tall') return 'py-20 sm:py-32'
  return 'py-12 sm:py-20'
}
