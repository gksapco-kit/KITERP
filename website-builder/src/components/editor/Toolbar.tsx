import type { MouseEvent } from 'react'
import {
  Copy,
  Download,
  Eye,
  ExternalLink,
  Layers,
  Maximize2,
  Minimize2,
  Moon,
  Pencil,
  RotateCcw,
  Sun,
} from 'lucide-react'
import { TemplatePickerModal } from './TemplatePickerModal'
import { getCategoryLabel } from '../../lib/categories'
import {
  createLivePreviewKey,
  stashLivePreviewPayload,
} from '../../lib/livePreviewTransfer'
import { openLivePreview } from '../../lib/openLivePreviewAction'
import { getLiveSiteUrl, persistSite } from '../../lib/sitePersistence'
import { useBuilderStore } from '../../store/useBuilderStore'

export function Toolbar() {
  const mode = useBuilderStore((s) => s.mode)
  const setMode = useBuilderStore((s) => s.setMode)
  const siteName = useBuilderStore((s) => s.siteName)
  const setSiteName = useBuilderStore((s) => s.setSiteName)
  const siteConfig = useBuilderStore((s) => s.siteConfig)
  const clearCanvas = useBuilderStore((s) => s.clearCanvas)
  const resetOnboarding = useBuilderStore((s) => s.resetOnboarding)
  const darkMode = useBuilderStore((s) => s.darkMode)
  const setDarkMode = useBuilderStore((s) => s.setDarkMode)
  const canvasMaximized = useBuilderStore((s) => s.canvasMaximized)
  const toggleCanvasMaximized = useBuilderStore((s) => s.toggleCanvasMaximized)

  const handleExport = () => {
    const state = useBuilderStore.getState()
    const data = {
      siteName: state.siteName,
      siteConfig: state.siteConfig,
      pages: state.pages,
      catalog: state.catalog,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${siteName.toLowerCase().replace(/\s+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleRestart = () => {
    if (confirm('Start over? This will reset your website and show the setup wizard again.')) {
      resetOnboarding()
    }
  }

  const activePageId = useBuilderStore((s) => s.activePageId)
  const pages = useBuilderStore((s) => s.pages)
  const activePageSlug =
    pages.find((p) => p.id === activePageId)?.slug?.trim() ||
    pages.find((p) => p.kind === 'home')?.slug?.trim() ||
    'home'

  const handleViewLiveSite = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    openLivePreview()
  }

  const handleCopyLiveUrl = async () => {
    const state = useBuilderStore.getState()
    if (!state.siteConfig || state.pages.length === 0) {
      alert('Finish setup and add at least one page before copying the live URL.')
      return
    }
    persistSite(state, { immediate: true })
    const previewKey = createLivePreviewKey()
    stashLivePreviewPayload(previewKey, {
      siteName: state.siteName,
      siteConfig: state.siteConfig,
      pages: state.pages,
      catalog: state.catalog,
    })
    const url = getLiveSiteUrl(activePageSlug, previewKey)
    await navigator.clipboard.writeText(url)
    alert(`Live site URL copied:\n${url}`)
  }

  return (
    <header className="relative isolate z-[200] flex h-14 shrink-0 items-center gap-2 overflow-x-auto border-b border-gray-200 bg-white px-3 shadow-sm">
      <div className="flex min-w-0 shrink-0 items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
          <Layers className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <input
            className="w-full min-w-[8rem] border-none bg-transparent text-sm font-semibold text-gray-900 outline-none"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
          />
          <p className="truncate text-xs text-gray-400">
            {siteConfig
              ? `${siteConfig.businessType} · ${getCategoryLabel(siteConfig.category)}`
              : 'Website Builder'}
          </p>
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setDarkMode(!darkMode)}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          title="Toggle canvas dark mode preview"
        >
          {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {darkMode ? 'Light' : 'Dark'}
        </button>

        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              mode === 'edit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              mode === 'preview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
        </div>

        {mode === 'edit' && (
          <button
            type="button"
            onClick={toggleCanvasMaximized}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
            title={canvasMaximized ? 'Show side panels (Esc)' : 'Expand canvas — hide side panels'}
          >
            {canvasMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {canvasMaximized ? 'Panels' : 'Expand'}
          </button>
        )}

        <div className="flex shrink-0 items-center gap-2">
        <TemplatePickerModal />
        <button
          type="button"
          onClick={() => void handleCopyLiveUrl()}
          className="hidden shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100 sm:flex"
          title="Copy live site URL"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy URL
        </button>
        <button
          type="button"
          onClick={handleViewLiveSite}
          onPointerDown={(e) => e.stopPropagation()}
          className="relative z-[210] flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border-2 border-brand-600 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50 active:scale-[0.98]"
          title="Open live preview on port 3002 (keep vendor tab open)"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          View Live Site
        </button>
        <button
          type="button"
          onClick={clearCanvas}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear Page
        </button>
        <button
          type="button"
          onClick={handleRestart}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
        >
          Start Over
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
        </div>
      </div>
    </header>
  )
}
