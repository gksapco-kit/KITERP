import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useVendor } from '@/contexts/VendorContext'
import { mediaUrl } from '@/lib/utils'
import { overlayImageImgStyle } from '@/lib/overlayImageStyle'
import {
  defaultOverlayFillColor,
  overlayHasLink,
  overlayIsBelowProductBand,
  overlayMinContainerHeight,
  overlayPositionStyleForViewport,
  resolveOverlayBackground,
  resolveOverlayBorder,
  resolveOverlayLinkHref,
  type BlockOverlayItem,
  type OverlayImageBoundsPct,
} from '@/lib/blockOverlays'
import { builderOverlayIconLabel, overlayIconRenderSize, resolveBuilderOverlayIcon } from '@/lib/builderOverlayIcons'
import { builderFontPreviewStyle, ensureBuilderFontLoaded } from '@/lib/builderFontFamilies'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'

const MOBILE_MQ = '(max-width: 767px)'

function useOverlayMobileViewport(): boolean {
  const canvas = useBuilderCanvas()
  const previewBp = canvas?.isEditorCanvas ? canvas.previewBreakpoint : undefined

  const [matchMobile, setMatchMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(MOBILE_MQ).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(MOBILE_MQ)
    const sync = () => setMatchMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  if (previewBp === 'mobile') return true
  if (previewBp === 'tablet' || previewBp === 'desktop') return false
  return matchMobile
}

function useOverlayContainerSize(enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    setSize({ w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) })
    return () => ro.disconnect()
  }, [enabled])

  return { ref, size }
}

/** Largest section image inside the block, as % of the overlay canvas. */
function useOverlayImageBounds(
  canvasRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
  containerSize: { w: number; h: number },
): OverlayImageBoundsPct | null {
  const [bounds, setBounds] = useState<OverlayImageBoundsPct | null>(null)

  useEffect(() => {
    if (!enabled) {
      setBounds(null)
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return

    const measure = () => {
      const block = (canvas.closest('[data-sf-bid], [data-block-id], [data-bid]') as HTMLElement | null)
        ?? canvas.parentElement
      if (!block) return

      const candidates = Array.from(
        block.querySelectorAll<HTMLElement>(
          '[data-builder-section-image], .about-split-image-frame, .about-split-image-col img, img',
        ),
      ).filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width >= 48 && r.height >= 48
      })
      if (!candidates.length) {
        setBounds(null)
        return
      }

      const img = candidates.reduce((best, el) => {
        const a = el.getBoundingClientRect()
        const b = best.getBoundingClientRect()
        return a.width * a.height > b.width * b.height ? el : best
      })

      const canvasRect = canvas.getBoundingClientRect()
      const imgRect = img.getBoundingClientRect()
      if (canvasRect.width <= 0 || canvasRect.height <= 0) return

      setBounds({
        left: ((imgRect.left - canvasRect.left) / canvasRect.width) * 100,
        top: ((imgRect.top - canvasRect.top) / canvasRect.height) * 100,
        width: (imgRect.width / canvasRect.width) * 100,
        height: (imgRect.height / canvasRect.height) * 100,
      })
    }

    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(canvas)
    window.addEventListener('resize', measure)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [enabled, canvasRef, containerSize.w, containerSize.h])

  return bounds
}

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

function OverlayLayer({
  item,
  mobile,
  containerWidthPx,
  containerHeightPx,
  imageBounds,
  stackIndex,
  stackCount,
}: {
  item: BlockOverlayItem
  mobile: boolean
  containerWidthPx: number
  containerHeightPx: number
  imageBounds: OverlayImageBoundsPct | null
  stackIndex?: number
  stackCount?: number
}) {
  const linked = overlayHasLink(item)
  const body = <OverlayLayerContent item={item} />
  const pinToImage = mobile && stackCount != null && stackCount > 0

  return (
    <div
      data-overlay-root
      data-overlay-id={item.id}
      data-overlay-mobile-on-image={pinToImage ? 'true' : undefined}
      style={{
        ...overlayPositionStyleForViewport(item, {
          mobile: pinToImage,
          containerWidthPx,
          containerHeightPx,
          imageBounds,
          stackIndex,
          stackCount,
        }),
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
  const mobile = useOverlayMobileViewport()
  const { ref, size } = useOverlayContainerSize(mobile && overlays.length > 0)
  const imageBounds = useOverlayImageBounds(ref, mobile && overlays.length > 0, size)
  const minH = overlayMinContainerHeight(overlays)

  const belowBandStack = useMemo(() => {
    if (!mobile || !overlays.length) return new Map<string, { index: number; count: number }>()
    const band = overlays
      .filter((o) => overlayIsBelowProductBand(o, size.h || undefined))
      .slice()
      .sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0))
    const map = new Map<string, { index: number; count: number }>()
    band.forEach((item, index) => {
      map.set(item.id, { index, count: band.length })
    })
    return map
  }, [mobile, overlays, size.h])

  if (!overlays.length) return null

  return (
    <div
      ref={ref}
      aria-hidden={false}
      data-overlay-canvas
      data-overlay-mobile={mobile ? 'true' : undefined}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 15,
        pointerEvents: 'none',
        minHeight: !mobile && minH > 0 ? minH : undefined,
        overflow: mobile ? 'hidden' : undefined,
      }}
    >
      {overlays.map(item => {
        const stack = belowBandStack.get(item.id)
        return (
          <OverlayLayer
            key={item.id}
            item={item}
            mobile={mobile}
            containerWidthPx={size.w}
            containerHeightPx={size.h}
            imageBounds={imageBounds}
            stackIndex={stack?.index}
            stackCount={stack?.count}
          />
        )
      })}
    </div>
  )
}
