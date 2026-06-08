import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SectionEditorTabId = 'content' | 'layout' | 'design' | 'media' | 'more'

export interface SectionEditorTabDef {
  id: SectionEditorTabId
  label: string
  icon: LucideIcon
  /** Hide tab when section has nothing in this group */
  hidden?: boolean
}

/** Word/Excel-style ribbon tabs — same groups for every section type. */
export function SectionEditorRibbon({
  tabs,
  active,
  onChange,
}: {
  tabs: SectionEditorTabDef[]
  active: SectionEditorTabId
  onChange: (id: SectionEditorTabId) => void
}) {
  const visible = tabs.filter(t => !t.hidden)
  if (visible.length === 0) return null

  return (
    <div
      className="shrink-0 border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white"
      role="tablist"
      aria-label="Section editor"
    >
      <div className="flex items-stretch overflow-x-auto hide-scrollbar px-1 pt-1">
        {visible.map(({ id, label, icon: Icon }) => {
          const selected = active === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(id)}
              className={cn(
                'relative shrink-0 min-w-[4.25rem] px-2.5 py-2 flex flex-col items-center gap-0.5 rounded-t-lg border border-b-0 transition-colors',
                selected
                  ? 'bg-white text-primary border-gray-200 shadow-[0_-1px_0_0_white] z-[1] -mb-px'
                  : 'text-gray-500 border-transparent hover:text-gray-800 hover:bg-white/70',
              )}
            >
              <Icon className={cn('w-4 h-4', selected ? 'text-primary' : 'text-gray-400')} />
              <span className={cn('text-[10px] font-semibold leading-none', selected && 'text-primary')}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Pick first visible tab when switching blocks or when active tab is hidden. */
export function resolveSectionEditorTab(
  tabs: SectionEditorTabDef[],
  preferred: SectionEditorTabId,
): SectionEditorTabId {
  const visible = tabs.filter(t => !t.hidden)
  if (visible.some(t => t.id === preferred)) return preferred
  return visible[0]?.id ?? 'content'
}
