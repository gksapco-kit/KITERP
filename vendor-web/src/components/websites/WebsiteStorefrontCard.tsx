import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, ExternalLink, Eye, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { WebsiteSiteGlimpse } from '@/components/websites/WebsiteSiteGlimpse'
import type { WebsiteTemplate } from '@/types/websites'

type Props = {
  name: string
  description: string
  builderTo: string
  liveUrl?: string | null
  live?: boolean
  draft?: boolean
  /** When set, shows Preview instead of View live store (Website Builder drafts). */
  previewSiteId?: string
  onPreview?: (siteId: string) => void | Promise<void>
  /** When set, primary action opens theme customizer instead of the website builder. */
  onChangeTheme?: () => void
  templateName?: string | null
  templateThumbnail?: string | null
  /** When set, loads homepage hero/section images for the card preview. */
  thumbnailSiteId?: string | null
  /** Live customer store URL for default/legacy storefront cards. */
  livePreviewUrl?: string | null
  vendorSlug?: string | null
  previewTemplates?: WebsiteTemplate[]
  fallbackGradient?: string | null
  className?: string
}

export function WebsiteStorefrontCard({
  name,
  description,
  builderTo,
  liveUrl = null,
  live,
  draft,
  previewSiteId,
  onPreview,
  onChangeTheme,
  templateName,
  templateThumbnail,
  thumbnailSiteId,
  livePreviewUrl,
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
    <div
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:shadow-none dark:ring-1 dark:ring-border/50',
        className,
      )}
    >
      <div className="relative h-24 shrink-0 overflow-hidden">
        <WebsiteSiteGlimpse
          siteId={thumbnailSiteId}
          vendorSlug={vendorSlug}
          fallbackImage={templateThumbnail}
          fallbackGradient={fallbackGradient}
          livePreviewUrl={livePreviewUrl}
          templates={previewTemplates}
          className="absolute inset-0"
        />
        {live ? (
          <span className="absolute top-2 left-2 text-[9px] uppercase tracking-wide font-extrabold bg-primary text-white rounded-full px-1.5 py-0.5">
            Live
          </span>
        ) : null}
        {draft && !live ? (
          <span className="absolute top-2 left-2 text-[9px] uppercase tracking-wide font-extrabold bg-amber-500 text-white rounded-full px-1.5 py-0.5">
            Draft
          </span>
        ) : null}
        {templateName ? (
          <span className="absolute bottom-2 left-2 right-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-full border border-border/60 bg-card/95 px-2 py-0.5 text-[10px] font-extrabold text-foreground shadow-sm backdrop-blur-sm dark:bg-card/90">
            <Sparkles className="h-2.5 w-2.5 shrink-0 text-primary" />
            <span className="truncate">{templateName}</span>
          </span>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <h3 className="truncate text-sm font-bold text-foreground">{name}</h3>
        <p className="mt-0.5 line-clamp-2 flex-1 text-xs leading-snug text-muted-foreground">{description}</p>

        {liveUrl && !isBuilderDraft ? (
          <div className="mt-2 flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1.5 dark:bg-muted/25">
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate font-mono text-[10px] text-primary hover:underline"
              title={liveUrl}
            >
              {liveUrl}
            </a>
            <button
              type="button"
              onClick={() => void copyLink()}
              className={cn(
                'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border bg-background text-muted-foreground hover:text-foreground dark:bg-card',
                copied && 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
              )}
              title={copied ? 'Copied' : 'Copy store link'}
              aria-label="Copy store link"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        ) : null}

        <div className={cn('grid grid-cols-2 gap-1.5', liveUrl && !isBuilderDraft ? 'mt-2' : 'mt-2.5')}>
          {isBuilderDraft && previewSiteId && onPreview ? (
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={previewing}
              onClick={() => void handlePreview()}
              className="h-8 px-2 text-[11px] gap-1"
            >
              {previewing ? (
                <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
              ) : (
                <Eye className="w-3 h-3 shrink-0" />
              )}
              <span className="truncate">{previewing ? 'Opening…' : 'Preview'}</span>
            </Button>
          ) : liveUrl ? (
            <Button variant="outline" size="sm" asChild className="h-8 px-2 text-[11px] gap-1">
              <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span className="truncate">View live store</span>
              </a>
            </Button>
          ) : (
            <span />
          )}
          {onChangeTheme ? (
            <Button
              size="sm"
              type="button"
              onClick={onChangeTheme}
              className={cn('h-8 px-2 text-[11px]', (!liveUrl || isBuilderDraft) && !previewSiteId && 'col-span-2')}
            >
              Change Theme
            </Button>
          ) : (
            <Button
              size="sm"
              asChild
              className={cn('h-8 px-2 text-[11px]', (!liveUrl || isBuilderDraft) && !previewSiteId && 'col-span-2')}
            >
              <Link to={builderTo}>Open builder</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
