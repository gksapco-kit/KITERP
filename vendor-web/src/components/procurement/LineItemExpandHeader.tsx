import { ChevronDown, ChevronRight } from 'lucide-react'

interface Props {
  lineNumber: number
  typeLabel: string
  expanded: boolean
  onToggle: () => void
}

/** Clickable "Line N · Type" header with Expand / Close. */
export function LineItemExpandHeader({ lineNumber, typeLabel, expanded, onToggle }: Props) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={expanded ? `Close line ${lineNumber}` : `Expand line ${lineNumber}`}
        className="flex min-w-0 items-center gap-1.5 rounded text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
      >
        {expanded
          ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
          : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
        <span className="truncate text-xs font-semibold">
          Line {lineNumber}
          <span className="mx-1 font-normal text-gray-400">·</span>
          <span className="font-medium text-gray-600 dark:text-gray-300">{typeLabel}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onToggle}
        className="ml-auto shrink-0 rounded-full border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:border-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
      >
        {expanded ? 'Close' : 'Expand'}
      </button>
    </div>
  )
}

interface AllToggleProps {
  onExpandAll: () => void
  onCollapseAll: () => void
}

export function LineItemsExpandAllActions({ onExpandAll, onCollapseAll }: AllToggleProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onExpandAll}
        className="rounded-full px-2 py-0.5 text-[11px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
      >
        Expand all
      </button>
      <button
        type="button"
        onClick={onCollapseAll}
        className="rounded-full px-2 py-0.5 text-[11px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
      >
        Close all
      </button>
    </div>
  )
}
