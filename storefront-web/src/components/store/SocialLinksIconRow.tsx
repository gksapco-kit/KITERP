import { cn } from '@/lib/utils'
import { SocialPlatformIcon, readSocialIconStyleFromSettings } from '@/lib/socialPlatformIcons'
import type { SocialLinksIconStyle } from '@/lib/socialLinksMode'
import { resolveSocialLinkHref } from '@/lib/socialLinkHref'

type Props = {
  links?: Record<string, string> | null
  iconStyle?: SocialLinksIconStyle
  settings?: Record<string, unknown> | null
  linkClassName?: string
  className?: string
}

export function SocialLinksIconRow({
  links,
  iconStyle,
  settings,
  linkClassName,
  className,
}: Props) {
  const style = iconStyle ?? readSocialIconStyleFromSettings(settings)
  const entries = Object.entries(links ?? {}).filter(([, url]) => Boolean(url?.trim()))

  if (entries.length === 0) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {entries.map(([platform, url]) => {
        const href = resolveSocialLinkHref(platform, url)
        if (!href) return null
        return (
          <a
            key={platform}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={platform}
            className={linkClassName}
          >
            <SocialPlatformIcon platform={platform} style={style} className="h-4 w-4" />
          </a>
        )
      })}
    </div>
  )
}
