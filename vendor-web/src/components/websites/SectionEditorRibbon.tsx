import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { builderPanelUi } from '@/components/websites/builderPanelUi'

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
      className="shrink-0 border-b border-border bg-gradient-to-b from-muted/50 to-card"
      role="tablist"
      aria-label="Section editor"
    >
      <div className={cn(builderPanelUi.tabStripTabs, 'overflow-hidden px-0.5 pt-0.5')}>
        {visible.map(({ id, label, icon: Icon }) => {
          const selected = active === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              title={label}
              onClick={() => onChange(id)}
              className={cn(
                'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-px rounded-t-md border border-b-0 px-0.5 py-1 transition-colors',
                selected
                  ? 'z-[1] -mb-px border-border bg-card text-primary shadow-[0_-1px_0_0_hsl(var(--card))]'
                  : 'border-transparent text-gray-600 hover:bg-card/70 hover:text-gray-900 dark:text-muted-foreground dark:hover:text-foreground',
              )}
            >
              <Icon
                className={cn(
                  builderPanelUi.tabBtnIcon,
                  selected ? 'text-primary' : 'text-gray-500 dark:text-muted-foreground',
                )}
              />
              <span
                className={cn(
                  builderPanelUi.tabBtnLabel,
                  'font-semibold',
                  selected ? 'text-primary' : 'text-gray-600 dark:text-muted-foreground',
                )}
              >
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
