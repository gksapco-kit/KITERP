import { useNavigate } from 'react-router-dom'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { LayoutTemplate, MousePointerClick } from 'lucide-react'
import { pageBackgroundStyle, resolvePageDarkMode } from '../../lib/pageBackground'
import { isStackNavPath } from '../../lib/categoryStackNav'
import { useActiveBlocks, useActivePage, useBuilderStore } from '../../store/useBuilderStore'
import { CanvasBlock } from './CanvasBlock'

export function Canvas() {
  const blocks = useActiveBlocks()
  const activePage = useActivePage()
  const pages = useBuilderStore((s) => s.pages)
  const mode = useBuilderStore((s) => s.mode)
  const setActivePage = useBuilderStore((s) => s.setActivePage)
  const selectBlock = useBuilderStore((s) => s.selectBlock)
  const isPreview = mode === 'preview'
  const canvasMaximized = useBuilderStore((s) => s.canvasMaximized)
  const darkMode = useBuilderStore((s) => s.darkMode)
  const pageDarkMode = resolvePageDarkMode(activePage ?? undefined, darkMode)

  const navigate = useNavigate()

  const handlePreviewNavigate = (slug: string) => {
    if (isStackNavPath(slug)) {
      navigate(`/site/${slug}`)
      return
    }
    const page = pages.find((p) => p.slug === slug)
    if (page) setActivePage(page.id)
  }

  const { setNodeRef, isOver } = useDroppable({ id: 'canvas-drop-zone' })

  const pageBgStyle = pageBackgroundStyle(activePage ?? undefined)
  const canvasSurfaceClass = isPreview
    ? 'w-full rounded-none py-6 shadow-none'
    : 'w-full rounded-none shadow-sm'

  const canvasPaddingClass =
    isPreview || canvasMaximized ? 'p-2 sm:p-3' : 'p-3 sm:p-4'

  const canvasOverflowClass = 'overflow-x-clip'

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-100">
      {isPreview && (
        <div className="flex shrink-0 items-center justify-center border-b border-gray-200 bg-white px-4 py-1.5">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="h-2 w-2 rounded-full bg-gray-300" />
            <div className="h-2 w-2 rounded-full bg-gray-300" />
            <span className="rounded-md bg-gray-100 px-12 py-0.5 text-gray-500">preview.local</span>
          </div>
        </div>
      )}

      <div
        className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto ${canvasPaddingClass}`}
        onClick={() => !isPreview && selectBlock(null)}
      >
        <div
          ref={setNodeRef}
          data-canvas-drop-zone
          className={`mx-auto min-h-[calc(100vh-180px)] w-full max-w-full transition ${canvasOverflowClass} ${canvasSurfaceClass} ${
            pageDarkMode ? 'dark text-gray-100' : 'text-gray-900'
          } ${isOver && !isPreview ? 'ring-2 ring-brand-400 ring-offset-4' : ''}`}
          style={pageBgStyle}
        >
          {blocks.length === 0 ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50">
                <LayoutTemplate className="h-8 w-8 text-brand-500" />
              </div>
              <h3 className={`mb-2 text-lg font-semibold ${pageDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Start building your website</h3>
              <p className={`mb-4 max-w-sm text-sm ${pageDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Drag components from the left panel and drop them here to create your page.
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <MousePointerClick className="h-4 w-4" />
                Drag & drop to get started
              </div>
            </div>
          ) : (
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div
                className={`${isPreview ? 'space-y-2 py-2' : 'space-y-8 px-1 pb-6 pt-10'} ${canvasOverflowClass}`}
              >
                {blocks.map((block) => (
                  <CanvasBlock
                    key={block.id}
                    block={block}
                    isPreview={isPreview}
                    onNavigate={isPreview ? handlePreviewNavigate : undefined}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </div>
      </div>
    </main>
  )
}
