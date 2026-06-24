import { useEffect, useRef, useState, type RefObject } from 'react'
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

type RibbonDensity = 'full' | 'compact' | 'icons'

function useRibbonDensity(
  ref: RefObject<HTMLElement | null>,
  tabCount: number,
): RibbonDensity {
  const [density, setDensity] = useState<RibbonDensity>('full')

  useEffect(() => {
    const el = ref.current
    if (!el || tabCount <= 0) return

    const update = () => {
      const perTab = el.clientWidth / tabCount
      if (perTab < 42) setDensity('icons')
      else if (perTab < 56) setDensity('compact')
      else setDensity('full')
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, tabCount])

  return density
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
  const stripRef = useRef<HTMLDivElement>(null)
  const visible = tabs.filter(t => !t.hidden)
  const density = useRibbonDensity(stripRef, visible.length)

  if (visible.length === 0) return null

  const iconsOnly = density === 'icons'

  return (
    <div
      className="shrink-0 border-b border-border bg-gradient-to-b from-muted/50 to-card"
      role="tablist"
      aria-label="Section editor"
    >
      <div
        ref={stripRef}
        className={cn(builderPanelUi.tabStripTabs, 'overflow-hidden px-0.5 pt-0.5')}
      >
        {visible.map(({ id, label, icon: Icon }) => {
          const selected = active === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={label}
              title={label}
              onClick={() => onChange(id)}
              className={cn(
                'relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-t-md border border-b-0 px-0.5 transition-colors',
                iconsOnly ? 'min-h-9 gap-0 py-1' : 'min-h-11 gap-0.5 py-1.5',
                selected
                  ? 'z-[1] -mb-px border-border bg-card text-primary shadow-[0_-1px_0_0_hsl(var(--card))]'
                  : 'border-transparent text-gray-600 hover:bg-card/70 hover:text-gray-900 dark:text-muted-foreground dark:hover:text-foreground',
              )}
            >
              <Icon
                className={cn(
                  iconsOnly ? 'h-4 w-4' : builderPanelUi.tabBtnIcon,
                  'shrink-0',
                  selected ? 'text-primary' : 'text-gray-500 dark:text-muted-foreground',
                )}
              />
              {!iconsOnly && (
                <span
                  className={cn(
                    builderPanelUi.tabBtnLabel,
                    'w-full font-semibold',
                    density === 'compact' ? 'text-[9px]' : 'text-[10px]',
                    selected ? 'text-primary' : 'text-gray-600 dark:text-muted-foreground',
                  )}
                >
                  {label}
                </span>
              )}
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
