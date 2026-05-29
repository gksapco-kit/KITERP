import { allBlockDefinitions, blockCategories } from '../../lib/blockRegistry'
import { PaletteItem } from './PaletteItem'

export function ComponentPalette() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-gray-50 xl:w-64">
      <div className="border-b border-gray-200 px-4 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Components</h2>
        <p className="mt-1 text-xs text-gray-500">Drag elements onto the canvas</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {blockCategories.map((category) => {
          const blocks = allBlockDefinitions.filter((b) => b.category === category.id)
          if (blocks.length === 0) return null
          return (
            <div key={category.id} className="mb-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {category.label}
              </h3>
              <div className="space-y-2">
                {blocks.map((def) => (
                  <PaletteItem key={def.type} definition={def} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
