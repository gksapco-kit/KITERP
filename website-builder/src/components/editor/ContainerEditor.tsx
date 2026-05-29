import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { LayoutTemplate } from 'lucide-react'
import { blockBackgroundStyle, blockInnerLayoutStyle } from '../../lib/blockUtils'
import { containerDropId } from '../../lib/blockTree'
import {
  containerChildAlignClass,
  containerChildContentClass,
  containerChildSpanClass,
  containerGapClass,
  containerItemsAlignClass,
  containerLayoutClass,
} from '../../lib/containerLayout'
import type { Block, BlockType, ContainerAlign, ContainerLayout } from '../../types/builder'
import { useBuilderStore } from '../../store/useBuilderStore'
import { ContainerAddBar } from './ContainerAddBar'
import { ContainerChildChrome } from './ContainerChildChrome'
import { CanvasBlock } from './CanvasBlock'

interface ContainerEditorProps {
  block: Block
  displayBlock: Block
  isPreview: boolean
  onNavigate?: (slug: string) => void
}

function sortableStrategy(layout: ContainerLayout) {
  switch (layout) {
    case 'row':
      return horizontalListSortingStrategy
    case 'grid':
      return rectSortingStrategy
    default:
      return verticalListSortingStrategy
  }
}

export function ContainerEditor({ block, displayBlock, isPreview, onNavigate }: ContainerEditorProps) {
  const children = displayBlock.children ?? []
  const layout = (displayBlock.props.containerLayout ?? 'row') as ContainerLayout
  const gap = displayBlock.props.containerGap ?? 'md'
  const layoutClass = containerLayoutClass(layout).replace(/gap-\S+/g, '').trim()
  const gapClass = containerGapClass(gap)
  const itemsAlignClass = containerItemsAlignClass(
    layout,
    displayBlock.props.containerAlignX,
    displayBlock.props.containerAlignY,
  )
  const darkMode = useBuilderStore((s) => s.darkMode)
  const addBlock = useBuilderStore((s) => s.addBlock)
  const updateBlockProps = useBuilderStore((s) => s.updateBlockProps)
  const reorderChild = useBuilderStore((s) => s.reorderContainerChild)

  const shellStyle = {
    ...blockBackgroundStyle(displayBlock.styles, darkMode),
    ...blockInnerLayoutStyle(displayBlock.styles, darkMode),
  }

  const { setNodeRef, isOver } = useDroppable({
    id: containerDropId(block.id),
    disabled: isPreview,
  })

  const handleAdd = (type: BlockType) => {
    addBlock(type, children.length, block.id)
  }

  const childGrid = (
    <div className={`${layoutClass} ${gapClass} ${itemsAlignClass}`}>
      {children.map((child, index) => (
        <ContainerChildSlot
          key={child.id}
          child={child}
          layout={layout}
          containerAlignY={displayBlock.props.containerAlignY}
          index={index}
          total={children.length}
          isPreview={isPreview}
          onNavigate={onNavigate}
          onSpanChange={(span) => updateBlockProps(child.id, { containerSpan: span })}
          onAlignChange={(alignX, alignY) =>
            updateBlockProps(child.id, {
              containerChildAlignX: alignX,
              containerChildAlignY: alignY,
            })
          }
          onMove={(dir) => reorderChild(block.id, child.id, dir)}
        />
      ))}
    </div>
  )

  if (isPreview) {
    return (
      <div style={shellStyle} className="w-full">
        {childGrid}
      </div>
    )
  }

  return (
    <div style={shellStyle} className="w-full">
      <div
        ref={setNodeRef}
        className={`min-h-[100px] rounded-lg border-2 border-dashed transition ${
          isOver ? 'border-brand-400 bg-brand-50/30' : 'border-gray-300/80 bg-transparent'
        } ${children.length === 0 ? 'p-6' : 'p-3'}`}
      >
        {children.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <LayoutTemplate className="mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">Empty container</p>
            <p className="mt-1 max-w-xs text-xs text-gray-400">
              Add components below or drag from the left panel
            </p>
            <ContainerAddBar onAdd={handleAdd} />
          </div>
        ) : (
          <SortableContext items={children.map((c) => c.id)} strategy={sortableStrategy(layout)}>
            {childGrid}
            <ContainerAddBar onAdd={handleAdd} compact />
          </SortableContext>
        )}
      </div>
    </div>
  )
}

function ContainerChildSlot({
  child,
  layout,
  containerAlignY,
  index,
  total,
  isPreview,
  onNavigate,
  onSpanChange,
  onAlignChange,
  onMove,
}: {
  child: Block
  layout: ContainerLayout
  containerAlignY?: ContainerAlign
  index: number
  total: number
  isPreview: boolean
  onNavigate?: (slug: string) => void
  onSpanChange: (span: 1 | 2 | 3) => void
  onAlignChange: (alignX: ContainerAlign | undefined, alignY: ContainerAlign | undefined) => void
  onMove: (direction: 'up' | 'down') => void
}) {
  const span = (child.props.containerSpan ?? 1) as 1 | 2 | 3
  const spanClass = containerChildSpanClass(span, layout)
  const alignClass = containerChildAlignClass(
    layout,
    child.props.containerChildAlignX,
    child.props.containerChildAlignY,
  )
  const childAlignY = child.props.containerChildAlignY ?? containerAlignY
  const contentClass = containerChildContentClass(childAlignY)

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: child.id,
    disabled: isPreview,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className={`${spanClass} ${alignClass} ${contentClass} flex min-h-0 flex-col`}>
      {!isPreview && (
        <ContainerChildChrome
          layout={layout}
          span={span}
          alignX={child.props.containerChildAlignX}
          alignY={child.props.containerChildAlignY}
          index={index}
          total={total}
          onSpanChange={onSpanChange}
          onAlignChange={onAlignChange}
          onMove={onMove}
          dragHandleRef={setActivatorNodeRef}
          dragHandleProps={{ ...attributes, ...listeners }}
        />
      )}
      <CanvasBlock block={child} isPreview={isPreview} onNavigate={onNavigate} nestedInContainer />
    </div>
  )
}
