import type { Block } from '../../types/builder'
import { SectionViewAllButton } from './SectionViewAllButton'

interface SectionViewAllFooterProps {
  block: Block
  interactive?: boolean
  onNavigate?: (slug: string) => void
  className?: string
}

export function SectionViewAllFooter({
  block,
  interactive = false,
  onNavigate,
  className = 'mt-10',
}: SectionViewAllFooterProps) {
  const { props } = block
  if (props.showViewAllButton !== true) return null

  const buttonText = props.viewAllButtonText?.trim() || 'View all'
  const buttonLink = props.viewAllButtonLink?.trim() || '#services'

  return (
    <div className={`flex w-full justify-center ${className}`}>
      <SectionViewAllButton
        text={buttonText}
        link={buttonLink}
        interactive={interactive}
        onNavigate={onNavigate}
      />
    </div>
  )
}
