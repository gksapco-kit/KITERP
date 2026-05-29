import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'

/** Trailing slash — served by vite-website-builder-static (not vendor SPA fallback). */
function embedTemplatesUrl(): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  return `${base}/website-builder-app/templates`
}

export default function WebsiteTemplatesPage() {
  const embedSrc = useMemo(() => embedTemplatesUrl(), [])
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [iframeError, setIframeError] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!iframeLoaded) {
        setIframeError(
          'Templates page is taking too long to load. Run npm run build:website-builder from the repo root, then refresh.',
        )
      }
    }, 20_000)
    return () => window.clearTimeout(timer)
  }, [iframeLoaded])

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col">
      {!iframeLoaded && !iframeError && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <Loader2 className="pointer-events-auto h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      {iframeError && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background p-6 text-center">
          <p className="max-w-md text-sm text-muted-foreground">{iframeError}</p>
          <p className="max-w-lg break-all font-mono text-xs text-foreground">{embedSrc}</p>
        </div>
      )}
      <iframe
        title="Website Templates"
        src={embedSrc}
        className="h-full w-full border-0 bg-background"
        onLoad={() => {
          setIframeLoaded(true)
          setIframeError(null)
        }}
      />
    </div>
  )
}
