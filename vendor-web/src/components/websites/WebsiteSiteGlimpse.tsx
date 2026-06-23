import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Monitor } from 'lucide-react'
import { BuilderCanvasProviders } from '@/components/websites/BuilderCanvasProviders'
import { BuilderCanvasPageRenderer } from '@/components/websites/BuilderCanvasPageRenderer'
import {
  fetchSiteHomepageGlimpse,
  styleConfigPreviewGradient,
} from '@/lib/websiteSitePreview'
import { cn } from '@/lib/utils'
import type { WebsiteTemplate } from '@/types/websites'

const PREVIEW_WIDTH = 1280
const IFRAME_HEIGHT = 900
/** Approximate homepage height for small cover-thumbnail crops. */
const GLIMPSE_CONTENT_HEIGHT = 720

type GlimpseScaleMode = 'width' | 'cover'

function useGlimpseScale(
  containerRef: RefObject<HTMLElement | null>,
  mode: GlimpseScaleMode,
  contentHeight = IFRAME_HEIGHT,
) {
  const [transform, setTransform] = useState({ scale: 0.15, offsetX: 0, offsetY: 0 })

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const cw = el.clientWidth
      const ch = el.clientHeight
      if (cw <= 0 || ch <= 0) return
      if (mode === 'cover') {
        const scale = Math.max(cw / PREVIEW_WIDTH, ch / contentHeight)
        setTransform({
          scale,
          offsetX: (cw - PREVIEW_WIDTH * scale) / 2,
          offsetY: (ch - contentHeight * scale) / 2,
        })
        return
      }
      const scale = cw / PREVIEW_WIDTH
      setTransform({ scale, offsetX: 0, offsetY: 0 })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef, mode, contentHeight])

  return transform
}

type Props = {
  siteId?: string | null
  vendorSlug?: string | null
  fallbackImage?: string | null
  fallbackGradient?: string | null
  /** Live customer store URL — used for default storefront cards without a builder site. */
  livePreviewUrl?: string | null
  templates?: WebsiteTemplate[]
  className?: string
  /** assigned = show catalog thumbnail / template preview, not draft builder canvas */
  previewMode?: 'assigned' | 'live'
  /** cover = fill small thumbs edge-to-edge like object-cover */
  scaleMode?: GlimpseScaleMode
  /** card = fast static thumb for grids; full = live canvas / iframe preview */
  variant?: 'card' | 'full'
}

function StaticGlimpseImage({ src, className }: { src: string; className?: string }) {
  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
    </div>
  )
}

function GlimpseGradient({ gradient, className }: { gradient: string; className?: string }) {
  return (
    <div
      className={cn('relative h-full w-full overflow-hidden', className)}
      style={{ background: gradient }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
    </div>
  )
}

function GlimpsePlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-full items-center justify-center bg-gradient-to-br from-primary/15 via-accent to-primary/5',
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-sm">
        <Monitor className="h-5 w-5 text-white" />
      </div>
    </div>
  )
}

function GlimpseLoading({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-full bg-gradient-to-br from-primary/10 via-accent to-primary/5 animate-pulse',
        className,
      )}
    />
  )
}

function LiveStorefrontIframePreview({
  url,
  className,
  scaleMode = 'width',
}: {
  url: string
  className?: string
  scaleMode?: GlimpseScaleMode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scale, offsetX, offsetY } = useGlimpseScale(containerRef, scaleMode)

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full w-full overflow-hidden bg-white', className)}
    >
      <iframe
        src={url}
        title="Storefront preview"
        className="pointer-events-none absolute border-0 bg-white"
        style={{
          width: PREVIEW_WIDTH,
          height: IFRAME_HEIGHT,
          left: offsetX,
          top: offsetY,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
    </div>
  )
}

export function WebsiteSiteGlimpse({
  siteId,
  vendorSlug,
  fallbackImage = null,
  fallbackGradient = null,
  livePreviewUrl = null,
  templates = [],
  className,
  previewMode = 'live',
  scaleMode = 'width',
  variant = 'full',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentHeight = scaleMode === 'cover' ? GLIMPSE_CONTENT_HEIGHT : IFRAME_HEIGHT
  const { scale, offsetX, offsetY } = useGlimpseScale(containerRef, scaleMode, contentHeight)
  const isCard = variant === 'card'
  const hasFallbackImage = Boolean(fallbackImage?.trim())

  const { data, isLoading } = useQuery({
    queryKey: ['site-homepage-glimpse', siteId],
    queryFn: () => fetchSiteHomepageGlimpse(siteId!, templates),
    enabled: Boolean(siteId) && (!isCard || !hasFallbackImage),
    staleTime: 5 * 60 * 1000,
  })

  const staticImage = data?.staticImage || fallbackImage
  const gradient = styleConfigPreviewGradient(data?.style) || fallbackGradient
  const preferAssignedPreview = previewMode === 'assigned'
  const canRenderCanvas = !isCard && Boolean(data?.blocks.length && vendorSlug && siteId)

  if (isCard) {
    if (staticImage) return <StaticGlimpseImage src={staticImage} className={className} />
    if (isLoading && siteId) return <GlimpseLoading className={className} />
    if (gradient) return <GlimpseGradient gradient={gradient} className={className} />
    return <GlimpsePlaceholder className={className} />
  }

  if (canRenderCanvas) {
    return (
      <div
        ref={containerRef}
        className={cn('relative h-full w-full overflow-hidden bg-white', className)}
      >
        <div
          className="pointer-events-none absolute select-none"
          style={{
            width: PREVIEW_WIDTH,
            minHeight: contentHeight,
            left: offsetX,
            top: offsetY,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <BuilderCanvasProviders
            siteId={siteId!}
            vendorSlug={vendorSlug!}
            siteName={data!.publicSite.name}
          >
            <BuilderCanvasPageRenderer
              publicSite={data!.publicSite}
              blocks={data!.blocks}
              pageId={data!.pageId}
            />
          </BuilderCanvasProviders>
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
      </div>
    )
  }

  if (isLoading && siteId) {
    return <GlimpseLoading className={className} />
  }

  if (preferAssignedPreview && staticImage) {
    return <StaticGlimpseImage src={staticImage} className={className} />
  }

  const liveUrl = livePreviewUrl?.trim()
  if (liveUrl && !isLoading) {
    return <LiveStorefrontIframePreview url={liveUrl} className={className} scaleMode={scaleMode} />
  }

  if (staticImage) {
    return <StaticGlimpseImage src={staticImage} className={className} />
  }

  if (gradient) {
    return <GlimpseGradient gradient={gradient} className={className} />
  }

  return <GlimpsePlaceholder className={className} />
}
