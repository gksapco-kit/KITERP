import { ArrowRight } from 'lucide-react'
import { createLinkClickHandler } from '../../lib/buttonNavigation'
import { useBuilderStore } from '../../store/useBuilderStore'

interface SectionViewAllButtonProps {
  text: string
  link?: string
  interactive?: boolean
  onNavigate?: (slug: string) => void
  className?: string
}

export function SectionViewAllButton({
  text,
  link,
  interactive = false,
  onNavigate,
  className = '',
}: SectionViewAllButtonProps) {
  const pages = useBuilderStore((s) => s.pages)
  const click = createLinkClickHandler({ interactive, link: link ?? '#services', pages, onNavigate })

  return (
    <a
      href={link || '#services'}
      onClick={click}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-600 bg-white px-4 py-2.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 dark:border-brand-500 dark:bg-gray-900 dark:text-brand-400 dark:hover:bg-brand-950 ${className}`}
    >
      {text}
      <ArrowRight className="h-4 w-4" />
    </a>
  )
}
