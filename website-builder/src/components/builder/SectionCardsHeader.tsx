import type { Block } from '../../types/builder'
import { SectionHeading } from './SectionHeading'

interface SectionCardsHeaderProps {
  block: Block
  titleClassName?: string
  className?: string
}

export function SectionCardsHeader({ block, titleClassName, className = 'mb-8' }: SectionCardsHeaderProps) {
  const { props } = block
  if (!props.text && !props.subtitle) return null

  return (
    <SectionHeading
      title={props.text}
      subtitle={props.subtitle}
      styles={block.styles}
      className={className}
      titleClassName={titleClassName}
    />
  )
}
