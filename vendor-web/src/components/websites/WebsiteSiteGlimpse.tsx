import { useLayoutEffect, useRef, useState } from 'react'
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

type Props = {
  siteId?: string | null
  vendorSlug?: string | null
  fallbackImage?: string | null
  fallbackGradient?: string | null
  /** Live customer store URL — used for default storefront cards without a builder site. */
  livePreviewUrl?: string | null
  templates?: WebsiteTemplate[]
  className?: string
}

function LiveStorefrontIframePreview({
  url,
  className,
}: {
  url: string
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.15)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const next = el.clientWidth / PREVIEW_WIDTH
      setScale(next > 0 ? next : 0.15)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full w-full overflow-hidden bg-white', className)}
    >
      <iframe
        src={url}
        title="Storefront preview"
        className="pointer-events-none border-0 bg-white"
        style={{
          width: PREVIEW_WIDTH,
          height: IFRAME_HEIGHT,
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
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.15)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const next = el.clientWidth / PREVIEW_WIDTH
      setScale(next > 0 ? next : 0.15)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['site-homepage-glimpse', siteId],
    queryFn: () => fetchSiteHomepageGlimpse(siteId!, templates),
    enabled: Boolean(siteId),
    staleTime: 5 * 60 * 1000,
  })

  const staticImage = data?.staticImage || fallbackImage
  const gradient = styleConfigPreviewGradient(data?.style) || fallbackGradient
  const canRenderLive = Boolean(data?.blocks.length && vendorSlug && siteId)

  if (canRenderLive) {
    return (
      <div
        ref={containerRef}
        className={cn('relative h-full w-full overflow-hidden bg-white', className)}
      >
        <div
          className="pointer-events-none select-none"
          style={{
            width: PREVIEW_WIDTH,
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

  const liveUrl = livePreviewUrl?.trim()
  if (liveUrl && !isLoading) {
    return <LiveStorefrontIframePreview url={liveUrl} className={className} />
  }

  if (isLoading && siteId) {
    return (
      <div
        className={cn(
          'h-full bg-gradient-to-br from-primary/10 via-accent to-primary/5 animate-pulse',
          className,
        )}
      />
    )
  }

  if (staticImage) {
    return (
      <div className={cn('relative h-full w-full overflow-hidden', className)}>
        <img src={staticImage} alt="" className="h-full w-full object-cover" loading="lazy" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
      </div>
    )
  }

  if (gradient) {
    return (
      <div
        className={cn('relative h-full w-full overflow-hidden', className)}
        style={{ background: gradient }}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
      </div>
    )
  }

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
