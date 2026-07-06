import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useVendor } from '@/contexts/VendorContext'
import { mediaUrl } from '@/lib/utils'
import { overlayImageImgStyle } from '@/lib/overlayImageStyle'
import {
  defaultOverlayFillColor,
  overlayHasLink,
  overlayMinContainerHeight,
  overlayPositionStyle,
  resolveOverlayBackground,
  resolveOverlayBorder,
  resolveOverlayLinkHref,
  type BlockOverlayItem,
} from '@/lib/blockOverlays'
import { builderOverlayIconLabel, overlayIconRenderSize, resolveBuilderOverlayIcon } from '@/lib/builderOverlayIcons'
import { builderFontPreviewStyle, ensureBuilderFontLoaded } from '@/lib/builderFontFamilies'

function overlayTextFontStyle(item: BlockOverlayItem): CSSProperties {
  if (!item.fontFamily) return {}
  ensureBuilderFontLoaded(item.fontFamily)
  return builderFontPreviewStyle(item.fontFamily)
}

function OverlayLinkWrap({
  item,
  children,
}: {
  item: BlockOverlayItem
  children: ReactNode
}) {
  const { storePath } = useVendor()
  const href = resolveOverlayLinkHref(item, storePath)
  if (!href) return <>{children}</>

  const wrapStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    height: '100%',
    textDecoration: 'none',
    color: 'inherit',
  }

  const external =
    href.startsWith('http://')
    || href.startsWith('https://')
    || href.startsWith('mailto:')
    || href.startsWith('tel:')

  if (external || item.openInNewTab) {
    return (
      <a
        href={href}
        target={item.openInNewTab || external ? '_blank' : undefined}
        rel={item.openInNewTab || external ? 'noopener noreferrer' : undefined}
        style={wrapStyle}
        aria-label={item.description || item.linkLabel || item.text || undefined}
      >
        {children}
      </a>
    )
  }

  if (href.startsWith('#')) {
    return (
      <a href={href} style={wrapStyle} aria-label={item.description || item.text || undefined}>
        {children}
      </a>
    )
  }

  return (
    <Link to={href} style={wrapStyle} aria-label={item.description || item.text || undefined}>
      {children}
    </Link>
  )
}

function OverlayLayerContent({ item }: { item: BlockOverlayItem }) {
  const fillFallback = defaultOverlayFillColor(item.type)
  const commonStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: resolveOverlayBackground(item, item.type === 'text' ? 'transparent' : fillFallback),
    borderRadius: item.borderRadius || 0,
    border: resolveOverlayBorder(item),
    boxShadow: item.shadow ? '0 8px 32px rgba(0,0,0,0.15)' : undefined,
    opacity: (item.opacity ?? 100) / 100,
    overflow: 'hidden',
  }

  switch (item.type) {
    case 'text':
      return (
        <div
          style={{
            ...commonStyle,
            fontSize: item.fontSize || 16,
            fontWeight: item.fontWeight || 'normal',
            fontStyle: item.italic ? 'italic' : undefined,
            color: item.color || '#111827',
            textAlign: item.align || 'left',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            wordBreak: 'break-word',
            ...overlayTextFontStyle(item),
          }}
        >
          {item.text || ''}
        </div>
      )
    case 'image':
      if (item.src) {
        return (
          <div
            style={{
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              borderRadius: item.borderRadius || 0,
            }}
          >
            <img
              src={mediaUrl(item.src)}
              alt={item.description || item.linkLabel || ''}
              draggable={false}
              style={overlayImageImgStyle(item)}
            />
          </div>
        )
      }
      return (
        <div
          style={{
            ...commonStyle,
            backgroundColor: resolveOverlayBackground(item, '#f3f4f6'),
          }}
          aria-hidden
        />
      )
    case 'button':
      return (
        <div
          style={{
            ...commonStyle,
            backgroundColor: resolveOverlayBackground(item, '#64C3A0'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={item.description || undefined}
        >
          <span
            style={{
              fontSize: item.fontSize || 14,
              fontWeight: item.fontWeight || 'bold',
              color: item.color || '#ffffff',
              ...overlayTextFontStyle(item),
            }}
          >
            {item.text || 'Button'}
          </span>
        </div>
      )
    case 'box':
      return <div style={commonStyle} aria-hidden={!item.description} title={item.description} />
    case 'badge':
      return (
        <div
          style={{
            ...commonStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: resolveOverlayBackground(item, '#64C3A0'),
          }}
        >
          <span
            style={{
              fontSize: item.fontSize || 12,
              fontWeight: 'bold',
              color: item.color || '#ffffff',
              whiteSpace: 'nowrap',
              ...overlayTextFontStyle(item),
            }}
          >
            {item.text || 'Badge'}
          </span>
        </div>
      )
    case 'icon': {
      const IconGlyph = resolveBuilderOverlayIcon(item.iconName)
      const iconPx = overlayIconRenderSize(item)
      return (
        <div
          style={{
            ...commonStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: resolveOverlayBackground(item, 'transparent'),
          }}
          title={item.description || builderOverlayIconLabel(item.iconName)}
          aria-label={item.description || builderOverlayIconLabel(item.iconName)}
        >
          <IconGlyph size={iconPx} color={item.color || '#111827'} strokeWidth={2} aria-hidden />
        </div>
      )
    }
    case 'video':
      return (
        <div
          style={{
            ...commonStyle,
            backgroundColor: item.bgColor || '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {item.src ? (
            <video
              src={mediaUrl(item.src)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              controls
              playsInline
            />
          ) : null}
        </div>
      )
    default:
      return null
  }
}

function OverlayLayer({ item }: { item: BlockOverlayItem }) {
  const linked = overlayHasLink(item)
  const body = <OverlayLayerContent item={item} />

  return (
    <div
      data-overlay-root
      data-overlay-id={item.id}
      style={{
        ...overlayPositionStyle(item),
        zIndex: item.zIndex || 10,
        pointerEvents: 'auto',
      }}
    >
      {linked && (item.type === 'image' || item.type === 'button' || item.type === 'text' || item.type === 'badge' || item.type === 'icon') ? (
        <OverlayLinkWrap item={item}>{body}</OverlayLinkWrap>
      ) : (
        body
      )}
    </div>
  )
}

/** Read-only overlay layers for preview and live storefront (matches builder canvas). */
export function BlockOverlayLayers({ overlays }: { overlays: BlockOverlayItem[] }) {
  if (!overlays.length) return null

  const minH = overlayMinContainerHeight(overlays)

  return (
    <div
      aria-hidden={false}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 15,
        pointerEvents: 'none',
        minHeight: minH > 0 ? minH : undefined,
      }}
    >
      {overlays.map(item => (
        <OverlayLayer key={item.id} item={item} />
      ))}
    </div>
  )
}
