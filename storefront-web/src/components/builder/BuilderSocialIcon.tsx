import type { MouseEvent } from 'react'
import { cn } from '@/lib/utils'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { SocialPlatformIcon } from '@/lib/socialPlatformIcons'
import type { SocialLinksIconStyle } from '@/lib/socialLinksMode'
import {
  FOOTER_SOCIAL_PLATFORMS,
  type FooterSocialPlatform,
} from '@/kit/footer/footerSocial'

const PLATFORM_META = Object.fromEntries(
  FOOTER_SOCIAL_PLATFORMS.map(p => [p.key, p]),
) as Record<FooterSocialPlatform, (typeof FOOTER_SOCIAL_PLATFORMS)[number]>

export function BuilderSocialIcon({
  blockId,
  platform,
  url,
  className,
  iconStyle = 'brand',
}: {
  blockId: string
  platform: FooterSocialPlatform
  url: string
  className?: string
  iconStyle?: SocialLinksIconStyle
}) {
  const ctx = useBuilderCanvas()
  const isEditor = ctx?.isEditorCanvas && !!blockId
  const fieldKey = `social_links.${platform}`
  const isSelected = isEditor
    && ctx?.activeBlockId === blockId
    && ((ctx?.activeTextFields ?? []).includes(fieldKey) || ctx?.activeTextField === fieldKey)
  const { label } = PLATFORM_META[platform]
  const hasUrl = Boolean(url.trim())

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (!isEditor) return
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    ctx?.onPropLinkEdit?.(blockId, fieldKey, { x: rect.left, y: rect.bottom + 6 })
    ctx?.onTextFieldActivate?.(blockId, fieldKey, {
      clientX: e.clientX,
      clientY: e.clientY,
    })
  }

  if (!isEditor) {
    if (!hasUrl) return null
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className={cn('text-muted-foreground hover:text-foreground', className)}
      >
        <SocialPlatformIcon platform={platform} style={iconStyle} className="h-4 w-4" />
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={hasUrl ? `${label}: ${url}` : `Click to add ${label} URL`}
      aria-label={hasUrl ? `${label}: ${url}` : `Add ${label} URL`}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors',
        isSelected
          ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30'
          : hasUrl
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : 'border-gray-200 bg-white text-gray-400 hover:border-primary/40 hover:text-primary hover:bg-accent',
        className,
      )}
    >
      <SocialPlatformIcon platform={platform} style={iconStyle} className="h-4 w-4" />
    </button>
  )
}

export function FooterSocialIconsRow({
  blockId,
  socialLinks,
  className,
  iconStyle = 'brand',
}: {
  blockId: string
  socialLinks: Partial<Record<FooterSocialPlatform, string>>
  className?: string
  iconStyle?: SocialLinksIconStyle
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {FOOTER_SOCIAL_PLATFORMS.map(({ key }) => (
        <BuilderSocialIcon
          key={key}
          blockId={blockId}
          platform={key}
          url={socialLinks[key] || ''}
          iconStyle={iconStyle}
        />
      ))}
    </div>
  )
}
