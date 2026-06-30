import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, ExternalLink, Eye, LayoutTemplate, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { WebsiteSiteGlimpse } from '@/components/websites/WebsiteSiteGlimpse'
import type { WebsiteTemplate } from '@/types/websites'

type Props = {
  name: string
  description: string
  storeCode?: string | null
  builderTo: string
  liveUrl?: string | null
  live?: boolean
  draft?: boolean
  previewSiteId?: string
  onPreview?: (siteId: string) => void | Promise<void>
  templateName?: string | null
  templateThumbnail?: string | null
  thumbnailSiteId?: string | null
  livePreviewUrl?: string | null
  vendorSlug?: string | null
  previewTemplates?: WebsiteTemplate[]
  fallbackGradient?: string | null
  className?: string
}

function shortStoreUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.pathname === '/' || !parsed.pathname) return parsed.host
    return `${parsed.host}${parsed.pathname}`
  } catch {
    return url
  }
}

export function WebsiteStorefrontCard({
  name,
  description,
  storeCode,
  builderTo,
  liveUrl = null,
  live,
  draft,
  previewSiteId,
  onPreview,
  templateName,
  templateThumbnail,
  thumbnailSiteId,
  vendorSlug,
  previewTemplates,
  fallbackGradient,
  className,
}: Props) {
  const [copied, setCopied] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const isBuilderDraft = Boolean(draft || previewSiteId)

  const copyLink = async () => {
    if (!liveUrl) return
    try {
      await navigator.clipboard.writeText(liveUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const handlePreview = async () => {
    if (!previewSiteId || !onPreview || previewing) return
    setPreviewing(true)
    try {
      await onPreview(previewSiteId)
    } finally {
      setPreviewing(false)
    }
  }

  return (
    <article
      className={cn(
        'group/card flex h-full flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md dark:shadow-none dark:ring-1 dark:ring-border/50',
        live ? 'border-primary/35 ring-1 ring-primary/15' : 'border-border',
        className,
      )}
    >
      <div className="relative h-16 shrink-0 overflow-hidden bg-muted/20">
        <WebsiteSiteGlimpse
          siteId={thumbnailSiteId}
          vendorSlug={vendorSlug}
          fallbackImage={templateThumbnail}
          fallbackGradient={fallbackGradient}
          templates={previewTemplates}
          previewMode="assigned"
          variant="card"
          className="absolute inset-0 transition-transform duration-300 group-hover/card:scale-[1.03]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-80" />
        {live ? (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-1.5 py-px text-[8px] font-extrabold uppercase tracking-wide text-white shadow-sm">
            Live
          </span>
        ) : null}
        {draft && !live ? (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-500 px-1.5 py-px text-[8px] font-extrabold uppercase tracking-wide text-white shadow-sm">
            Draft
          </span>
        ) : null}
        {liveUrl && !isBuilderDraft ? (
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 z-[2] flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover/card:bg-black/25 group-hover/card:opacity-100"
            title="Open live storefront"
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-gray-900 shadow-md">
              <ExternalLink className="h-3 w-3" />
              View live
            </span>
          </a>
        ) : null}
        {templateName ? (
          <span
            className={cn(
              'absolute right-1.5 top-1.5 z-[1] inline-flex max-w-[calc(100%-3rem)] items-center gap-0.5 rounded-full border border-border/60 bg-card/95 px-1.5 py-px text-[9px] font-semibold text-foreground shadow-sm backdrop-blur-sm dark:bg-card/90',
              liveUrl && !isBuilderDraft && 'transition-opacity group-hover/card:opacity-0',
            )}
            title={templateName}
          >
            <Sparkles className="h-2 w-2 shrink-0 text-primary" />
            <span className="truncate">{templateName}</span>
          </span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-2">
        <div className="flex items-start gap-1.5">
          {storeCode ? (
            <span className="mt-0.5 shrink-0 rounded bg-muted px-1 py-px font-mono text-[9px] font-bold text-muted-foreground">
              {storeCode}
            </span>
          ) : null}
          <h3 className="min-w-0 flex-1 truncate text-xs font-bold leading-tight text-foreground" title={name}>
            {name}
          </h3>
        </div>
        <p className="mt-0.5 line-clamp-2 min-h-[1.75rem] text-[10px] leading-snug text-muted-foreground" title={description}>
          {description}
        </p>

        {liveUrl && !isBuilderDraft ? (
          <div className="mt-1.5 flex items-center gap-1 rounded-md border border-border bg-muted/30 px-1.5 py-1 dark:bg-muted/20">
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate font-mono text-[9px] text-primary hover:underline"
              title={liveUrl}
            >
              {shortStoreUrl(liveUrl)}
            </a>
            <button
              type="button"
              onClick={() => void copyLink()}
              className={cn(
                'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-background text-muted-foreground hover:text-foreground dark:bg-card',
                copied && 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
              )}
              title={copied ? 'Copied' : 'Copy full link'}
              aria-label="Copy store link"
            >
              {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
            </button>
          </div>
        ) : null}

        <div className="mt-auto grid grid-cols-2 gap-1 pt-1.5">
          {isBuilderDraft && previewSiteId && onPreview ? (
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={previewing}
              onClick={() => void handlePreview()}
              className="h-7 px-1.5 text-[10px] gap-0.5"
            >
              {previewing ? (
                <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" />
              ) : (
                <Eye className="h-2.5 w-2.5 shrink-0" />
              )}
              <span className="truncate">{previewing ? 'Opening…' : 'Preview'}</span>
            </Button>
          ) : liveUrl ? (
            <Button variant="outline" size="sm" asChild className="h-7 px-1.5 text-[10px] gap-0.5">
              <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">View live</span>
              </a>
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild className="h-7 px-1.5 text-[10px] gap-0.5">
              <Link to={builderTo}>
                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">Open</span>
              </Link>
            </Button>
          )}
          <Button size="sm" asChild className="h-7 px-1.5 text-[10px]">
            <Link to="/websites/templates">
              <LayoutTemplate className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">Templates</span>
            </Link>
          </Button>
        </div>
      </div>
    </article>
  )
}
