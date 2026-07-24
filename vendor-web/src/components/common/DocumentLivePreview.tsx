import { useRef, useState, useCallback, useEffect, memo, type ReactNode } from 'react'
import { Eye, Loader2, Pencil, FilePlus, Trash2, ExternalLink, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { extractOfferTemplateFromDoc, addOfferPage, removeOfferPage } from '@/lib/offerPages'
import { createDefaultContinuationPage } from '@/lib/documentPreview'

const DEFAULT_SCALE = 0.88
const DEFAULT_WIDTH = 720

export const DocumentLivePreview = memo(function DocumentLivePreview({
  html,
  loading,
  editable = false,
  onBodyChange,
  pageCount = 1,
  title = 'Live Preview',
  badge,
  hint,
  documentWidth = DEFAULT_WIDTH,
  previewScale,
  containerWidth,
  headerExtra,
  emptyMessage = 'Generating preview…',
  iframeTitle = 'Document preview',
  createBlankPage,
}: {
  html: string
  loading?: boolean
  editable?: boolean
  onBodyChange?: (bodyHtml: string) => void
  pageCount?: number
  title?: string
  badge?: string
  hint?: string
  documentWidth?: number
  previewScale?: number
  containerWidth?: string
  headerExtra?: ReactNode
  emptyMessage?: string
  iframeTitle?: string
  /** Factory for a new A4 page HTML fragment (full .page div). */
  createBlankPage?: (nextPageNumber: number) => string
}) {
  const scale = previewScale ?? (documentWidth < 400 ? 1 : DEFAULT_SCALE)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [frameHeight, setFrameHeight] = useState(480)
  const lastHtmlRef = useRef('')
  const skipReloadRef = useRef(false)
  const syncTimerRef = useRef<number | null>(null)
  const cleanupEditRef = useRef<(() => void) | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedPage, setSelectedPage] = useState(1)

  useEffect(() => {
    if (selectedPage > pageCount) {
      setSelectedPage(Math.max(1, pageCount))
    }
  }, [pageCount, selectedPage])

  const scrollToPage = useCallback((pageNum: number) => {
    const doc = iframeRef.current?.contentDocument
    const container = scrollRef.current
    if (!doc || !container) return
    const pages = doc.querySelectorAll('.page')
    const page = pages[pageNum - 1] as HTMLElement | undefined
    if (!page) return
    const top = (page.offsetTop + (page.offsetParent as HTMLElement)?.offsetTop ?? 0) * scale
    container.scrollTo({ top: Math.max(0, top - 12), behavior: 'smooth' })
  }, [scale])

  useEffect(() => {
    if (pageCount > 1) {
      const t = window.setTimeout(() => scrollToPage(selectedPage), 120)
      return () => window.clearTimeout(t)
    }
  }, [selectedPage, pageCount, html, scrollToPage])

  const resizeFrame = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc?.body) return

    if (!doc.getElementById('kiterp-preview-fit')) {
      const style = doc.createElement('style')
      style.id = 'kiterp-preview-fit'
      style.textContent = `
        html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; overflow-y: hidden !important; width: 100% !important; }
        .page { margin: 0 !important; min-height: 0 !important; width: 100% !important; max-width: 100% !important; overflow: hidden !important; }
        .page[data-doc-page-active="true"] { box-shadow: inset 0 0 0 2px rgba(59,130,246,.35); }
        .body-content { overflow-wrap: break-word; word-break: break-word; }
        .body-content table, table { table-layout: fixed; width: 100% !important; }
      `
      doc.head.appendChild(style)
    }

    const pages = doc.querySelectorAll('.page')
    pages.forEach((p, i) => {
      p.removeAttribute('data-doc-page-active')
      if (i + 1 === selectedPage) p.setAttribute('data-doc-page-active', 'true')
    })

    let h = 0
    if (pages.length > 0) {
      pages.forEach(page => {
        const el = page as HTMLElement
        h = Math.max(h, el.offsetTop + el.offsetHeight)
      })
    } else {
      h = doc.documentElement.scrollHeight || doc.body.scrollHeight
    }
    setFrameHeight(Math.max(120, h + 8))
  }, [selectedPage])

  const syncBodyFromPreview = useCallback((immediate = false) => {
    if (!onBodyChange) return
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    onBodyChange(extractOfferTemplateFromDoc(doc))
    skipReloadRef.current = true
    if (immediate) lastHtmlRef.current = html
  }, [html, onBodyChange])

  const setupEditable = useCallback((doc: Document) => {
    cleanupEditRef.current?.()
    cleanupEditRef.current = null
    if (!editable || !onBodyChange) return

    const els = Array.from(
      doc.querySelectorAll(
        '.page[data-doc-editable="full"], .page-inner[data-offer-editable="full"], [data-offer-editable]',
      ),
    ) as HTMLElement[]
    if (!els.length) return

    const scheduleSync = () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current)
      syncTimerRef.current = window.setTimeout(() => syncBodyFromPreview(false), 220)
    }

    const onFocus = () => setIsEditing(true)
    const onBlur = () => {
      setIsEditing(false)
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current)
      syncBodyFromPreview(true)
    }
    const onInput = () => {
      scheduleSync()
      resizeFrame()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && (e.target as HTMLElement)?.closest('table')) return
    }

    els.forEach(el => {
      el.contentEditable = 'true'
      el.setAttribute('role', 'textbox')
      el.setAttribute('aria-multiline', 'true')
      el.setAttribute('aria-label', 'Document page — click to edit')
      el.addEventListener('focus', onFocus)
      el.addEventListener('blur', onBlur)
      el.addEventListener('input', onInput)
      el.addEventListener('keydown', onKeyDown)
    })

    cleanupEditRef.current = () => {
      els.forEach(el => {
        el.removeEventListener('focus', onFocus)
        el.removeEventListener('blur', onBlur)
        el.removeEventListener('input', onInput)
        el.removeEventListener('keydown', onKeyDown)
        el.contentEditable = 'false'
      })
    }
  }, [editable, onBodyChange, resizeFrame, syncBodyFromPreview])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !html) return

    if (skipReloadRef.current) {
      skipReloadRef.current = false
      lastHtmlRef.current = html
      const t = window.setTimeout(resizeFrame, 0)
      return () => window.clearTimeout(t)
    }

    if (html === lastHtmlRef.current) {
      const t = window.setTimeout(resizeFrame, 0)
      return () => window.clearTimeout(t)
    }

    lastHtmlRef.current = html
    const doc = iframe.contentDocument
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()
    setupEditable(doc)
    const t = window.setTimeout(resizeFrame, 80)
    return () => window.clearTimeout(t)
  }, [html, resizeFrame, setupEditable])

  useEffect(() => () => {
    cleanupEditRef.current?.()
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current)
  }, [])

  const openFullPreview = () => {
    syncBodyFromPreview(true)
    if (!html) return
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(html)
      w.document.close()
    }
  }

  const addingPageRef = useRef(false)

  const handleAddPage = () => {
    if (!onBodyChange || addingPageRef.current) return
    addingPageRef.current = true
    const doc = iframeRef.current?.contentDocument
    const current = doc ? extractOfferTemplateFromDoc(doc) : html
    const nextNum = pageCount + 1
    const blank = createBlankPage?.(nextNum) ?? createDefaultContinuationPage(nextNum)
    skipReloadRef.current = false
    onBodyChange(addOfferPage(current, blank))
    setSelectedPage(nextNum)
    window.setTimeout(() => { addingPageRef.current = false }, 400)
  }

  const handleRemovePage = () => {
    if (!onBodyChange || pageCount <= 1) return
    const doc = iframeRef.current?.contentDocument
    const current = doc ? extractOfferTemplateFromDoc(doc) : html
    const pageIndex = Math.min(Math.max(selectedPage, 1), pageCount) - 1
    skipReloadRef.current = false
    onBodyChange(removeOfferPage(current, pageIndex))
    setSelectedPage(prev => Math.min(prev, Math.max(1, pageCount - 1)))
  }

  const scaledWidth = containerWidth ?? (scale < 1 ? `${Math.round(documentWidth * scale)}px` : '100%')
  const scaledHeight = scale < 1 ? Math.ceil(frameHeight * scale) : frameHeight
  const multiPage = pageCount > 1

  return (
    <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-gray-400 shrink-0" />
            <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {editable ? (
              <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium ${
                isEditing
                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                <Pencil className="w-3 h-3" />
                {isEditing ? 'Editing…' : 'Click to edit'}
              </span>
            ) : (
              <span className="text-[11px] text-gray-400">Sample data</span>
            )}
            {multiPage && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">
                <Layers className="w-3 h-3" />
                {pageCount} pages
              </span>
            )}
            {badge && !headerExtra && (
              <span className="text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs shrink-0 gap-1.5"
          disabled={!html}
          onClick={openFullPreview}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Open full preview</span>
          <span className="sm:hidden">Open</span>
        </Button>
      </div>

      {/* Toolbar row */}
      {(headerExtra || (editable && onBodyChange)) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
          {headerExtra && (
            <div className="flex items-center min-w-0">
              {headerExtra}
            </div>
          )}
          {editable && onBodyChange && (
            <div className={`flex flex-wrap items-center gap-2 ${headerExtra ? 'sm:border-l sm:border-gray-100 sm:pl-3' : ''}`}>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 hidden sm:inline">Pages</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1 bg-white"
                onClick={handleAddPage}
              >
                <FilePlus className="w-3.5 h-3.5" />
                Add page
              </Button>
              {multiPage && (
                <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                  <Select
                    value={String(selectedPage)}
                    onChange={(v) => setSelectedPage(Number(v))}
                    wrapperClassName="min-w-[96px]"
                    className="h-7 rounded-md border-0 bg-white px-2 text-xs font-medium text-gray-800 shadow-sm"
                    menuMinWidth={140}
                    aria-label="Select page"
                    options={Array.from({ length: pageCount }, (_, i) => ({
                      value: String(i + 1),
                      label: `Page ${i + 1} of ${pageCount}`,
                    }))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleRemovePage}
                    title={`Delete page ${selectedPage}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Delete</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {editable && hint && (
        <p className="text-xs text-gray-500 leading-relaxed">{hint}</p>
      )}

      <div
        ref={scrollRef}
        className="border rounded-xl overflow-auto bg-gray-100 min-h-[560px] max-h-[85vh] flex items-start justify-center py-2 px-2 sm:py-3 sm:px-3"
      >
        {loading || !html ? (
          <div className="flex flex-col items-center justify-center gap-2 w-full min-h-[480px] text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm">{loading ? 'Loading…' : emptyMessage}</span>
          </div>
        ) : (
          <div
            className="mx-auto shrink-0 shadow-lg rounded-lg bg-white overflow-hidden"
            style={{
              width: scaledWidth,
              maxWidth: containerWidth ? undefined : '760px',
              height: scaledHeight,
            }}
          >
            <div
              style={
                scale < 1
                  ? {
                    width: documentWidth,
                    height: frameHeight,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                  }
                  : { width: '100%', height: frameHeight }
              }
            >
              <iframe
                ref={iframeRef}
                title={iframeTitle}
                onLoad={() => {
                  const doc = iframeRef.current?.contentDocument
                  if (doc) setupEditable(doc)
                  resizeFrame()
                }}
                scrolling="no"
                className={`border-0 block bg-white w-full ${editable ? 'cursor-text' : ''}`}
                style={{ height: frameHeight, width: scale < 1 ? documentWidth : '100%' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
