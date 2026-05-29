import { useMemo, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { BlockRenderer } from '../blocks/BlockRenderer'
import { ContainerEditor } from './ContainerEditor'
import { blockRegistry } from '../../lib/blockRegistry'
import { useBuilderStore } from '../../store/useBuilderStore'
import type { Block } from '../../types/builder'
import { BlockSelectionFrame } from './BlockSelectionFrame'
import { blockPagePositionClass, hasFixedWidth, isInlineBlockType } from '../../lib/blockUtils'
import { canvasFullBleedClass, fullBleedEdgeForBlock, isFullBleedBlockType, supportsHeroBannerLayoutOptions } from '../../lib/pageLayout'
import { parseSizePx, type BlockSizePatch } from './useBlockSizeResize'

interface CanvasBlockProps {
  block: Block
  isPreview: boolean
  onNavigate?: (slug: string) => void
  /** When true, parent ContainerChildSlot owns drag-and-drop */
  nestedInContainer?: boolean
}

export function CanvasBlock({ block, isPreview, onNavigate, nestedInContainer }: CanvasBlockProps) {
  const { selectedBlockId, selectBlock, removeBlock, duplicateBlock, updateBlockStyles, updateBlockProps } = useBuilderStore()
  const isSelected = selectedBlockId === block.id
  const contentRef = useRef<HTMLDivElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [previewSize, setPreviewSize] = useState<BlockSizePatch | undefined>()

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: isPreview || nestedInContainer,
  })

  const displayBlock = useMemo((): Block => {
    if (!isResizing || !previewSize) return block
    return {
      ...block,
      styles: {
        ...block.styles,
        width: previewSize.width ?? block.styles.width,
        height: previewSize.height ?? block.styles.height,
      },
    }
  }, [block, isResizing, previewSize])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isResizing ? undefined : transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const layoutOptions = { nestedInContainer }
  const isFullBleed =
    isFullBleedBlockType(block.type, layoutOptions) && !hasFixedWidth(block.styles.width)
  const bleedEdge = fullBleedEdgeForBlock(block.type, layoutOptions)
  const fullBleedClass =
    isFullBleed && bleedEdge && !hasFixedWidth(block.styles.width)
      ? canvasFullBleedClass(isPreview, bleedEdge)
      : ''

  if (isPreview) {
    return (
      <div className={`relative ${fullBleedClass} ${nestedInContainer ? 'h-full min-h-0 flex flex-1 flex-col' : ''}`}>
        {block.type === 'container' ? (
          <ContainerEditor block={block} displayBlock={block} isPreview onNavigate={onNavigate} />
        ) : (
          <BlockRenderer block={block} interactive onNavigate={onNavigate} />
        )}
      </div>
    )
  }

  const activeWidth = isResizing ? previewSize?.width : block.styles.width
  const parsedWidth = parseSizePx(activeWidth)
  const inline = isInlineBlockType(block.type)
  const hasExplicitWidth = !!parsedWidth || inline
  const pagePositionClass = blockPagePositionClass(displayBlock)

  const startResize = () => {
    setIsResizing(true)
    setPreviewSize({
      width: block.styles.width,
      height: block.styles.height,
    })
  }

  const sortableRef = nestedInContainer ? undefined : setNodeRef
  const sortableStyle = nestedInContainer ? undefined : style

  return (
    <div
      ref={sortableRef}
      style={sortableStyle}
      className={`${isResizing ? 'select-none' : ''} min-w-0 ${fullBleedClass} ${nestedInContainer ? 'h-full min-h-0 flex flex-1 flex-col' : ''} ${
        isSelected ? 'relative z-10' : 'relative'
      }`}
    >
      <div
        ref={contentRef}
        className={`group relative rounded-lg ${hasExplicitWidth ? `max-w-full ${pagePositionClass}` : 'w-full'} ${
          nestedInContainer ? 'h-full min-h-0 flex flex-1 flex-col' : ''
        } ${
          isSelected && !parsedWidth && !isFullBleed ? 'px-4 py-4' : ''
        } ${isSelected ? '' : isFullBleed ? '' : 'hover:outline hover:outline-1 hover:outline-gray-200'}`}
        style={
          parsedWidth
            ? { width: activeWidth, boxSizing: 'border-box' }
            : inline
              ? { width: 'fit-content', maxWidth: '100%', boxSizing: 'border-box' }
              : undefined
        }
        onClick={(e) => {
          if (isResizing) return
          e.stopPropagation()
          selectBlock(block.id)
        }}
      >
        {block.type === 'container' ? (
          <ContainerEditor block={block} displayBlock={displayBlock} isPreview={false} onNavigate={onNavigate} />
        ) : (
          <BlockRenderer block={displayBlock} />
        )}
        {isSelected && (
          <BlockSelectionFrame
            label={blockRegistry[block.type]?.label ?? block.type}
            containerRef={contentRef}
            currentWidth={isResizing ? previewSize?.width : block.styles.width}
            currentHeight={isResizing ? previewSize?.height : block.styles.height}
            onResizeStart={startResize}
            onResize={(size) => setPreviewSize(size)}
            onResizeEnd={(size) => {
              const patch: Partial<typeof block.styles> = {}
              if ('width' in size) patch.width = size.width
              if ('height' in size) patch.height = size.height
              updateBlockStyles(block.id, patch)
              if (size.height && supportsHeroBannerLayoutOptions(block.type)) {
                updateBlockProps(block.id, { heroSectionHeight: size.height })
              }
              setIsResizing(false)
              setPreviewSize(undefined)
            }}
            onResizeCancel={() => {
              setIsResizing(false)
              setPreviewSize(undefined)
            }}
            onDelete={() => removeBlock(block.id)}
            onDuplicate={() => duplicateBlock(block.id)}
            dragHandleRef={setActivatorNodeRef}
            dragHandleProps={{ ...attributes, ...listeners }}
          />
        )}
      </div>
    </div>
  )
}
