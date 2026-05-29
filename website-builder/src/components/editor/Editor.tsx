import { useEffect, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { getTypeFromPaletteId, getBlockIcon, isPaletteId } from '../../lib/icons'
import { blockRegistry } from '../../lib/blockRegistry'
import {
  canNestBlockType,
  containerIdFromDropId,
  findBlockInTree,
  isContainerDropId,
} from '../../lib/blockTree'
import { useActiveBlocks, useBuilderStore } from '../../store/useBuilderStore'
import { Canvas } from './Canvas'
import { ComponentPalette } from './ComponentPalette'
import { PageSwitcher } from './PageSwitcher'
import { PropertiesPanel } from './PropertiesPanel'
import { Toolbar } from './Toolbar'

export function Editor() {
  const blocks = useActiveBlocks()
  const mode = useBuilderStore((s) => s.mode)
  const canvasMaximized = useBuilderStore((s) => s.canvasMaximized)
  const selectedBlockId = useBuilderStore((s) => s.selectedBlockId)
  const setCanvasMaximized = useBuilderStore((s) => s.setCanvasMaximized)
  const addBlock = useBuilderStore((s) => s.addBlock)
  const moveBlock = useBuilderStore((s) => s.moveBlock)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const showSidePanels = mode === 'edit' && !canvasMaximized

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && canvasMaximized) {
        setCanvasMaximized(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canvasMaximized, setCanvasMaximized])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeBlockId = String(active.id)
    const overId = String(over.id)

    if (isPaletteId(active.id)) {
      const type = getTypeFromPaletteId(active.id)

      if (isContainerDropId(overId)) {
        if (!canNestBlockType(type)) return
        const parentId = containerIdFromDropId(overId)
        const parent = findBlockInTree(blocks, parentId)
        addBlock(type, parent?.block.children?.length ?? 0, parentId)
        return
      }

      const overLoc = findBlockInTree(blocks, overId)
      if (overLoc) {
        if (overLoc.parent && !canNestBlockType(type)) return
        addBlock(type, overLoc.index, overLoc.parent?.id)
        return
      }

      const topIndex = blocks.findIndex((b) => b.id === overId)
      addBlock(type, topIndex >= 0 ? topIndex : undefined)
      return
    }

    if (activeBlockId !== overId) {
      moveBlock(activeBlockId, overId)
    }
  }

  const activePaletteType = activeId && isPaletteId(activeId) ? getTypeFromPaletteId(activeId) : null
  const ActiveIcon = activePaletteType ? getBlockIcon(blockRegistry[activePaletteType].icon) : null

  return (
    <div className="flex h-full flex-col">
      <Toolbar />
      <PageSwitcher />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {showSidePanels && <ComponentPalette />}
          <Canvas />
          {showSidePanels && <PropertiesPanel />}
          {canvasMaximized && mode === 'edit' && selectedBlockId && (
            <div className="absolute inset-y-0 right-0 z-30 w-80 border-l border-gray-200 bg-gray-50 shadow-xl">
              <PropertiesPanel />
            </div>
          )}
        </div>

        <DragOverlay>
          {activePaletteType && ActiveIcon ? (
            <div className="flex items-center gap-2 rounded-lg border border-brand-300 bg-white px-4 py-2 shadow-lg">
              <ActiveIcon className="h-4 w-4 text-brand-600" />
              <span className="text-sm font-medium text-gray-700">
                {blockRegistry[activePaletteType].label}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
