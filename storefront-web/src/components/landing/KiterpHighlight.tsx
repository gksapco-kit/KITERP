import type { ReactNode } from 'react'

type KiterpHighlightProps = {
  children: ReactNode
  className?: string
}

export function KiterpHighlight({ children, className }: KiterpHighlightProps) {
  return (
    <span className={className ? `kiterp-highlight ${className}` : 'kiterp-highlight'}>
      {children}
      <svg className="kiterp-highlight-underline" viewBox="0 0 120 8" aria-hidden>
        <path
          className="kiterp-highlight-underline-path"
          d="M4 5.5c16-2.5 32-3.2 52-2.2 16 0.8 32 1.4 44 0.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          pathLength={1}
        />
      </svg>
    </span>
  )
}
