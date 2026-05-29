import { blockBackgroundStyle, blockInnerLayoutStyle } from '../../lib/blockUtils'
import {
  containerChildAlignClass,
  containerChildContentClass,
  containerChildSpanClass,
  containerGapClass,
  containerItemsAlignClass,
  containerLayoutClass,
} from '../../lib/containerLayout'
import type { Block } from '../../types/builder'
import { BlockRenderer } from './BlockRenderer'

interface ContainerBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
  interactive?: boolean
  onNavigate?: (slug: string) => void
}

export function ContainerBlock({ block, layoutStyle, interactive, onNavigate }: ContainerBlockProps) {
  const children = block.children ?? []
  const layout = block.props.containerLayout ?? 'row'
  const gap = block.props.containerGap ?? 'md'
  const layoutClass = containerLayoutClass(layout).replace(/gap-\S+/g, '').trim()
  const gapClass = containerGapClass(gap)
  const itemsAlignClass = containerItemsAlignClass(
    layout,
    block.props.containerAlignX,
    block.props.containerAlignY,
  )

  const shellStyle = {
    ...blockBackgroundStyle(block.styles),
    ...blockInnerLayoutStyle(block.styles),
    ...layoutStyle,
  }

  return (
    <section style={shellStyle} className="w-full">
      {block.props.containerLabel && (
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
          {block.props.containerLabel}
        </p>
      )}
      <div className={`${layoutClass} ${gapClass} ${itemsAlignClass}`}>
        {children.map((child) => {
          const childAlignY = child.props.containerChildAlignY ?? block.props.containerAlignY
          return (
          <div
            key={child.id}
            className={`${containerChildSpanClass(child.props.containerSpan, layout)} ${containerChildAlignClass(
              layout,
              child.props.containerChildAlignX,
              child.props.containerChildAlignY,
            )} flex min-h-0 flex-col ${containerChildContentClass(childAlignY)}`}
          >
            <BlockRenderer block={child} interactive={interactive} onNavigate={onNavigate} nestedInContainer />
          </div>
          )
        })}
      </div>
    </section>
  )
}
