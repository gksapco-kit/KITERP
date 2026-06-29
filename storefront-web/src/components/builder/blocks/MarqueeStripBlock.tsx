import { useCallback, type MouseEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { StyleConfig } from '@/blocks/registry'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { useVendor } from '@/contexts/VendorContext'
import { useStorePath } from '@/hooks/useStorePath'
import { isDraftPreviewShellHref } from '@/lib/previewNavRouting'
import { parseMarqueeItems, type MarqueeItem } from '@/lib/marqueeItems'
import { arrayItemImageFrameStyle, arrayItemImageRenderStyle } from '@/lib/sectionImageStyle'
import { cn, imgUrl } from '@/lib/utils'

interface Props {
  style: StyleConfig
  props: Record<string, unknown>
  blockId?: string
}

function resolveMarqueeHref(raw: string, storePath: (path: string) => string): string {
  const target = raw.trim()
  if (!target) return ''
  if (/^(https?:|mailto:|tel:)/i.test(target) || target.startsWith('//') || target.startsWith('#')) {
    return target
  }
  if (target.startsWith('?')) return `${storePath('/')}${target}`
  return storePath(target.startsWith('/') ? target : `/${target}`)
}

function isExternalHref(href: string): boolean {
  return /^(https?:|mailto:|tel:)/i.test(href) || href.startsWith('//')
}

function hasMarqueeImage(item: MarqueeItem): boolean {
  return typeof item.image_url === 'string' && item.image_url.trim().length > 0
}

function MarqueeItemLabel({
  item,
  index,
  blockId,
  blockProps,
  isMirror = false,
}: {
  item: MarqueeItem
  index: number
  blockId?: string
  blockProps: Record<string, unknown>
  isMirror?: boolean
}) {
  const ctx = useBuilderCanvas()
  const isEditor = ctx?.isEditorCanvas === true && !!blockId && !isMirror
  const label = item.label?.trim() || ''

  if (!label) return null

  if (isEditor) {
    return (
      <BuilderTextField
        fieldKey={`items.${index}.label`}
        blockId={blockId}
        blockProps={blockProps}
        value={label}
        as="span"
        placeholder="Marquee text"
        className="inline"
      />
    )
  }

  return <span>{label}</span>
}

function MarqueeItemImage({
  item,
  index,
  blockId,
  blockProps,
  isMirror = false,
  compact = false,
}: {
  item: MarqueeItem
  index: number
  blockId?: string
  blockProps: Record<string, unknown>
  isMirror?: boolean
  compact?: boolean
}) {
  const ctx = useBuilderCanvas()
  const isEditor = ctx?.isEditorCanvas === true && !!blockId && !isMirror
  const hasImage = hasMarqueeImage(item)
  if (!hasImage) return null

  const src = imgUrl(item.image_url as string)
  const alt = item.label?.trim() || 'Marquee image'
  const heightClass = compact ? 'h-6' : 'h-8'
  const itemRecord = item as unknown as Record<string, unknown>

  if (isEditor) {
    return (
      <div
        className={cn('relative shrink-0 overflow-hidden rounded-md', heightClass, 'w-auto min-w-[4rem]')}
        style={arrayItemImageFrameStyle(itemRecord)}
      >
        <BuilderSectionImage
          blockId={blockId}
          field="image_url"
          arrayKey="items"
          index={index}
          itemField="image_url"
          blockProps={blockProps}
          src={src}
          alt={alt}
          className="absolute inset-0 h-full w-full object-contain"
        />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn(heightClass, 'w-auto shrink-0 object-contain')}
      style={arrayItemImageRenderStyle(itemRecord, blockProps)}
      loading="lazy"
      onError={e => {
        e.currentTarget.style.display = 'none'
      }}
    />
  )
}

function MarqueeItemRow({
  item,
  index,
  blockId,
  blockProps,
  isMirror = false,
  compact = false,
}: {
  item: MarqueeItem
  index: number
  blockId?: string
  blockProps: Record<string, unknown>
  isMirror?: boolean
  compact?: boolean
}) {
  const ctx = useBuilderCanvas()
  const storePath = useStorePath()
  const navigate = useNavigate()
  const { previewShell, openBuilderForPage } = useVendor()
  const isEditor = ctx?.isEditorCanvas === true && !!blockId && !isMirror
  const url = item.url?.trim() || ''
  const resolvedHref = url ? resolveMarqueeHref(url, storePath) : ''
  const external = isExternalHref(resolvedHref)
  const linkClass = url
    ? 'cursor-pointer underline decoration-current/35 underline-offset-2 hover:decoration-current'
    : undefined

  const handlePreviewClick = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    if (!resolvedHref) return
    if ((e.target as HTMLElement).closest('[data-text-key], [data-builder-section-image]')) return

    if (!previewShell && !isEditor) return

    e.preventDefault()
    try {
      const parsed = new URL(resolvedHref, window.location.origin)
      if (isDraftPreviewShellHref(parsed.pathname)) {
        if (parsed.searchParams.has('route')) {
          navigate({ pathname: parsed.pathname, search: parsed.search })
          return
        }
        openBuilderForPage?.(parsed.searchParams.get('page'))
        return
      }
    } catch {
      /* fall through */
    }

    if (external) {
      window.open(resolvedHref, '_blank', 'noopener,noreferrer')
      return
    }
    navigate(resolvedHref)
  }, [external, isEditor, navigate, openBuilderForPage, previewShell, resolvedHref])

  const content: ReactNode = (
    <>
      <MarqueeItemImage
        item={item}
        index={index}
        blockId={blockId}
        blockProps={blockProps}
        isMirror={isMirror}
        compact={compact}
      />
      <MarqueeItemLabel
        item={item}
        index={index}
        blockId={blockId}
        blockProps={blockProps}
        isMirror={isMirror}
      />
    </>
  )

  const wrapClass = cn('inline-flex items-center gap-3', linkClass)

  if (isMirror) {
    if (url) {
      if (external) {
        return (
          <a
            href={resolvedHref}
            className={wrapClass}
            target="_blank"
            rel="noopener noreferrer"
            onClick={previewShell || isEditor ? handlePreviewClick : undefined}
          >
            {content}
          </a>
        )
      }
      if (previewShell || isEditor) {
        return (
          <a href={resolvedHref} className={wrapClass} onClick={handlePreviewClick}>
            {content}
          </a>
        )
      }
      return (
        <Link to={resolvedHref} className={wrapClass}>
          {content}
        </Link>
      )
    }
    return <span className="inline-flex items-center gap-3">{content}</span>
  }

  if (url) {
    if (isEditor) {
      return (
        <a
          href={resolvedHref}
          className={wrapClass}
          onClick={handlePreviewClick}
          onMouseDown={e => {
            if ((e.target as HTMLElement).closest('[data-text-key], [data-builder-section-image]')) e.stopPropagation()
          }}
        >
          {content}
        </a>
      )
    }
    if (external) {
      return (
        <a
          href={resolvedHref}
          className={wrapClass}
          target="_blank"
          rel="noopener noreferrer"
        >
          {content}
        </a>
      )
    }
    return (
      <Link to={resolvedHref} className={wrapClass}>
        {content}
      </Link>
    )
  }

  return <span className="inline-flex items-center gap-3">{content}</span>
}

