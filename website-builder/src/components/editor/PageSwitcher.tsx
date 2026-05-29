import { FilePlus, Trash2 } from 'lucide-react'
import { useBuilderStore } from '../../store/useBuilderStore'

export function PageSwitcher() {
  const pages = useBuilderStore((s) => s.pages)
  const activePageId = useBuilderStore((s) => s.activePageId)
  const setActivePage = useBuilderStore((s) => s.setActivePage)
  const addPage = useBuilderStore((s) => s.addPage)
  const removePage = useBuilderStore((s) => s.removePage)

  const handleAddPage = () => {
    const name = prompt('Page name:')
    if (name?.trim()) addPage(name.trim())
  }

  return (
    <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-2">
      <span className="text-xs font-medium text-gray-400">Pages:</span>
      <div className="flex flex-1 items-center gap-1 overflow-x-auto">
        {pages.map((page) => (
          <button
            key={page.id}
            type="button"
            onClick={() => setActivePage(page.id)}
            className={`group flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activePageId === page.id
                ? 'bg-brand-100 text-brand-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {page.name}
            {pages.length > 1 && activePageId === page.id && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`Delete page "${page.name}"?`)) removePage(page.id)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation()
                    if (confirm(`Delete page "${page.name}"?`)) removePage(page.id)
                  }
                }}
                className="ml-1 rounded p-0.5 opacity-0 hover:bg-red-100 hover:text-red-500 group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </span>
            )}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={handleAddPage}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-500 hover:border-brand-400 hover:text-brand-600"
      >
        <FilePlus className="h-3.5 w-3.5" />
        Add Page
      </button>
    </div>
  )
}
