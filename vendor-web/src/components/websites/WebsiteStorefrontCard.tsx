import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, ExternalLink, Eye, Loader2, Monitor, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

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
        'flex h-full flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden',
        className,
      )}
    >
      <div className="relative h-24 shrink-0 overflow-hidden">
        {templateThumbnail ? (
          <>
            <img src={templateThumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
          </>
        ) : (
          <div className="h-full bg-gradient-to-br from-primary/15 via-accent to-primary/5 flex items-center justify-center">
            <div className="w-10 h-10 rounded-xl bg-primary shadow-sm flex items-center justify-center">
              <Monitor className="w-5 h-5 text-white" />
            </div>
          </div>
        )}
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
          <span className="absolute bottom-2 left-2 right-2 inline-flex items-center gap-1 max-w-[calc(100%-1rem)] rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-extrabold text-gray-800 shadow-sm">
            <Sparkles className="w-2.5 h-2.5 text-primary shrink-0" />
            <span className="truncate">{templateName}</span>
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-3 min-h-0">
        <h3 className="text-sm font-bold text-gray-900 truncate">{name}</h3>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-snug flex-1">{description}</p>

        {liveUrl && !isBuilderDraft ? (
          <div className="mt-2 flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
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
                'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-gray-200 bg-white text-gray-500 hover:text-gray-800',
                copied && 'border-emerald-200 text-emerald-700',
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