/** Matches vendor builder + Fashion template browser — uses `.sf-marquee-track` from globals.css */
export default function MarqueeStripBlock({ style, props, blockId }: Props) {
  const items = parseMarqueeItems(props)
  const compact = props.compact === true
  const separator = String(props.separator ?? 'dot')
  const sepChar = separator === 'pipe' ? '|' : '·'
  const itemGap = Math.min(120, Math.max(8, Number(props.item_gap ?? 40) || 40))

  return (
    <div
      className={cn('overflow-hidden border-b', compact ? 'py-2' : 'py-4')}
      style={{ borderColor: `${style.text_color}18`, backgroundColor: style.bg_color }}
    >
      <div className="sf-marquee-track whitespace-nowrap items-center" style={{ fontFamily: style.font_heading }}>
        {items.length === 0 ? (
          <span className="text-sm opacity-60 px-4"> </span>
        ) : (
          Array.from({ length: 2 }).map((_, dup) => (
            <span
              key={dup}
              className="inline-flex items-center text-sm opacity-80"
              style={{ gap: itemGap, marginRight: itemGap }}
            >
              {items.map((item, index) => (
                <span key={`${dup}-${index}`} className="inline-flex items-center" style={{ gap: Math.round(itemGap * 0.35) }}>
                  <MarqueeItemRow
                    item={item}
                    index={index}
                    blockId={blockId}
                    blockProps={props}
                    isMirror={dup > 0}
                    compact={compact}
                  />
                  {index < items.length - 1 ? <span className="opacity-40">{sepChar}</span> : null}
                </span>
              ))}
            </span>
          ))
        )}
      </div>
    </div>
  )
}
