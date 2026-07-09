import type { MouseEvent } from 'react'
import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { useEffectiveVendor } from '@/hooks/useEffectiveVendor'
import { cn } from '@/lib/utils'
import { builderSectionContainerClass, builderSectionContainerWithMax } from '@/lib/builderSectionLayout'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'
import { SocialPlatformIcon, readSocialIconStyleFromSettings } from '@/lib/socialPlatformIcons'
import { resolveSocialLinkHref } from '@/lib/socialLinkHref'
import { mergeSocialLinks } from '@/lib/mergeSocialLinks'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

const DEFAULT_PLATFORMS = ['whatsapp', 'twitter', 'instagram', 'linkedin', 'facebook', 'youtube'] as const

function readSocialLinksRecord(
  props: Record<string, unknown>,
  profile?: LiveItem,
): Record<string, string> {
  const fromProps = props.social_links
  if (fromProps && typeof fromProps === 'object' && !Array.isArray(fromProps)) {
    return fromProps as Record<string, string>
  }
  const legacy = props.links
  if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
    return legacy as Record<string, string>
  }
  const fromProfile = profile?.meta?.social_links
  if (fromProfile && typeof fromProfile === 'object' && !Array.isArray(fromProfile)) {
    return fromProfile as Record<string, string>
  }
  return {}
}

function buildPlatformEntries(
  raw: Record<string, string>,
  isEditorCanvas: boolean,
): Array<[string, string]> {
  if (isEditorCanvas) {
    const merged: Record<string, string> = {}
    for (const platform of DEFAULT_PLATFORMS) {
      merged[platform] = String(raw[platform] ?? '').trim()
    }
    for (const [key, val] of Object.entries(raw)) {
      if (!(key in merged)) merged[key] = String(val ?? '').trim()
    }
    return Object.entries(merged)
  }
  return Object.entries(raw).filter(([platform, url]) => Boolean(resolveSocialLinkHref(platform, String(url ?? ''))))
}

function SocialPlatformChip({
  platform,
  url,
  style,
  iconStyle,
  isEditorCanvas,
  blockId,
}: {
  platform: string
  url: string
  style: StyleConfig
  iconStyle: ReturnType<typeof readSocialIconStyleFromSettings>
  isEditorCanvas: boolean
  blockId?: string
}) {
  const builderCanvas = useBuilderCanvas()
  const key = platform.toLowerCase()
  const label = platform.charAt(0).toUpperCase() + platform.slice(1)
  const href = resolveSocialLinkHref(key, url)
  const hasUrl = Boolean(href)
  const fieldKey = `social_links.${platform}`
  const isSelected = isEditorCanvas
    && builderCanvas?.activeBlockId === blockId
    && ((builderCanvas?.activeTextFields ?? []).includes(fieldKey)
      || builderCanvas?.activeTextField === fieldKey)

  const chipClass = cn(
    'inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors text-sm font-medium',
    hasUrl
      ? 'border-gray-200 text-gray-600 hover:border-current hover:text-[var(--brand-primary)]'
      : 'border-dashed border-gray-300 text-gray-400 hover:border-primary/40 hover:text-primary',
    isSelected && 'ring-2 ring-primary/30 border-primary',
  )

  const icon = <SocialPlatformIcon platform={key} style={iconStyle} className="w-4 h-4" />

  const handleEditorClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (!isEditorCanvas || !blockId || !builderCanvas?.onPropLinkEdit) return
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    builderCanvas.onPropLinkEdit(blockId, fieldKey, { x: rect.left, y: rect.bottom + 6 })
    builderCanvas.onTextFieldActivate?.(blockId, fieldKey, {
      clientX: e.clientX,
      clientY: e.clientY,
    })
  }

  if (isEditorCanvas && blockId) {
    return (
      <button
        type="button"
        onClick={handleEditorClick}
        title={hasUrl ? `${label}: ${href}` : `Click to add ${label} URL`}
        className={chipClass}
        style={{ ['--brand-primary' as string]: style.primary_color }}
      >
        {icon}
        <span>{label}</span>
      </button>
    )
  }

  if (!hasUrl) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} (opens in new window)`}
      className={chipClass}
      style={{ ['--brand-primary' as string]: style.primary_color }}
    >
      {icon}
      <span>{label}</span>
    </a>
  )
}

export default function SocialLinksBlock({ style, props, liveItems, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const effectiveVendor = useEffectiveVendor()
  const iconStyle = readSocialIconStyleFromSettings(effectiveVendor?.settings)
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const title = resolveBlockTextField(props, 'title')
  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)
  const profile = liveItems[0]
  const rawLinks = mergeSocialLinks(
    effectiveVendor?.social_links as Record<string, string> | undefined,
    readSocialLinksRecord(props, profile),
  )
  const entries = buildPlatformEntries(rawLinks, isEditorCanvas)
  const hasVisibleLinks = entries.some(([platform, url]) => isEditorCanvas || Boolean(resolveSocialLinkHref(platform, url)))

  if (!hasVisibleLinks && !showTitle) return null

  return (
    <section className={builderSectionContainerClass('text-center')} aria-label={title ?? undefined}>
      {showTitle && (
        <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title ?? ''} as="h3" className="text-lg font-semibold text-gray-700 mb-4" placeholder="Section title" />
      )}
      <div className="flex justify-center gap-3 flex-wrap">
        {entries.map(([platform, url]) => (
          <SocialPlatformChip
            key={platform}
            platform={platform}
            url={url}
            style={style}
            iconStyle={iconStyle}
            isEditorCanvas={isEditorCanvas}
            blockId={blockId}
          />
        ))}
      </div>
    </section>
  )
}
