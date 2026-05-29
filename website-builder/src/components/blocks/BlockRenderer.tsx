import { useBuilderStore } from '../../store/useBuilderStore'
import { RenderBlock } from './RenderBlock'
import type { Block } from '../../types/builder'

interface BlockRendererProps {
  block: Block
  interactive?: boolean
  onNavigate?: (slug: string) => void
  /** Override store dark mode (e.g. live site per-page setting) */
  darkMode?: boolean
  nestedInContainer?: boolean
}

export function BlockRenderer({
  block,
  interactive,
  onNavigate,
  darkMode: darkModeProp,
  nestedInContainer,
}: BlockRendererProps) {
  const storeDarkMode = useBuilderStore((s) => s.darkMode)
  const darkMode = darkModeProp ?? storeDarkMode
  const selectedBlockId = useBuilderStore((s) => s.selectedBlockId)
  const updateBlockProps = useBuilderStore((s) => s.updateBlockProps)
  const selected = selectedBlockId === block.id

  return (
    <RenderBlock
      block={block}
      interactive={interactive}
      onNavigate={onNavigate}
      selected={selected}
      darkMode={darkMode}
      nestedInContainer={nestedInContainer}
      onPropsChange={!interactive ? (props) => updateBlockProps(block.id, props) : undefined}
    />
  )
}
